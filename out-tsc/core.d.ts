import React from 'react';
import * as core from 'olik';
export * from 'olik';
export declare const createApplicationStore: typeof core['createApplicationStore'];
export declare const createApplicationStoreEnforcingTags: typeof core['createApplicationStoreEnforcingTags'];
export declare const createComponentStore: typeof core['createComponentStore'];
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
export declare const useComponentStore: <C>(initialState: C, options: core.OptionsForMakingAComponentStore) => core.SelectorFromAComponentStore<C>;
