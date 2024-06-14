// We are disabling the above rule because we can be sure that hooks are called in the correct
// order due to the fact that the library functions will always be chained the same way
import {
  BasicRecord,
  createStore,
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


export function createStoreHooks<
  S extends BasicRecord,
>(
  state: S,
): {
  useStore: () => CreateUseStoreHookGlobal<S>,
  useLocalStore: UseLocalStore,
};

export function createStoreHooks<
  S extends BasicRecord,
  D extends (str: Store<S>) => Derivations
>(
  state: S,
  getDerivations: D
): {
  useStore: () => CreateUseStoreHookGlobal<S> & WithDerivations<ReturnType<D>>,
  useLocalStore: UseLocalStore,
}

export function createStoreHooks<
  S extends BasicRecord,
  D extends (str: Store<S>) => Derivations
>(
  state: S,
  getDerivations?: D
) {
  const store = createStore(state);
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

      const [der, setDer] = useState((() => {
        if (!getDerivations) return undefined;
        const derivations = getDerivations(store);
        return Object.keys(derivations).reduce((acc, key) => ({ ...acc, [key]: derivations[key]!.$state }), {});
      }));
      useEffect(() => {
        if (!getDerivations) return;
        const derivations = getDerivations(store);
        const listeners = Object.keys(derivations).map(key => derivations[key]!.$onChange(items => setDer(old => ({ ...old, [key]: items }))));
        return () => listeners.forEach(unsubscribe => unsubscribe());
      }, []);

      return useMemo(() => new Proxy({} as CreateUseStoreHookGlobal<S> & WithDerivations<ReturnType<D>>, {
        get(_, p: string) {
          if (p === 'state')
            return stateProxy;
          if (p === 'store')
            return store;
          if (p === 'derivations')
            return der;
          throw new Error(`Property ${p} does not exist on store`);
        },
      }), [stateProxy, der]);
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
          (store[key]! as SetNewNode).$setNew(refs.current.state);
        return store[key!]!;
      }, [key]);

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


// const store = createStore({ one: '', two: [1, 2, 3] });
// const { useStore, useLocalStore } = createUseStoreHook(store, {
//   one: store.two.$createSortedList.$ascending(),
// });
// const { derivations: { one } } = useStore();
// const { local, state } = useLocalStore('ssss', { helllllo: '' });
// local.
