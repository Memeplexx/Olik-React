// import '@testing-library/jest-dom';

import { cleanup, render, screen } from '@testing-library/react';
import { createStore, resetLibraryState } from 'olik';
import { derive } from 'olik/derive';
import React from 'react';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { augmentForReact } from '../src';

const initialState = {
  object: { property: 'a' },
  array: [{ id: 1, value: 'one' }, { id: 2, value: 'two' }, { id: 3, value: 'three' }],
  string: 'b',
};

beforeAll(() => {
  augmentForReact();
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
  await screen.getByRole('button').click();
  await new Promise(resolve => setTimeout(resolve));
  await expect(screen.getByTestId('result').textContent).toEqual(initialState.string + 'test');
  await expect(calcCount).toEqual(2);
});

it('', () => {
  const store = createStore({
    one: '',
    two: 0,
  });
  const d1 = derive(
    store.one,
    store.two,
  ).$with((one, two) => {
    return one + two;
  });
  derive(
    d1,
    store.two
  ).$with((d1, two) => {
    return d1 + two;
  })
})
