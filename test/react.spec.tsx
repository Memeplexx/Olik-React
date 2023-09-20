// import '@testing-library/jest-dom';

import { augmentOlikForReact, useNestedStore } from '../src';
import { createStore, derive, importOlikAsyncModule, resetLibraryState } from 'olik';
import { expect, beforeAll, it, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

const initialState = {
  object: { property: 'a' },
  array: [{ id: 1, value: 'one' }, { id: 2, value: 'two' }, { id: 3, value: 'three' }],
  string: 'b',
};

beforeAll(() => {
  augmentOlikForReact();
  importOlikAsyncModule();
})

beforeEach(() => {
  resetLibraryState();
})

afterEach(cleanup)

it('should create and update a store', () => {
  const select = createStore(initialState);
  select.object.property
    .$set('test');
  expect(select.$state.object.property).toEqual('test');
})

it('should useSelector', async () => {
  const select = createStore(initialState);
  const App = () => {
    const result = select.object.property.$useState();
    return (
      <>
        <button onClick={() => select.object.property.$set('test')}>Click</button>
        <div data-testid="result">{result}</div>
      </>
    );
  };
  render(<App />);
  expect(screen.getByTestId('result').textContent).toEqual(initialState.object.property);
  await (screen.getByRole('button') as HTMLButtonElement).click();
  expect(screen.getByTestId('result').textContent).toEqual('test');
});

it('should useDerivation with no deps', async () => {
  const select = createStore(initialState);
  let calcCount = 0;
  const App = () => {
    const result = derive(
      select.string,
      select.object.property,
    ).$with((str, prop) => {
      calcCount++;
      return str + prop;
    }).$useState();
    return (
      <>
        <button onClick={() => select.object.property.$set('test')}>Click</button>
        <div data-testid="result">{result}</div>
      </>
    );
  };
  render(<App />);
  await expect(screen.getByTestId('result').textContent).toEqual(initialState.string + initialState.object.property);
  await expect(calcCount).toEqual(1);
  await (screen.getByRole('button') as HTMLButtonElement).click();
  await expect(screen.getByTestId('result').textContent).toEqual(initialState.string + 'test');
  await expect(calcCount).toEqual(2);
});

it('should useDerivation with deps', async () => {
  const get = createStore(initialState);
  let calcCount = 0;
  const App = () => {
    const [, setStr] = React.useState('');
    const result = derive(
      get.string,
      get.object.property,
    ).$with((str, prop) => {
      calcCount++;
      return str + prop;
    }).$useState();
    return (
      <>
        <button data-testid="btn-1" onClick={() => setStr('test')}>Click</button>
        <div data-testid="result">{result}</div>
      </>
    );
  };
  await render(<App />);
  await expect(screen.getByTestId('result').textContent).toEqual(initialState.string + initialState.object.property);
  await expect(calcCount).toEqual(1);
  await (screen.getByTestId('btn-1') as HTMLButtonElement).click();
  await expect(calcCount).toEqual(1);
});

it('should create a component store without a parent', async () => {
  let renderCount = 0;
  const App = () => {
    const { store, state } = useNestedStore({ unhosted: initialState }).usingAccessor(s => s.unhosted);
    const result = store.object.property.$useState();
    renderCount++;
    return (
      <>
        <button data-testid="btn-1" onClick={() => store.object.property.$set('test')}>Click</button>
        <button data-testid="btn-2" onClick={() => store.string.$set('test')}>Click</button>
        <div data-testid="result">{result}</div>
      </>
    );
  };
  render(<App />);
  expect(renderCount).toEqual(1);
  await (screen.getByTestId('btn-1') as HTMLButtonElement).click();
  expect(screen.getByTestId('result').textContent).toEqual('test');
  expect(renderCount).toEqual(2);
  (screen.getByTestId('btn-2') as HTMLButtonElement).click();
  expect(renderCount).toEqual(2);
});

it('should create a component store with a parent', async () => {
  const parentSelect = createStore({
    ...initialState,
    component: {} as { [key: string]: { prop: string } }
  });
  let renderCount = 0;
  const Child = () => {
    const { store, state } = useNestedStore({ component: { prop: '' } }).usingAccessor(s => s.component);
    const result = store.prop.$useState();
    renderCount++;
    return (
      <>
        <button data-testid="btn" onClick={() => store.prop.$set('test')}>Click</button>
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
  await (screen.getByTestId('btn') as HTMLButtonElement).click();
  expect(renderCount).toEqual(2);
  expect(parentSelect.component.$state).toEqual({ prop: 'test' });
});

it('component store should receive props from parent', async () => {
  const parentSelect = createStore({
    ...initialState,
    component2: {} as { [key: string]: { prop: string, num: number } }
  });
  const Child: React.FunctionComponent<{ num: number }> = (props) => {
    const { store, state } = useNestedStore({ component2: { prop: 0 } }).usingAccessor(s => s.component2);
    React.useEffect(() => store.prop.$set(props.num), [props.num]);
    const result = store.prop.$useState();
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
  await waitFor(() => expect(parentSelect.component2.$state).toEqual({ prop: 1 }));
})

it('should respond to async actions', async () => {
  const select = createStore(initialState);
  const App = () => {
    const state = select.object.property.$useState();
    return (
      <>
        <button data-testid="btn" onClick={() => select.object.property
          .$set(() => new Promise(resolve => setTimeout(() => resolve('test'), 10)))}>Click</button>
        <div data-testid="result">{state}</div>
      </>
    );
  }
  await render(<App />);
  await (screen.getByTestId('btn') as HTMLButtonElement).click();
  await waitFor(() => expect(screen.getByTestId('result').textContent).toEqual('test'));
});

// it('should respond to async queries', async () => {
//   const store = createStore(initialState);
//   const fetchString = () => new Promise<string>(resolve => setTimeout(() => resolve('test'), 10))
//   const App = () => {
//     const future = store.object.property.$set(fetchString).$useFuture();
//     return (
//       <>
//         <div data-testid="result">{future.storeValue}</div>
//         {future.isLoading && <div>Loading</div>}
//         {future.wasResolved && <div>Success</div>}
//         {future.wasRejected && <div>Failure</div>}
//       </>
//     );
//   }
//   await render(<App />);
//   await expect(screen.queryByText('Loading')).toBeTruthy();
//   await expect(screen.getByTestId('result').textContent).toEqual('a');
//   await waitFor(() => expect(screen.getByTestId('result').textContent).toEqual('test'));
//   await expect(screen.queryByText('Success')).toBeTruthy();
//   await expect(screen.queryByText('Failure')).toBeFalsy();
//   await expect(screen.queryByText('Loading')).toBeFalsy();
// })

// it('should be able to paginate', async () => {
//   const todos = new Array(15).fill(null).map((e, i) => ({ id: i + 1, text: `value ${i + 1}` }));
//   type Todo = { id: number, text: string };
//   const select = createStore({
//     state: {
//       toPaginate: {} as { [key: string]: Todo[] },
//     }
//   });
//   const fetchTodos = (index: number) => new Promise<Todo[]>(resolve => setTimeout(() => resolve(todos.slice(index * 10, (index * 10) + 10)), 10));
//   const App = () => {
//     const [index, setIndex] = React.useState(0);
//     const future = select.toPaginate[index]
//       .$set(() => fetchTodos(index))
//       .$useFuture([index]);
//     return (
//       <>
//         <button data-testid="btn" onClick={() => setIndex(1)}>Click</button>
//         <div data-testid="result">{future.error as string}</div>
//         {future.isLoading && <div>Loading</div>}
//         {future.wasResolved && <div>Success</div>}
//         {future.wasRejected && <div>Failure</div>}
//         {future.wasResolved && <div data-testid='todos-length'>{future.storeValue.length}</div>}
//       </>
//     );
//   }
//   render(<App />);
//   await waitFor(() => expect(screen.queryByText('Loading')).toBeTruthy());
//   expect(screen.getByTestId('result').textContent).toEqual('');
//   await waitFor(() => {
//     expect(screen.queryByText('Loading')).toBeFalsy();
//     expect(screen.getByTestId('todos-length').textContent).toEqual('10')
//   });
//   (screen.getByTestId('btn') as HTMLButtonElement).click();
//   await waitFor(() => expect(screen.queryByText('Loading')).toBeTruthy());
//   await waitFor(() => {
//     expect(screen.queryByText('Loading')).toBeFalsy();
//     expect(screen.getByTestId('todos-length').textContent).toEqual('5');
//   });
// })

// it('should be able to paginate', async () => {
//   const select = createStore({
//     state: {
//       storeNum: -1
//     }
//   });
//   const fetchNum = (num: number) => new Promise<number>(resolve => setTimeout(() => resolve(num), 100));
//   const App = () => {
//     const [num, setNum] = React.useState(0);
//     const future = select.storeNum
//       .$set(() => fetchNum(num))
//       .$useFuture([num]);
//     return (
//       <>
//         <div data-testid="num">{num}</div>
//         <div data-testid="res">{future.storeValue}</div>
//         <button data-testid="btn" onClick={() => setNum(n => n + 1)}>Next page</button>
//       </>
//     );
//   }
//   render(<App />);
//   await waitFor(() => expect(screen.getByTestId('res').textContent).toEqual('0'));
//   (screen.getByTestId('btn') as HTMLButtonElement).click();
//   await waitFor(() => expect(screen.getByTestId('res').textContent).toEqual('1'));
//   (screen.getByTestId('btn') as HTMLButtonElement).click();
//   await waitFor(() => expect(screen.getByTestId('res').textContent).toEqual('2'));
//   (screen.getByTestId('btn') as HTMLButtonElement).click();
//   await waitFor(() => expect(screen.getByTestId('res').textContent).toEqual('3'));
// })

// it('should support optimistic updates correctly with a future', async () => {
//   const select = createStore({ state: { test: '' } });
//   const App = () => {
//     const future = select.test
//       .$set(() => new Promise(resolve => resolve('XXX')), { eager: 'ABC' })
//       .$useFuture();
//     return (
//       <>
//         <div data-testid="res">{future.storeValue}</div>
//       </>
//     );
//   };
//   render(<App />);
//   await waitFor(() => expect(screen.getByTestId('res').textContent).toEqual('ABC'));
//   await waitFor(() => expect(screen.getByTestId('res').textContent).toEqual('XXX'));
// })

it('should support optimistic updates correctly with a promise', async () => {
  const select = createStore({ test: '' });
  const App = () => {
    const onClick = () => select.test
      .$set(() => new Promise(resolve => resolve('XXX')), { eager: 'ABC' });
    const state = select.test.$useState();
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

// it('should useState with deps correctly', async () => {
//   const select = createStore({
//     state: {
//       todos: [
//         { id: 1, title: "mix flour", done: true },
//         { id: 2, title: "add egg", done: false },
//         { id: 3, title: "bake cookies", done: false }
//       ],
//       showCompleted: false
//     }
//   });
//   const App = () => {
//     const showCompleted = select.showCompleted
//       .$useState();
//     const completedTodos = select.todos.$filter.done.$eq(showCompleted)
//       .$useState([showCompleted])
//     return (
//       <>
//         <input
//           data-testid="checkbox"
//           type="checkbox"
//           checked={showCompleted}
//           onChange={e => select.showCompleted.$set(e.target.checked)}
//         />
//         Show completed todos
//         <hr />
//         <div data-testid="res">
//           {completedTodos.map(todo => (todo.title)).join(', ')}
//         </div>
//       </>
//     );
//   }
//   await render(<App />);
//   await expect(screen.getByTestId('res').textContent).toEqual('add egg, bake cookies');
//   await (screen.getByTestId('checkbox') as HTMLButtonElement).click();
//   await expect(screen.getByTestId('res').textContent).toEqual('mix flour');
//   await (screen.getByTestId('checkbox') as HTMLButtonElement).click();
//   await expect(screen.getByTestId('res').textContent).toEqual('add egg, bake cookies');
// })

// it('', () => {
//   const rootStore = createStore({ state: { hello: '' } });
//   const { store, state } = useInnerStore({ arr: [{id: 1, val: 'one'}] }).usingAccessor(s => s.arr);
//   store.$useState();
// })


it('should create a component store with a parent', async () => {
  const parentSelect = createStore({
    ...initialState,
    thingy: {
      val: ''
    }
  });
  let renderCount = 0;
  const Child = () => {
    const { store } = useNestedStore({ thingy: { val: '' } }).usingAccessor(s => s.thingy);
    const result = store.val.$useState();
    renderCount++;
    return (
      <>
        <button data-testid="btn" onClick={() => store.val.$set('x')}>Click</button>
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
  await (screen.getByTestId('btn') as HTMLButtonElement).click();
  expect(renderCount).toEqual(2);
  expect(parentSelect.thingy.$state).toEqual({ val: 'x' });
});
