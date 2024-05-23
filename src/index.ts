// We are disabling the above rule because we can be sure that hooks are called in the correct
// order due to the fact that the library functions will always be chained the same way
import {
  augment,
  BasicRecord,
  DeepReadonly,
  Derivation,
  Readable,
  SetNewNode,
  Store,
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
}

export const augmentForReact = () => augment({
  selection: {
    $useState: function <S>(input: Readable<S>) {
      return function () {
        const inputRef = useRef(input);
        const [value, setValue] = useState(inputRef.current.$state);
        useEffect(() => {
          // let valueCalculated: boolean;
          const unsubscribe = inputRef.current.$onChange(arg => {
            // valueCalculated = false;
            // enqueueMicroTask(() => { // wait for all other change listeners to fire
              // if (valueCalculated) { return; }
              // valueCalculated = true;
              setValue(arg);
            // })
          })
          return () => unsubscribe();
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
          return inputRef.current.$onChange(arg => setValue(arg))
        }, [])
        return value;
      }
    },
  },
})

export const enqueueMicroTask = (fn: () => void) => Promise.resolve().then(fn);

export type CreateUseStoreHookLocal<S> = { local: Store<S>, state: DeepReadonly<S> };
export type CreateUseStoreHookGlobal<S> = { store: Store<S>, state: DeepReadonly<S> };

export const createUseStoreHook = <S extends BasicRecord>(context: Context<Store<S> | undefined>) => {

  return {
    useStore: () => {
      // get store context and create refs
      const store = useContext(context)!;
      const refs = useRef({ store });
      const keys = useMemo(() => new Set<string>(), []);

      // ensure that store changes result in rerender
      const [, setN] = useState(0);
      useEffect(() => {
        const rootSubStores = [...keys].map(k => store[k]);
        const subStores = rootSubStores;
        const listeners = subStores.map(subStore => subStore!.$onChange(() => setN(nn => nn + 1)));
        return () => listeners.forEach(unsubscribe => unsubscribe());
      }, [keys, store]);

      const stateProxy = useMemo(() => new Proxy({}, {
        get(_, p: string) {
          keys.add(p);
          return refs.current.store.$state[p]!;
        }
      }), [keys]);

      return useMemo(() => new Proxy({} as CreateUseStoreHookGlobal<S>, {
        get(_, p: string) {
          if (p === 'state')
            return stateProxy;
          if (p === 'store')
            return store;
          throw new Error(`Property ${p} does not exist on store`);
        },
      }), [stateProxy, store]);
    },
    useLocalStore: <Key extends string, Patch extends BasicRecord>(key: Key, state: Patch) => {
      // get store context and create refs
      const store = useContext(context)!;
      const refs = useRef({ store, key, state, subStore: undefined as CreateUseStoreHookLocal<Patch> | undefined });
      const keys = useMemo(() => new Set<string>(), []);

      // create substore if needed
      if (!store.$state[key])
        (store[key]! as SetNewNode).$setNew(refs.current.state);

      // ensure that store changes result in rerender
      const [, setN] = useState(0);
      useEffect(() => {
        const unsubscribe = store[key]?.$onChange(() => setN(nn => nn + 1));
        return () => unsubscribe();
      }, [key, keys, store]);

      const storeMemo = useMemo(() => {
        return store[key!]!;
      }, [key, store]);

      return useMemo(() => new Proxy({} as CreateUseStoreHookLocal<Patch>, {
        get(_, p: string) {
          if (p === 'state')
            return storeMemo.$state;
          if (p === 'local')
            return storeMemo;
          throw new Error(`Property ${p} does not exist on store`);
        },
      }), [storeMemo]);
    }
  };
}

// const appStore = createStore({ one: '' });
// const storeContext = createContext(appStore);
// const useStore = createUseStoreHook(storeContext);
// const { store, state } = useStore('two', { child: 'val' });
// console.log(store.$state.$local);
