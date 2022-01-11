import '@testing-library/jest-dom';

import { screen, waitFor } from '@testing-library/dom';
import { render } from '@testing-library/react';
import React from 'react';

import { augmentOlikForReact, useNestedStore } from '../src';
import { createStore, derive, enableAsyncActionPayloads, enableNesting } from 'olik';

describe('React', () => {

  const initialState = {
    object: { property: 'a' },
    array: [{ id: 1, value: 'one' }, { id: 2, value: 'two' }, { id: 3, value: 'three' }],
    string: 'b',
  };

  beforeAll(() => {
    augmentOlikForReact();
    enableAsyncActionPayloads();
    enableNesting();
  })

  it('should create and update a store', () => {
    const select = createStore({ name: '', state: initialState });
    select.object.property
      .replace('test');
    expect(select.state.object.property).toEqual('test');
  })

  it('should useSelector', () => {
    const select = createStore({ name: '', state: initialState });
    const App = () => {
      const result = select.object.property.useState();
      return (
        <>
          <button onClick={() => select.object.property.replace('test')}>Click</button>
          <div data-testid="result">{result}</div>
        </>
      );
    };
    render(<App />);
    expect(screen.getByTestId('result').textContent).toEqual(initialState.object.property);
    (screen.getByRole('button') as HTMLButtonElement).click();
    expect(screen.getByTestId('result').textContent).toEqual('test');
  });

  it('should useDerivation with no deps', async () => {
    const select = createStore({ name: '', state: initialState });
    let calcCount = 0;
    const App = () => {
      const result = derive(
        select.string,
        select.object.property,
      ).with((str, prop) => {
        calcCount++;
        return str + prop;
      }).useState();
      return (
        <>
          <button onClick={() => select.object.property.replace('test')}>Click</button>
          <div data-testid="result">{result}</div>
        </>
      );
    };
    render(<App />);
    expect(screen.getByTestId('result').textContent).toEqual(initialState.string + initialState.object.property);
    expect(calcCount).toEqual(1);
    (screen.getByRole('button') as HTMLButtonElement).click();
    expect(screen.getByTestId('result').textContent).toEqual(initialState.string + 'test');
    expect(calcCount).toEqual(2);
  });

  it('should useDerivation with deps', async () => {
    const get = createStore({ name: '', state: initialState });
    let calcCount = 0;
    const App = () => {
      const [str, setStr] = React.useState('');
      const [num, setNum] = React.useState(0);
      const result = derive(
        get.string,
        get.object.property,
      ).with((str, prop) => {
        calcCount++;
        return str + prop + num;
      }).useState([num]);
      return (
        <>
          <button data-testid="btn-1" onClick={() => setStr('test')}>Click</button>
          <button data-testid="btn-2" onClick={() => setNum(1)}>Click</button>
          <div data-testid="result">{result}</div>
        </>
      );
    };
    render(<App />);
    expect(screen.getByTestId('result').textContent).toEqual(initialState.string + initialState.object.property + 0);
    expect(calcCount).toEqual(1);
    (screen.getByTestId('btn-1') as HTMLButtonElement).click();
    await waitFor(() => expect(calcCount).toEqual(1));
    (screen.getByTestId('btn-2') as HTMLButtonElement).click();
    await waitFor(() => expect(calcCount).toEqual(2));
  });

  it('should create a component store without a parent', () => {
    let renderCount = 0;
    const App = () => {
      const select = useNestedStore({ name: 'unhosted', tryToNestWithinStore: 'xxx', state: initialState });
      const result = select.object.property.useState();
      renderCount++;
      return (
        <>
          <button data-testid="btn-1" onClick={() => select.object.property.replace('test')}>Click</button>
          <button data-testid="btn-2" onClick={() => select.string.replace('test')}>Click</button>
          <div data-testid="result">{result}</div>
        </>
      );
    };
    render(<App />);
    expect(renderCount).toEqual(1);
    (screen.getByTestId('btn-1') as HTMLButtonElement).click();
    expect(screen.getByTestId('result').textContent).toEqual('test');
    expect(renderCount).toEqual(2);
    (screen.getByTestId('btn-2') as HTMLButtonElement).click();
    expect(renderCount).toEqual(2);
  });

  it('should create a component store with a parent', () => {
    const parentSelect = createStore({
      name: 'xxx',
      state: {
        ...initialState,
        nested: {
          component: {} as { [key: string]: { prop: string } }
        }
      }
    });
    let renderCount = 0;
    const Child = () => {
      const select = useNestedStore({
        name: 'component',
        tryToNestWithinStore: 'xxx',
        state: { prop: '' },
      });
      const result = select.prop.useState();
      renderCount++;
      return (
        <>
          <button data-testid="btn" onClick={() => select.prop.replace('test')}>Click</button>
          <div>{result}</div>
        </>
      );
    };
    const Parent = () => {
      return (
        <>
          <Child />
        </>
      );
    }
    render(<Parent />);
    expect(renderCount).toEqual(1);
    (screen.getByTestId('btn') as HTMLButtonElement).click();
    expect(renderCount).toEqual(2);
    expect(parentSelect.nested.component.state).toEqual({ '0': { prop: 'test' } });
  });

  it('component store should receive props from parent', async () => {
    const parentSelect = createStore({
      name: 'yyy',
      state: {
        ...initialState,
        nested: {
          component2: {} as { [key: string]: { prop: string, num: number } }
        }
      }
    });
    const Child: React.FunctionComponent<{ num: number }> = (props) => {
      const select = useNestedStore({
        name: 'component2',
        tryToNestWithinStore: 'yyy',
        state: { prop: 0 },
      });
      React.useEffect(() => select.prop.replace(props.num), [props.num, select])
      const result = select.prop.useState([props.num]);
      return (
        <>
          <div>{result}</div>
        </>
      );
    };
    const Parent = () => {
      const [num, setNum] = React.useState(0);
      return (
        <>
          <Child num={num} />
          <button data-testid="btn" onClick={() => setNum(num + 1)}>Click</button>
        </>
      );
    }
    render(<Parent />);
    (screen.getByTestId('btn') as HTMLButtonElement).click();
    await waitFor(() => expect(parentSelect.nested.component2.state).toEqual({ '0': { prop: 1 } }));
  })

  it('should respond to async actions', async () => {
    const select = createStore({ name: '', state: initialState });
    const App = () => {
      const state = select.object.property.useState();
      return (
        <>
          <button data-testid="btn" onClick={() => select.object.property
            .replace(() => new Promise(resolve => setTimeout(() => resolve('test'), 10)))}>Click</button>
          <div data-testid="result">{state}</div>
        </>
      );
    }
    render(<App />);
    await (screen.getByTestId('btn') as HTMLButtonElement).click();
    await waitFor(() => expect(screen.getByTestId('result').textContent).toEqual('test'));
  });

  it('should respond to async queries', async () => {
    const select = createStore({ name: '', state: initialState });
    const fetchString = () => new Promise<string>(resolve => setTimeout(() => resolve('test'), 10))
    const App = () => {
      const future = select.object.property.replace(fetchString).useFuture();
      return (
        <>
          <div data-testid="result">{future.storeValue}</div>
          {future.isLoading && <div>Loading</div>}
          {future.wasResolved && <div>Success</div>}
          {future.wasRejected && <div>Failure</div>}
        </>
      );
    }
    render(<App />);
    expect(screen.queryByText('Loading')).toBeInTheDocument();
    expect(screen.getByTestId('result').textContent).toEqual('a');
    await waitFor(() => expect(screen.getByTestId('result').textContent).toEqual('test'));
    await waitFor(() => expect(screen.queryByText('Success')).toBeInTheDocument());
    expect(screen.queryByText('Failure')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  })

  it('should be able to paginate', async () => {
    const todos = new Array(15).fill(null).map((e, i) => ({ id: i + 1, text: `value ${i + 1}` }));
    type Todo = { id: Number, text: string };
    const select = createStore({
      name: '',
      state: {
        toPaginate: {} as { [key: string]: Todo[] },
      }
    });
    const fetchTodos = (index: number) => new Promise<Todo[]>(resolve => setTimeout(() => resolve(todos.slice(index * 10, (index * 10) + 10)), 10));
    const App = () => {
      const [index, setIndex] = React.useState(0);
      const future = select.toPaginate[index]
        .replaceAll(() => fetchTodos(index))
        .useFuture([index]);
      return (
        <>
          <button data-testid="btn" onClick={() => setIndex(1)}>Click</button>
          <div data-testid="result">{future.error}</div>
          {future.isLoading && <div>Loading</div>}
          {future.wasResolved && <div>Success</div>}
          {future.wasRejected && <div>Failure</div>}
          {future.wasResolved && <div data-testid='todos-length'>{future.storeValue.length}</div>}
        </>
      );
    }
    render(<App />);
    await waitFor(() => expect(screen.queryByText('Loading')).toBeInTheDocument());
    expect(screen.getByTestId('result').textContent).toEqual('');
    await waitFor(() => {
      expect(screen.queryByText('Loading')).not.toBeInTheDocument();
      expect(screen.getByTestId('todos-length').textContent).toEqual('10')
    });
    (screen.getByTestId('btn') as HTMLButtonElement).click();
    await waitFor(() => expect(screen.queryByText('Loading')).toBeInTheDocument());
    await waitFor(() => {
      expect(screen.queryByText('Loading')).not.toBeInTheDocument();
      expect(screen.getByTestId('todos-length').textContent).toEqual('5');
    });
  })

  it('should be able to paginate', async () => {
    const select = createStore({
      name: '',
      state: {
        storeNum: -1
      }
    });
    const fetchNum = (num: number) => new Promise<number>(resolve => setTimeout(() => resolve(num), 100));
    const App = () => {
      const [num, setNum] = React.useState(0);
      const future = select.storeNum
        .replace(() => fetchNum(num))
        .useFuture([num]);
      return (
        <>
          <div data-testid="num">{num}</div>
          <div data-testid="res">{future.storeValue}</div>
          <button data-testid="btn" onClick={() => setNum(n => n + 1)}>Next page</button>
        </>
      );
    }
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('res').textContent).toEqual('0'));
    (screen.getByTestId('btn') as HTMLButtonElement).click();
    await waitFor(() => expect(screen.getByTestId('res').textContent).toEqual('1'));
    (screen.getByTestId('btn') as HTMLButtonElement).click();
    await waitFor(() => expect(screen.getByTestId('res').textContent).toEqual('2'));
    (screen.getByTestId('btn') as HTMLButtonElement).click();
    await waitFor(() => expect(screen.getByTestId('res').textContent).toEqual('3'));
  })

  it('should support optimistic updates correctly with a future', async () => {
    const select = createStore({ name: '', state: { test: '' } });
    const App = () => {
      const future = select.test
        .replace(() => new Promise(resolve => resolve('XXX')), { optimisticallyUpdateWith: 'ABC' })
        .useFuture();
      return (
        <>
          <div data-testid="res">{future.storeValue}</div>
        </>
      );
    };
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('res').textContent).toEqual('ABC'));
    await waitFor(() => expect(screen.getByTestId('res').textContent).toEqual('XXX'));
  })

  it('should support optimistic updates correctly with a promise', async () => {
    const select = createStore({ name: '', state: { test: '' } });
    const App = () => {
      const onClick = () => select.test
        .replace(() => new Promise(resolve => resolve('XXX')), { optimisticallyUpdateWith: 'ABC' });
      const state = select.test.useState();
      return (
        <>
          <div data-testid="res">{state}</div>
          <button data-testid="btn" onClick={() => onClick()}>Next page</button>
        </>
      );
    };
    render(<App />);
    (screen.getByTestId('btn') as HTMLButtonElement).click();
    await waitFor(() => expect(screen.getByTestId('res').textContent).toEqual('ABC'));
    await waitFor(() => expect(screen.getByTestId('res').textContent).toEqual('XXX'));
  })

  it('should useState with deps correctly', async () => {
    const select = createStore({
      name: '',
      state: {
        todos: [
          { id: 1, title: "mix flour", done: true },
          { id: 2, title: "add egg", done: false },
          { id: 3, title: "bake cookies", done: false }
        ],
        showCompleted: false
      }
    });
    const App = () => {
      const showCompleted = select.showCompleted
        .useState();
      const completedTodos = select.todos.filter.done.eq(showCompleted)
        .useState([showCompleted])
      return (
        <>
          <input
            data-testid="checkbox"
            type="checkbox"
            checked={showCompleted}
            onChange={e => select.showCompleted.replace(e.target.checked)}
          />
          Show completed todos
          <hr />
          <div data-testid="res">
            {completedTodos.map(todo => (todo.title)).join(', ')}
          </div>
        </>
      );
    }
    render(<App />);
    expect(screen.getByTestId('res').textContent).toEqual('add egg, bake cookies');
    (screen.getByTestId('checkbox') as HTMLButtonElement).click();
    expect(screen.getByTestId('res').textContent).toEqual('mix flour');
    (screen.getByTestId('checkbox') as HTMLButtonElement).click();
    expect(screen.getByTestId('res').textContent).toEqual('add egg, bake cookies');
  })

});
