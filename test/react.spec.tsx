// import '@testing-library/jest-dom';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { createStore, resetLibraryState } from 'olik';
import { importOlikAsyncModule } from 'olik/async';
import { derive } from 'olik/derive';
import React from 'react';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { augmentOlikForReact } from '../src';

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
});

// it('', () => {
//   const initState = {
//     modal: null as 'confirmDeleteGroup' | 'confirmDeleteTag' | 'synonymOptions' | 'groupOptions' | null,
//     bool: false,
//     thing: {},
//     flatObj: {
//       one: 'hello hello hello hello hello hello hello hello',
//       two: 'world',
//       three: 'another',
//     },
//     num: 0,
//     obj: {
//       one: {
//         two: 'hello',
//         three: false,
//         four: 4
//       },
//       two: {
//         five: 'thing',
//         three: [
//           [1, 2, 3]
//         ]
//       }
//     },
//     arr: [
//       { id: 1, text: 'one' },
//       { id: 2, text: 'two' },
//       { id: 3, text: 'three' },
//     ],
//     arrNum: [1, 2, 3],
//     arrNested: [
//       [1, 2, 3],
//       [4, 5, 6],
//       [7, 8, 9]
//     ],
//     dat: new Date(),
//     thingy: 'ddd',
//   }
//   const StoreContext = createContext<StoreDef<typeof initState> | undefined>(undefined);
//   const thingy = createUseStoreHook(StoreContext);
//   const { store } = thingy();
//   store.num.$add(1);
// })

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
  await screen.getByRole('button').click();
  await new Promise(resolve => setTimeout(resolve));
  await expect(screen.getByTestId('result').textContent).toEqual('test');
});

it('should useDerivation with no deps', async () => {
  const select = createStore(initialState);
  let calcCount = 0;
  const App = () => {
    const result = derive('c').$from(
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
  await screen.getByRole('button').click();
  await new Promise(resolve => setTimeout(resolve));
  await expect(screen.getByTestId('result').textContent).toEqual(initialState.string + 'test');
  await expect(calcCount).toEqual(2);
});

// it('should useDerivation with deps', async () => {
//   const get = createStore(initialState);
//   let calcCount = 0;
//   const App = () => {
//     const [, setStr] = React.useState('');
//     const result = derive('d').$from(
//       get.string,
//       get.object.property,
//     ).$with((str, prop) => {
//       calcCount++;
//       return str + prop;
//     }).$useState();
//     return (
//       <>
//         <button data-testid="btn-1" onClick={() => setStr('test')}>Click</button>
//         <div data-testid="result">{result}</div>
//       </>
//     );
//   };
//   await render(<App />);
//   await expect(screen.getByTestId('result').textContent).toEqual(initialState.string + initialState.object.property);
//   await expect(calcCount).toEqual(1);
//   await screen.getByTestId<HTMLButtonElement>('btn-1').click();
//   await expect(calcCount).toEqual(1);
// });

// it('should create a component store without a parent', async () => {
//   let renderCount = 0;
//   const App = () => {
//     const { store } = useNestedStore({ unhosted: initialState }).usingAccessor(s => s.unhosted);
//     const result = store.object.property.$useState();
//     renderCount++;
//     return (
//       <>
//         <button data-testid="btn-1" onClick={() => store.object.property.$set('test')}>Click</button>
//         <button data-testid="btn-2" onClick={() => store.string.$set('test')}>Click</button>
//         <div data-testid="result">{result}</div>
//       </>
//     );
//   };
//   render(<App />);
//   expect(renderCount).toEqual(1);
//   await screen.getByTestId<HTMLButtonElement>('btn-1').click();
//   await new Promise(resolve => setTimeout(resolve));
//   await expect(screen.getByTestId('result').textContent).toEqual('test');
//   expect(renderCount).toEqual(2);
//   screen.getByTestId<HTMLButtonElement>('btn-2').click();
//   await new Promise(resolve => setTimeout(resolve));
//   expect(renderCount).toEqual(3);
// });

// it('should create a component store with a parent', async () => {
//   const parentSelect = createStore({
//     ...initialState,
//     component: {} as { [key: string]: { prop: string } }
//   });
//   let renderCount = 0;
//   const Child = () => {
//     const { store } = useNestedStore({ component: { prop: '' } }).usingAccessor(s => s.component);
//     const result = store.prop.$useState();
//     renderCount++;
//     return (
//       <>
//         <button data-testid="btn" onClick={() => store.prop.$set('test')}>Click</button>
//         <div>{result}</div>
//       </>
//     );
//   };
//   const Parent = () => {
//     return (
//       <>
//         <Child />
//       </>
//     );
//   }
//   render(<Parent />);
//   expect(renderCount).toEqual(1);
//   await screen.getByTestId<HTMLButtonElement>('btn').click();
//   await new Promise(resolve => setTimeout(resolve));
//   expect(parentSelect.component.$state).toEqual({ prop: 'test' });
//   expect(renderCount).toEqual(2);
// });

// it('component store should receive props from parent', async () => {
//   const parentSelect = createStore({
//     ...initialState,
//     component2: {} as { [key: string]: { prop: string, num: number } }
//   });
//   const Child: React.FunctionComponent<{ num: number }> = (props) => {
//     const { store } = useNestedStore({ component2: { prop: 0 } }).usingAccessor(s => s.component2);
//     React.useEffect(() => store.prop.$set(props.num), [props.num]);
//     const result = store.prop.$useState();
//     return (
//       <>
//         <div>{result}</div>
//       </>
//     );
//   };
//   const Parent = () => {
//     const [num, setNum] = React.useState(0);
//     return (
//       <>
//         <Child num={num} />
//         <button data-testid="btn" onClick={() => setNum(num + 1)}>Click</button>
//       </>
//     );
//   }
//   render(<Parent />);
//   screen.getByTestId<HTMLButtonElement>('btn').click();
//   await waitFor(() => expect(parentSelect.component2.$state).toEqual({ prop: 1 }));
// })

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
  await screen.getByTestId<HTMLButtonElement>('btn').click();
  await waitFor(() => expect(screen.getByTestId('result').textContent).toEqual('test'));
});

