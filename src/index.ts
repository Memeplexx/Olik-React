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


export type CreateUseStoreHookLocal<S extends BasicRecord> = { local: Store<S>, state: DeepReadonly<S> };

export type CreateUseStoreHookGlobal<S extends BasicRecord> = { store: Store<S>, state: DeepReadonly<S> };

export type Derivations = { [key: string]: Derivation<unknown> | SortMemo<BasicRecord | SortableProperty> };

export type WithDerivations<D extends Derivations> = { derivations: { [k in keyof D]: D[k]['$state'] } };

export type UseLocalStore = <Key extends string, Patch extends BasicRecord>(key: Key, state: Patch) => CreateUseStoreHookLocal<Patch>;

export type UseStore = <S extends BasicRecord, D extends Derivations>() => CreateUseStoreHookGlobal<S> & WithDerivations<D>;


export function createUseStoreHooks<
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

      const stateProxy = useMemo(() => new Proxy({}, {
        get(_, p: string) {
          keys.add(p);
          return refs.current.store.$state[p]!;
        }
      }), [keys]);

      return useMemo(() => new Proxy({} as CreateUseStoreHookGlobal<S> /*& WithDerivations<D>*/, {
        get(_, p: string) {
          if (p === 'state')
            return stateProxy;
          if (p === 'store')
            return store;
          throw new Error(`Property ${p} does not exist on store`);
        },
      }), [stateProxy]);
    },

    useLocalStore: (<Key extends string, Patch extends BasicRecord>(key: Key, state: Patch) => {
      // get store context and create refs
      const refs = useRef({ store, key, state, subStore: undefined as CreateUseStoreHookLocal<Patch> | undefined });

      // ensure that store changes result in rerender
      const [, setN] = useState(0);
      useEffect(() => {
        return store[key]?.$onChange(() => setN(nn => nn + 1));
      }, [key]);

      // create a memo of the store, and set the new state if it doesn't exist
      const storeMemo = useMemo(() => {
        if (!store.$state[key])
          (store[key]! as SetNewNode<false>).$setNew(refs.current.state);
        return store[key!]!;
      }, [key]);

      return useMemo(() => new Proxy({}, {
        get(_, p: string) {
          if (p === 'state')
            return storeMemo.$state;
          if (p === 'local')
            return storeMemo;
          throw new Error(`Property ${p} does not exist on store`);
        },
      }), [storeMemo]);
    }) as UseLocalStore,
  }
}

export const createUseDerivationHooks = <D extends Derivations>(
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