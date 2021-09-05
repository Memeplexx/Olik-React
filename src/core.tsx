/* eslint-disable react-hooks/rules-of-hooks */
import React from 'react';

import * as core from 'olik';

export * from 'olik';

export const createApplicationStore: typeof core['createApplicationStore'] = (state, options) => {
  augementCore();
  return core.createApplicationStore(state, options);
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
          const [value, setValue] = React.useState(input.read() as core.DeepReadonly<C>);
          React.useEffect(() => {
            const subscription = input.onChange(arg => setValue(arg as core.DeepReadonly<C>));
            return () => subscription.unsubscribe();
            // eslint-disable-next-line react-hooks/exhaustive-deps
          }, deps);
          return value;
        }
      },
    },
    derivation: {
      useState: function <C>(input: core.Derivation<C>) {
        return function (deps: React.DependencyList = []) {
          const inputRef = React.useRef(input);
          const [value, setValue] = React.useState(inputRef.current.read() as core.DeepReadonly<C>);
          React.useEffect(() => {
            inputRef.current = input;
            const val = input.read() as core.DeepReadonly<C>;
            if (value !== val) {
              setValue(val);
            }
            const subscription = inputRef.current.onChange(arg => setValue(arg as core.DeepReadonly<C>))
            return () => { if (subscription) { subscription.unsubscribe(); } }
            // eslint-disable-next-line react-hooks/exhaustive-deps
          }, deps);
          return value;
        }
      },
    },
    future: {
      useFuture: function <C>(input: core.Future<C>) {
        return function (deps: React.DependencyList = []) {
          const [state, setState] = React.useState(input.getFutureState());
          const first = React.useRef(true);
          const active = React.useRef(true);
          React.useEffect(() => {
            if (first.current) {
              // on first call of this hook, we already have our state correctly initialized, so we don't need to set it and force an unnecessary re-render
              first.current = false;
            } else if (!state.isLoading && active.current) {
              setState(input.getFutureState());
            }
            input.asPromise()
              .then(() => { if (active.current) { setState(input.getFutureState()); } })
              .catch(() => { if (active.current) { setState(input.getFutureState()); } });
            return () => { if (first.current) { active.current = false; } }
            // eslint-disable-next-line react-hooks/exhaustive-deps
          }, deps);
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
  const initState = React.useRef(initialState);
  const opts = React.useRef(options);
  const select = React.useMemo(() => {
    return createComponentStore(initState.current, opts.current);
  }, []);
  React.useEffect(() => {
    return () => {
      const devMode = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
      // In dev mode, React.StrictMode is enabled. We cannot allow the store to be detached in this instance because an 
      // error will be thrown the next time a developer saves a code update and then attempts to update the nested store state.
      if (!devMode) {
        select().detachFromApplicationStore();
      } else { // Reset the state. Note for future: It may be safest that this is the ONLY correct behavior (rather than detaching)
        select().reset();
      }
    }
  }, [select]);
  return select;
}



// NOTES the following linting rules have been disabled in certain places:
// react-hooks/exhaustive-deps: We cannot forward deps from the enclosing function without receiving this linting error https://stackoverflow.com/questions/56262515/how-to-handle-dependencies-array-for-custom-hooks-in-react
// react-hooks/rules-of-hooks: We can guarantee the execution order of hooks in the context of the useDerivation() hook https://stackoverflow.com/questions/53906843/why-cant-react-hooks-be-called-inside-loops-or-nested-function
