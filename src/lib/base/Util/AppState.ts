import { writable } from 'svelte/store';
import { config, userSettingsLabels } from '../../../config/config';
import type { AnyParamValueType } from '../ParamConfig/ParamTypes';
import { persisted } from 'svelte-local-storage-store';

/**
 * Custom Svelte store that wraps the config object and persists config values
 * that are specified in userSettingsLabels to local storage.
 */
function createSettingsStore() {
    // Restore only values that are specified in userSettingsLabels
    let initialState: Record<string, AnyParamValueType> = config;
    const resetState = () => {
        initialState = config;
        for (const key in userSettingsLabels) {
            // Use the new value in the backing file if it's been changed
            const fileValue = JSON.stringify(initialState[key]);
            const lastFileValue = localStorage.getItem(`lastFileValue_${key}`);
            localStorage.setItem(`lastFileValue_${key}`, fileValue);
            if (lastFileValue && lastFileValue !== fileValue) {
                localStorage.setItem(key, fileValue);
                continue;
            }

            // Otherwise, use the value in local storage
            initialState[key] = JSON.parse(localStorage.getItem(key) || fileValue);
        }
    };
    resetState();

    // Create the backing store, using typeof config for member completion
    const { subscribe, set } = writable(initialState as typeof config);

    // Persist only values that are specified in userSettingsLabels
    const setAndPersist = (state: Record<string, AnyParamValueType>) => {
        for (const key in userSettingsLabels) {
            localStorage.setItem(key, JSON.stringify(state[key]));
        }
        set(state as typeof config);
    };

    // Reset the store to the initial state (closure ftw)
    const reset = () => {
        resetState();
        set(initialState as typeof config);
    };

    return {
        subscribe,
        set: setAndPersist,
        reset
    };
}

// Create and export stores for app settings and state
const settingsStore = createSettingsStore();
const stateStore = persisted('state', {
    projectListState: config.defaultProjectListState,
    projectDetailState: config.defaultProjectDetailState,
    selectedProjectKey: '',
    selectedGroupName: ''
});
export { settingsStore, stateStore };