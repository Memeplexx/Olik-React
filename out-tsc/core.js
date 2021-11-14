/* eslint-disable react-hooks/rules-of-hooks */
// We are disabling the above rule because we can be sure that hooks are called in the correct
// order due to the fact that the library functions will always be chained the same way
import React from 'react';
import * as core from 'olik';
export * from 'olik';
var rootSelect;
export var createApplicationStore = function (state, options) {
    augementCore();
    rootSelect = core.createApplicationStore(state, options);
    return rootSelect;
};
export var createApplicationStoreEnforcingTags = function (state, options) {
    augementCore();
    rootSelect = core.createApplicationStoreEnforcingTags(state, options);
    return rootSelect;
};
export var createComponentStore = function (state, options) {
    augementCore();
    return core.createComponentStore(state, options);
};
var coreHasBeenAgmented = false;
var augementCore = function () {
    if (coreHasBeenAgmented) {
        return;
    }
    coreHasBeenAgmented = true;
    core.augment({
        selection: {
            useState: function (input) {
                return function (deps) {
                    if (deps === void 0) { deps = []; }
                    var inputRef = React.useRef(input);
                    var _a = React.useState(inputRef.current.read()), value = _a[0], setValue = _a[1];
                    var depsString = JSON.stringify(deps);
                    React.useEffect(function () {
                        inputRef.current = input;
                        setValue(input.read());
                        var subscription = inputRef.current.onChange(function (arg) { return setValue(arg); });
                        return function () { return subscription.unsubscribe(); };
                    }, [depsString]);
                    return value;
                };
            },
        },
        derivation: {
            useState: function (input) {
                return function (deps) {
                    if (deps === void 0) { deps = []; }
                    var inputRef = React.useRef(input);
                    var _a = React.useState(inputRef.current.read()), value = _a[0], setValue = _a[1];
                    var depsString = JSON.stringify(deps);
                    React.useEffect(function () {
                        inputRef.current = input;
                        setValue(input.read());
                        var subscription = inputRef.current.onChange(function (arg) { return setValue(arg); });
                        return function () { return subscription.unsubscribe(); };
                    }, [depsString]);
                    return value;
                };
            },
        },
        future: {
            useFuture: function (input) {
                return function (deps) {
                    if (deps === void 0) { deps = []; }
                    var _a = React.useState(input.getFutureState()), state = _a[0], setState = _a[1];
                    var depsString = JSON.stringify(deps);
                    React.useEffect(function () {
                        // Call promise
                        var running = true;
                        input
                            .then(function () { if (running) {
                            setState(input.getFutureState());
                        } })
                            .catch(function () { if (running) {
                            setState(input.getFutureState());
                        } });
                        // update state because there may have been an optimistic update
                        setState(input.getFutureState());
                        return function () { running = false; };
                    }, [depsString]);
                    return state;
                };
            }
        }
    });
};
export var useComponentStore = function (initialState, options) {
    var stateRef = React.useRef(initialState);
    var optionsRef = React.useRef(options);
    var select = React.useMemo(function () { return createComponentStore(stateRef.current, optionsRef.current); }, []);
    var selectRef = React.useRef(select);
    React.useEffect(function () {
        var _a, _b;
        // When the user saves their app (causing a hot-reload) the following sequence of events occurs:
        // hook is run, useMemo (store is created), useEffect, useEffect cleanup (store is detached), hook is run, useMemo is NOT rerun (so store is NOT recreated).
        // This causes the app to consume an orphaned selectRef.current which causes an error to be thrown.
        // The following statement ensures that, should a nested store be orphaned, it will be re-attached to its application store
        if (!((_b = (_a = rootSelect === null || rootSelect === void 0 ? void 0 : rootSelect().read().cmp) === null || _a === void 0 ? void 0 : _a[optionsRef.current.componentName]) === null || _b === void 0 ? void 0 : _b[optionsRef.current.instanceName])) {
            selectRef.current = createComponentStore(selectRef.current().read(), optionsRef.current);
        }
        return function () { return selectRef.current().detachFromApplicationStore(); };
    }, []);
    return selectRef.current;
};