// it('should support optimistic updates correctly with a promise', async () => {
//   const select = createStore({ test: '' });
//   const App = () => {
//     const onClick = () => select.test
//       .$set(() => new Promise(resolve => resolve('XXX')), { eager: 'ABC' });
//     const state = select.test.$useState();
//     return (
//       <>
//         <div data-testid="res">{state}</div>
//         <button data-testid="btn" onClick={() => onClick()}>Next page</button>
//       </>
//     );
//   };
//   render(<App />);
//   (screen.getByTestId('btn') as HTMLButtonElement).click();
//   await waitFor(() => expect(screen.getByTestId('res').textContent).toEqual('ABC'));
//   await waitFor(() => expect(screen.getByTestId('res').textContent).toEqual('XXX'));
// })

// it('should create a component store with a parent', async () => {
//   const parentSelect = createStore({
//     ...initialState,
//     thingy: {
//       val: ''
//     }
//   });
//   let renderCount = 0;
//   const Child = () => {
//     const { store } = useNestedStore({ thingy: { val: '' } }).usingAccessor(s => s.thingy);
//     const result = store.val.$useState();
//     renderCount++;
//     return (
//       <>
//         <button data-testid="btn" onClick={() => store.val.$set('x')}>Click</button>
//         <div>{result}</div>
//       </>
//     );
//   };
//   const Parent = () => {
//     return (
//       <>
//         <Child />
//       </>
//     );
//   }
//   render(<Parent />);
//   expect(renderCount).toEqual(1);
//   await screen.getByTestId<HTMLButtonElement>('btn').click();
//   await new Promise(resolve => setTimeout(resolve));
//   expect(renderCount).toEqual(2);
//   expect(parentSelect.thingy.$state).toEqual({ val: 'x' });
// });

it('', () => {
  const store = createStore({
    one: '',
    two: 0,
  });
  const d1 = derive('a').$from(
    store.one,
    store.two,
  ).$with((one, two) => {
    return one + two;
  });
  derive('b').$from(
    d1,
    store.two
  ).$with((d1, two) => {
    return d1 + two;
  })
})
