import { beforeEach, expect, test } from 'vitest';
import { createStore, resetLibraryState } from 'olik';



const initialState = {
  object: { property: 'a' },
  array: [{ id: 1, value: 'one' }, { id: 2, value: 'two' }, { id: 3, value: 'three' }],
  string: 'b',
};

beforeEach(() => {
  resetLibraryState();
})

test('should create and update a store', () => {
  const select = createStore(initialState);
  select.object.property
    .$set('test');
  expect(select.$state.object.property).toEqual('test');
});
