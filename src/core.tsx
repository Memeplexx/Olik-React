/* eslint-disable react-hooks/rules-of-hooks */
// We are disabling the above rule because we can be sure that hooks are called in the correct
// order due to the fact that the library functions will always be chained the same way
import {
  augment,
  createStore,
  DeepReadonly,
  Derivation,
  Future,
  FutureState,
  getStoreByName,
  nestStoreIfPossible,
  Readable,
} from 'olik';

import React from 'react';

export * from 'olik';

declare module 'olik' {
  interface Readable<S> {
    /**
     * Returns a hook which reads the selected node of the state tree
     */
    useState: (deps?: React.DependencyList) => S;
  }
  interface Derivation<R> {
    /**
     * Returns a hook which reads the state of a derivation
     */
    useState: (deps?: React.DependencyList) => R;
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
    useFuture: (deps?: React.DependencyList) => FutureState<C>;
  }
}

augment({
  selection: {
    useState: function <S>(input: Readable<S>) {
      return function (deps: React.DependencyList = []) {
        const inputRef = React.useRef(input);
        const [value, setValue] = React.useState(inputRef.current.state as DeepReadonly<S>);
        const depsString = JSON.stringify(deps);
        React.useEffect(() => {
          inputRef.current = input;
          setValue(input.state as DeepReadonly<S>);
          const subscription = inputRef.current.onChange(arg => setValue(arg as DeepReadonly<S>))
          return () => subscription.unsubscribe();
        }, [depsString]);
        return value;
      }
    },
  },
  derivation: {
    useState: function <C>(input: Derivation<C>) {
      return function (deps: React.DependencyList = []) {
        const inputRef = React.useRef(input);
        const [value, setValue] = React.useState(inputRef.current.state as DeepReadonly<C>);
        const depsString = JSON.stringify(deps);
        React.useEffect(() => {
          inputRef.current = input;
          setValue(input.state as DeepReadonly<C>);
          const subscription = inputRef.current.onChange(arg => setValue(arg as DeepReadonly<C>))
          return () => subscription.unsubscribe();
        }, [depsString]);
        return value;
      }
    },
  },
  future: {
    useFuture: function <C>(input: Future<C>) {
      return function (deps: React.DependencyList = []) {
        const [state, setState] = React.useState(input.getFutureState());
        const depsString = JSON.stringify(deps);
        React.useEffect(() => {

          // Call promise
          let running = true;
          input
            .then(() => { if (running) { setState(input.getFutureState()); } })
            .catch(() => { if (running) { setState(input.getFutureState()); } });

          // update state because there may have been an optimistic update
          setState(input.getFutureState());
          return () => { running = false; }
        }, [depsString]);
        return state;
      }
    }
  }
})

export const useNestedStore = function <C>(
  arg: {
    state: C,
    name: string,
    instanceName: string | number;
    containerStoreName: string;
  },
) {
  const stateRef = React.useRef(arg.state);
  const optionsRef = React.useRef(arg);
  const select = React.useMemo(() => createStore({ name: optionsRef.current.name, state: stateRef.current }), []);
  const ref = React.useMemo(() => nestStoreIfPossible({ store: select as any, ...optionsRef.current }), [select]);
  const selectRef = React.useRef(select);
  const refRef = React.useRef(ref);
  React.useEffect(() => {
    // When the user saves their app (causing a hot-reload) the following sequence of events occurs:
    // hook is run, useMemo (store is created), useEffect, useEffect cleanup (store is detached), hook is run, useMemo is NOT rerun (so store is NOT recreated).
    // This causes the app to consume an removed selectRef.current which causes an error to be thrown.
    // The following statement ensures that, should a nested store have been removed, it will be re-created within its application store
    if (getStoreByName(optionsRef.current.containerStoreName)?.state.nested?.[optionsRef.current.name]?.[optionsRef.current.instanceName]) {
      selectRef.current = createStore({ name: optionsRef.current.name, state: selectRef.current.state }) as any;
      refRef.current = nestStoreIfPossible({ store: selectRef.current as any, ...optionsRef.current });
    }
    return () => refRef.current.detach()
  }, []);
  return selectRef.current;
}
