// We are disabling the above rule because we can be sure that hooks are called in the correct
// order due to the fact that the library functions will always be chained the same way
import {
  BasicRecord,
  DeepReadonly,
  Derivation,
  SetNewNode,
  SortableProperty,
  SortMemo,
  Store
} from 'olik';
import { useEffect, useMemo, useRef, useState } from 'react';




export function createStoreHooks<
  S extends BasicRecord
>(
  store: Store<S>,
) {
  return {
    useStore: () => {
      // get store context and create refs
      const refs = useRef({ store });
      const keys = useMemo(() => new Set<string>(), []);

      // ensure that store changes result in rerender
      const [, setN] = useState(0);
      useEffect(() => {
        const rootSubStores = [...keys].map(k => store[k]);
        const subStores = rootSubStores;
        const listeners = subStores.map(subStore => subStore!.$onChange(() => setN(nn => nn + 1)));
        return () => listeners.forEach(unsubscribe => unsubscribe());
      }, [keys]);

      return useMemo(() => new Proxy({} as DeepReadonly<S>, {
        get(_, p: string) {
          keys.add(p);
          return refs.current.store.$state[p]!;
        }
      }), [keys]);
    },

    useLocalStore: <Key extends string, Patch extends BasicRecord>(key: Key, state: Patch) => {
      // get store context and create refs
      const refs = useRef({ store, key, state, subStore: undefined as unknown });

      // ensure that store changes result in rerender
      const [, setN] = useState(0);
      useEffect(() => {
        return store[key]?.$onChange(() => setN(nn => nn + 1));
      }, [key]);

      // create a memo of the store, and set the new state if it doesn't exist
      const storeMemo = useMemo(() => {
        if (!store.$state[key])
          (store[key]! as SetNewNode).$setNew(refs.current.state);
        return store[key!]!;
      }, [key]);

      return useMemo(() => new Proxy({} as { local: Store<Patch>, state: DeepReadonly<Patch> }, {
        get(_, p: string) {
          if (p === 'state')
            return storeMemo.$state;
          if (p === 'local')
            return storeMemo;
          throw new Error(`Property ${p} does not exist on store`);
        },
      }), [storeMemo]);
    },
  }
}

export const createDerivationHooks = <D extends { [key: string]: Derivation<unknown> | SortMemo<BasicRecord | SortableProperty> }>(
  derivations: D
) => {
  return {
    useDerivations: () => {
      const refs = useRef({ derivations });
      const [, setN] = useState(0);
      useEffect(() => {
        const listeners = Object.keys(refs.current.derivations).map(key => refs.current.derivations[key]!.$onChange(() => setN(nn => nn + 1)));
        return () => listeners.forEach(unsubscribe => unsubscribe());
      }, []);
      return useMemo(() => new Proxy({} as { [k in keyof D]: D[k] extends { $state: infer S } ? S : never }, {
        get(_, p: string) {
          return refs.current.derivations[p]!.$state;
        }
      }), []);
    }
  }
}