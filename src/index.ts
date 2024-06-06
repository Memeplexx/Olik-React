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
          let valueCalculated: boolean;
          return inputRef.current.$onChange(arg => {
            valueCalculated = false;
            Promise.resolve().then(() => { // wait for all other change listeners to fire
              if (valueCalculated) { return; }
              valueCalculated = true;
              setValue(arg);
            })
          });
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

      // ensure that store changes result in rerender
      const [, setN] = useState(0);
      useEffect(() => {
        return store[key]?.$onChange(() => setN(nn => nn + 1));
      }, [key, store]);

      // create a memo of the store, and set the new state if it doesn't exist
      const storeMemo = useMemo(() => {
        if (!store.$state[key])
          (store[key]! as SetNewNode).$setNew(refs.current.state);
        return store[key!]!;
      }, [key, store]);

      // destroy store as required. Note that care needed to be taken to avoid double-add-remove behavior in React strict mode
      const effectRun = useRef(false);
      useEffect(() => {
        effectRun.current = true;
        if (!store.$state[key])
          (store[key]! as SetNewNode).$setNew(refs.current.state);
        return () => {
          effectRun.current = false;
          Promise.resolve().then(() => {
            if (!effectRun.current)
              store[key].$delete();
          }).catch(console.error);
        }
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
