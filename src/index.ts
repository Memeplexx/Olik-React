// We are disabling the above rule because we can be sure that hooks are called in the correct
// order due to the fact that the library functions will always be chained the same way
import {
  augment,
  BasicRecord,
  DeepReadonly,
  Derivation,
  Future,
  FutureState,
  Readable,
  SetNewNode,
  StoreDef
} from 'olik';

import { Context, useContext, useEffect, useMemo, useRef, useState } from 'react';

declare module 'olik' {
  interface Readable<S> {
    /**
     * Returns a hook which reads the selected node of the state tree
     */
    $useState: () => S;
  }
  interface Derivation<R> {
    /**
     * Returns a hook which reads the state of a derivation
     */
    $useState: () => R;
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
    $useFuture: () => FutureState<C>;
  }
}

export const augmentForReact = () => augment({
  selection: {
    $useState: function <S>(input: Readable<S>) {
      return function () {
        const inputRef = useRef(input);
        const [value, setValue] = useState(inputRef.current.$state);
        useEffect(() => {
          let valueCalculated: boolean;
          const subscription = inputRef.current.$onChange(arg => {
            valueCalculated = false;
            enqueueMicroTask(() => { // wait for all other change listeners to fire
              if (valueCalculated) { return; }
              valueCalculated = true;
              setValue(arg);
            })
          })
          return () => subscription.unsubscribe();
        }, [])
        return value;
      }
    },
  },
  derivation: {
    $useState: function <C>(input: Derivation<C>) {
      return function () {
        const inputRef = useRef(input);
        const [value, setValue] = useState(inputRef.current.$state);
        useEffect(() => {
          const subscription = inputRef.current.$onChange(arg => setValue(arg))
          return () => subscription.unsubscribe();
        }, [])
        return value;
      }
    },
  },
  future: {
    $useFuture: function <C>(input: Future<C>) {
      return function (deps) {
        const [state, setState] = useState(input.state);
        const depsString = JSON.stringify(deps);
        useEffect(() => {

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

export const enqueueMicroTask = (fn: () => void) => Promise.resolve().then(fn);

export type ReactStoreLocal<S, Key extends string, Patch> = Omit<StoreDef<S & { $local: Patch }>, '$state'> & { $state: DeepReadonly<S & { [k in Key]: Patch }> };
export type CreateUseStoreHookLocal<S, Key extends string, Patch> = { store: ReactStoreLocal<S, Key, Patch>, state: DeepReadonly<S & { $local: Patch }> };
export type CreateUseStoreHookGlobal<S> = { store: StoreDef<S>, state: DeepReadonly<S> };

export const createUseStoreHook = <S extends BasicRecord>(context: Context<StoreDef<S> | undefined>) => {
  
  function useStore(): CreateUseStoreHookGlobal<S>
  function useStore<Key extends string, Patch extends BasicRecord>(key: Key, state: Patch): CreateUseStoreHookLocal<S, Key, Patch>
  function useStore<Key extends string, Patch extends BasicRecord>(key?: Key, state?: Patch): CreateUseStoreHookGlobal<S> | CreateUseStoreHookLocal<S, Key, Patch> {

    // get store context and create refs
    const store = useContext(context)!;
    const refs = useRef({ store, key, state, subStore: undefined as CreateUseStoreHookLocal<S, Key, Patch> | undefined });

    // create substore as required
    if (key && state && store.$state[key] === undefined)
      (store[key] as SetNewNode).$setNew(refs.current.state as Patch);

    const storeProxy = useMemo(() => new Proxy({}, {
      get(_, p: string) {
        if (p === '$local') {
          if (refs.current.subStore === undefined)
            refs.current.subStore = store[key!] as unknown as CreateUseStoreHookLocal<S, Key, Patch>;
          return refs.current.subStore;
        }
        return store[p];
      }
    }), [store, key]);

    const stateProxy = useMemo(() => new Proxy({}, {
      get(_, p: string) {
        if (p === '$local')
          return store[key!]!.$useState();
        return store[p]!.$useState();
      }
    }), [store, key]);

    return new Proxy({} as CreateUseStoreHookLocal<S, Key, Patch>, {
      get(_, p: string) {
        if (p === 'state')
          return stateProxy;
        if (p === 'store')
          return storeProxy;
        throw new Error(`Property ${p} does not exist on store`);
      },
    });
  }
  return useStore;
}

// const appStore = createStore({ one: '' });
// const storeContext = createContext(appStore);
// const useStore = createUseStoreHook(storeContext);
// const { store, state } = useStore('two', { child: 'val' });
// console.log(store.$state.$local);
