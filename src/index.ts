/* eslint-disable react-hooks/rules-of-hooks */
// We are disabling the above rule because we can be sure that hooks are called in the correct
// order due to the fact that the library functions will always be chained the same way
import {
  augment,
  createInnerStore,
  Derivation,
  Future,
  FutureState,
  MaxRecursionDepth,
  Readable,
  UpdatableArray,
  UpdatableObject,
  UpdatablePrimitive
} from 'olik';

import React from 'react';

declare module 'olik' {
  interface Readable<S> {
    /**
     * Returns a hook which reads the selected node of the state tree
     */
    $useState: (deps?: React.DependencyList) => S;
  }
  interface Derivation<R> {
    /**
     * Returns a hook which reads the state of a derivation
     */
    $useState: (deps?: React.DependencyList) => R;
  }
  interface Future<C> {
    /**
     * Returns a hook which tracks the status of the promise which is being used to update the state
     * @example
     * const future = select(s => s.some.value)
     *   .replace(() => fetchValue())
     *   .useFuture();
     * 
     * <div>Is loading: {future.isLoading}</div>
     * <div>Was resolved: {future.wasResolved}</div>
     * <div>Was rejected: {future.wasRejected}</div>
     * <div>Store value: {future.storeValue}</div>
     * <div>Error: {future.error}</div>
     */
    $useFuture: (deps?: React.DependencyList) => FutureState<C>;
  }
}

export const augmentOlikForReact = () => augment({
  selection: {
    $useState: function <S>(input: Readable<S>) {
      return function (deps: React.DependencyList = []) {
        const inputRef = React.useRef(input);
        const [value, setValue] = React.useState(inputRef.current.$state);
        const depsString = JSON.stringify(deps);
        React.useEffect(() => {
          inputRef.current = input;
          setValue(input.$state);
          const subscription = inputRef.current.$onChange(arg => setValue(arg))
          return () => subscription.unsubscribe();
        }, [depsString]);
        return value;
      }
    },
  },
  derivation: {
    $useState: function <C>(input: Derivation<C>) {
      return function (deps: React.DependencyList = []) {
        const inputRef = React.useRef(input);
        const [value, setValue] = React.useState(inputRef.current.$state);
        const depsString = JSON.stringify(deps);
        React.useEffect(() => {
          inputRef.current = input;
          setValue(input.$state);
          const subscription = inputRef.current.$onChange(arg => setValue(arg))
          return () => subscription.unsubscribe();
        }, [depsString]);
        return value;
      }
    },
  },
  future: {
    $useFuture: function <C>(input: Future<C>) {
      return function (deps: React.DependencyList = []) {
        const [state, setState] = React.useState(input.state);
        const depsString = JSON.stringify(deps);
        React.useEffect(() => {

          // Call promise
          let running = true;
          input
            .then(() => { if (running) { setState(input.state); } })
            .catch(() => { if (running) { setState(input.state); } });

          // update state because there may have been an optimistic update
          setState(input.state);
          return () => { running = false; }
        }, [depsString]);
        return state;
      }
    }
  }
})

type Store<S> = S extends never ? unknown : (S extends Array<unknown> ? UpdatableArray<S, 'isFilter', 'notQueried', MaxRecursionDepth> : S extends object ? UpdatableObject<S, 'isFind', 'notArray', 'yes', MaxRecursionDepth> : UpdatablePrimitive<S, 'isFind', 'notArray', MaxRecursionDepth>);

export const useNestedStore = <S extends Record<string, unknown>>(state: S) => ({
  usingAccessor: <C extends Readable<unknown>>(accessor: (store: Store<S>) => C): {
    store: C,
    state: C['$state'],
  } => {
    const stateRef = React.useRef<S>(state);
    const store = React.useMemo(() => createInnerStore(stateRef.current).usingAccessor(accessor), []);
    return {
      state: store.$useState(),
      store: store,
    }
  }
})
