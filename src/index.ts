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
  StoreDef,
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


export type ReactStoreDef<State extends BasicRecord, Patch extends { key: string, value: BasicRecord }> = {
  store: StoreDef<State & { [key in Patch['key']]: Patch['value'] }>,
  localStore: StoreDef<Patch['value']>,
  localState: Patch['value'],
} & DeepReadonly<{ [key in keyof State]: State[key] }>;

export const createUseStoreHook = <S extends BasicRecord>(context: Context<StoreDef<S> | undefined>) => {
  return <Key extends string, Patch extends { key: Key, value: BasicRecord }>(patch?: Patch) => {
    const store = useContext(context)! as unknown as { $state: S, $setNew: (patch: Patch) => void } & { [key: string]: { $useState: () => unknown } };
    void useMemo(function createSubStore() {
      if (!patch)
        return;
      // prevent react.strictmode from setting state twice
      if (store.$state[patch.key] !== undefined)
        return;
      (store[patch.key] as unknown as SetNewNode).$setNew(patch.value);
    }, [patch, store]);
    return new Proxy({} as ReactStoreDef<S, Patch>, {
      get(_, p) {
        if (p === 'store')
          return store;
        if (patch) {
          if (p === 'localStore')
            return store[patch.key];
          if (p === 'localState')
            return store[patch.key].$useState();
        }
        return store[p as string]!.$useState();
      },
    });
  }
}
