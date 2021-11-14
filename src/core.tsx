/* eslint-disable react-hooks/rules-of-hooks */ 
// We are disabling the above rule because we can be sure that hooks are called in the correct
// order due to the fact that the library functions will always be chained the same way


import React from 'react';

import * as core from 'olik';

export * from 'olik';

let rootSelect: any;

export const createApplicationStore: typeof core['createApplicationStore'] = (state, options) => {
  augementCore();
  rootSelect = core.createApplicationStore(state, options);
  return rootSelect;
}

export const createApplicationStoreEnforcingTags: typeof core['createApplicationStoreEnforcingTags'] = (state, options) => {
  augementCore();
  rootSelect = core.createApplicationStoreEnforcingTags(state, options);
  return rootSelect
}

export const createComponentStore: typeof core['createComponentStore'] = (state, options) => {
  augementCore();
  return core.createComponentStore(state, options);
}

declare module 'olik' {
  interface StoreOrDerivation<C> {
    /**
     * Returns a hook which reads the selected node of the state tree
     */
    useState: (deps?: React.DependencyList) => C;
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
    useFuture: (deps?: React.DependencyList) => core.FutureState<C>;
  }
}

let coreHasBeenAgmented = false;
const augementCore = () => {
  if (coreHasBeenAgmented) { return; }
  coreHasBeenAgmented = true;
  core.augment({
    selection: {
      useState: function <C>(input: core.StoreOrDerivation<C>) {
        return function (deps: React.DependencyList = []) {
          const inputRef = React.useRef(input);
          const [value, setValue] = React.useState(inputRef.current.read() as core.DeepReadonly<C>);
          const depsString = JSON.stringify(deps);
          React.useEffect(() => {
            inputRef.current = input;
            setValue(input.read() as core.DeepReadonly<C>);
            const subscription = inputRef.current.onChange(arg => setValue(arg as core.DeepReadonly<C>))
            return () => subscription.unsubscribe();
          }, [depsString]);
          return value;
        }
      },
    },
    derivation: {
      useState: function <C>(input: core.Derivation<C>) {
        return function (deps: React.DependencyList = []) {
          const inputRef = React.useRef(input);
          const [value, setValue] = React.useState(inputRef.current.read() as core.DeepReadonly<C>);
          const depsString = JSON.stringify(deps);
          React.useEffect(() => {
            inputRef.current = input;
            setValue(input.read() as core.DeepReadonly<C>);
            const subscription = inputRef.current.onChange(arg => setValue(arg as core.DeepReadonly<C>))
            return () => subscription.unsubscribe();
          }, [depsString]);
          return value;
        }
      },
    },
    future: {
      useFuture: function <C>(input: core.Future<C>) {
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
}

export const useComponentStore = function <C>(
  initialState: C,
  options: core.OptionsForMakingAComponentStore,
) {
  const stateRef = React.useRef(initialState);
  const optionsRef = React.useRef(options);
  const select = React.useMemo(() => createComponentStore(stateRef.current, optionsRef.current), []);
  const selectRef = React.useRef(select);
  React.useEffect(() => {
    // When the user saves their app (causing a hot-reload) the following sequence of events occurs:
    // hook is run, useMemo (store is created), useEffect, useEffect cleanup (store is detached), hook is run, useMemo is NOT rerun (so store is NOT recreated).
    // This causes the app to consume an orphaned selectRef.current which causes an error to be thrown.
    // The following statement ensures that, should a nested store be orphaned, it will be re-attached to its application store
    if (!rootSelect?.().read().cmp?.[optionsRef.current.componentName]?.[optionsRef.current.instanceName]) {
      selectRef.current = createComponentStore(selectRef.current().read(), optionsRef.current) as any;
    }
    return () => selectRef.current().detachFromApplicationStore()
  }, []);
  return selectRef.current;
}
