import {
    importProjectClassFiles,
    importProjectTextFiles,
    importProjectConfigFiles,
    importRawProjectFiles
} from './ImportProviders';
import Project from '../Project/Project';
import { type ProjectConfig, ProjectConfigDefaults } from '../ConfigModels/ProjectConfig';
import type { ParamConfig } from '../ConfigModels/ParamConfig';
import { ProjectConfigFactory } from './ProjectConfigFactory';
import ParamValueProvider from './ParamValueProvider';
import { browser, dev } from '$app/environment';
import FragShaderProject from '../Project/FragShaderProject';
import { InferenceMode } from './ParamInference';
import {
    NumericArrayParamStyle,
    isNumericArray
} from '../ConfigModels/ParamConfigs/NumericArrayParamConfig';
import { ParamGuards, type AnyParamValueType } from '../ConfigModels/ParamTypes';
import type { PresetMap } from './PresetLoader';
import PresetLoader, { defaultPresetKey } from './PresetLoader';
import ColorConversions from '../Util/ColorConversions';
import { content } from '$config/content';

export interface ProjectTuple {
    key: string;
    project: Project;
    config: ProjectConfig;
    params: ParamConfig[];
    presets: PresetMap;
}

// Type to match the Project constructor
type ProjectModule = {
    default: new () => Project;
};

// Types for all project file imports
type ImportResult = Record<string, () => Promise<unknown>>;
type AllImports = {
    projectClassFiles: ImportResult;
    projectTextFiles: ImportResult;
    projectFilesRaw: ImportResult;
    projectConfigFiles: ImportResult;
};

export default class ProjectLoader {
    /**
     * Load a collection of available projects as a map of project keys to ProjectConfig objects.
     * @returns A map of project keys to ProjectProperties objects.
     */
    public static async loadAvailableProjects(): Promise<Record<string, ProjectConfig>> {
        // Vite glob imports for project files
        const allImports: AllImports = {
            projectClassFiles: importProjectClassFiles(),
            projectTextFiles: importProjectTextFiles(),
            projectFilesRaw: importRawProjectFiles(),
            projectConfigFiles: importProjectConfigFiles()
        };

        // Collect configuration data from config files, where available
        const projectConfigurations: Record<string, Record<string, unknown>> = {};
        for (const path in allImports.projectConfigFiles) {
            // Find the project key from the directory name
            const projectKey = ProjectLoader.#keyFromConfigPath(path);

            // Deserialize the config file into a ProjectConfig object
            const rawConfig = (await allImports.projectConfigFiles[path]()) as string;
            try {
                projectConfigurations[projectKey] = JSON.parse(rawConfig);
            } catch (e) {
                // Don't throw an error; we can still use inferred config data
                if (dev && import.meta.env.MODE !== 'test')
                    console.error(`Error parsing config.json for ${projectKey}`);
                continue;
            }
        }

        // Collect projects from class files and assign config data if any
        const availableProjects: Record<string, ProjectConfig> = {};
        const projectPaths = Object.keys(allImports.projectClassFiles).concat(
            Object.keys(allImports.projectTextFiles)
        );
        for (const path of projectPaths) {
            // Find the project key from the file name
            const projectKey = ProjectLoader.#keyFromProjectPath(path);

            // Project files are named the same as their containing folder; skip other files
            const pathComponents = path.split('/');
            if (projectKey && pathComponents.indexOf(projectKey) < 0) continue;

            // Check to make sure we can load this project
            const projectValid = await ProjectLoader.#validateProject(
                allImports.projectFilesRaw,
                path
            );
            if (!projectValid) continue;

            // Create a new config for this project if it doesn't already exist
            availableProjects[projectKey] = ProjectConfigFactory.projectConfigFrom(
                projectConfigurations[projectKey]
            );

            // Assign the project title if unset
            if (availableProjects[projectKey].title === ProjectConfigDefaults.title) {
                availableProjects[projectKey].title = projectKey;
            }
        }

        return availableProjects;
    }

    /**
     * Fully load the project (Project subclass instance) corresponding to a particular project key.
     * @param key - the project key.
     * @returns a ProjectTuple object containing the project, its properties, and its params.
     * May also return a Partial<ProjectTuple> with only the key and config, since we don't want to
     * import the project class files in SSR.
     */
    public static async loadProject(key: string): Promise<Partial<ProjectTuple> | null> {
        // Vite glob imports for project files
        const allImports: AllImports = {
            projectClassFiles: importProjectClassFiles(),
            projectTextFiles: importProjectTextFiles(),
            projectFilesRaw: importRawProjectFiles(),
            projectConfigFiles: importProjectConfigFiles()
        };

        // Load files and find the project file path
        const projectConfigFiles = importProjectConfigFiles();
        const classFilePath = Object.keys(allImports.projectClassFiles).filter((path) => {
            return ProjectLoader.#keyFromProjectPath(path) === key;
        })[0];
        const textFilePath = Object.keys(allImports.projectTextFiles).filter((path) => {
            return ProjectLoader.#keyFromProjectPath(path) === key;
        })[0];

        // Get configuration JSON from config file (if any)
        const configFilePath = Object.keys(projectConfigFiles).filter((path) => {
            return ProjectLoader.#keyFromConfigPath(path) === key;
        })[0];
        let configJSON = undefined;
        if (configFilePath) {
            try {
                const rawConfig = (await projectConfigFiles[configFilePath]()) as string;
                configJSON = JSON.parse(rawConfig);
            } catch (e) {
                // Don't throw an error; we can still use inferred config data
                if (dev && import.meta.env.MODE !== 'test')
                    console.error(`Error parsing config.json for ${key}`);
            }
        }

        // Derive project config
        const projectConfig = ProjectConfigFactory.projectConfigFrom(
            configJSON as Record<string, unknown> | undefined
        );

        // Assign the project title and ogImage if unset
        if (projectConfig.title === ProjectConfigDefaults.title) {
            projectConfig.title = key;
        }
        if (projectConfig.ogImage === ProjectConfigDefaults.ogImage) {
            projectConfig.ogImage = `${key}.png`;
        }

        // Instantiate the proper project, or return early if we're in SSR
        if (!classFilePath && !textFilePath) return null;
        let project: Project | undefined;
        if (browser) {
            project = await ProjectLoader.#loadProject(allImports, classFilePath || textFilePath);
        } else {
            return {
                key,
                config: projectConfig
            };
        }

        // Collect param configs
        const rawFileText = (await allImports.projectFilesRaw[
            classFilePath || textFilePath
        ]()) as string;
        const inferenceMode = projectConfig.explicitConfig
            ? InferenceMode.None
            : classFilePath != undefined
            ? InferenceMode.ProjectFile
            : InferenceMode.ShaderFile;
        const paramConfigs = ProjectConfigFactory.paramConfigsFrom(
            project,
            rawFileText,
            inferenceMode,
            configJSON?.params as Record<string, Record<string, unknown>> | undefined,
            projectConfig.paramsApplyDuringInput
        );

        // Load presets for this project, and create a default preset if none exists
        const projectPresets = await PresetLoader.loadPresets(key);
        if (!projectPresets[defaultPresetKey]) {
            projectPresets[defaultPresetKey] = {
                key: defaultPresetKey,
                title: content.defaultPresetTitle,
                values: {}
            };
        } else if (projectPresets[defaultPresetKey].title === defaultPresetKey) {
            projectPresets[defaultPresetKey].title = content.defaultPresetTitle;
        }

        // Apply param config defaults (explicit/inferred) and preset defaults w/ compatible configs
        for (const paramConfig of paramConfigs) {
            // Defining these directly on the project object (instead of just using them when
            // setting values below) allows ParamValueProvider to update provided values when
            // config values change, as it does when assigned values change in project files.

            // If there's no default value to be had, proceed
            if (!ParamGuards.isConfigTypeWithDefault(paramConfig)) continue;

            // Get the current value
            const currentValue = Object.getOwnPropertyDescriptor(project, paramConfig.key)?.value;
            let newValue = currentValue;

            // Helper function to validate types for new values
            const validatedType = (value: unknown): AnyParamValueType => {
                // Allow hex values to be used for color numeric array params
                if (
                    ParamGuards.isNumericArrayParamConfig(paramConfig) &&
                    typeof value === 'string' &&
                    value.match(/^#[0-9a-f]{6}$/i)
                ) {
                    if (
                        [
                            NumericArrayParamStyle.ByteColor,
                            NumericArrayParamStyle.UnitColor
                        ].includes(paramConfig.style)
                    ) {
                        return ColorConversions.hexToRgb(
                            value,
                            paramConfig.style === NumericArrayParamStyle.UnitColor
                        );
                    } else {
                        throw new Error(
                            `Default value for ${paramConfig.key} has incorrect type: hex strings can only be assigned for numeric arrays with color style.`
                        );
                    }
                }
                // Assert that the values are the same type
                if (typeof value !== typeof currentValue) {
                    throw new Error(
                        `Default value for ${paramConfig.key} has incorrect type: ${typeof value}`
                    );
                }
                // Assert that new value is the proper size, if it's an array
                if (isNumericArray(value) && isNumericArray(currentValue)) {
                    if (value.length !== currentValue.length) {
                        throw new Error(
                            `Default value for ${paramConfig.key} has incorrect length: ${value.length}`
                        );
                    }
                }
                return value as AnyParamValueType;
            };

            // Apply explicit and inferred config defaults
            const configDefault = paramConfig.default;
            if (configDefault !== undefined) {
                newValue = validatedType(configDefault);
            }

            // Apply preset defaults, or create them if they don't exist
            const presetDefault = projectPresets[defaultPresetKey].values[paramConfig.key];
            if (presetDefault !== undefined) {
                newValue = validatedType(presetDefault);
            } else {
                projectPresets[defaultPresetKey].values[paramConfig.key] = newValue;
            }

            // Define the property
            if (newValue !== currentValue) {
                Object.defineProperty(project, paramConfig.key, {
                    value: newValue,
                    writable: true,
                    enumerable: true,
                    configurable: true
                });
            }
        }

        // Set project properties to stored values (overriding defaults)
        for (const param of paramConfigs) {
            const storedValue = ParamValueProvider.getValue(param, key, project, true);
            if (typeof storedValue === 'function') continue;
            Object.defineProperty(project, param.key, {
                value: storedValue,
                writable: true,
                enumerable: true,
                configurable: true
            });
        }

        // Return tuple
        return {
            key,
            project,
            config: projectConfig,
            params: paramConfigs,
            presets: projectPresets
        };
    }

    /**
     * Validate a potential project import via its text representation, so we can do this in SSR
     * without actually importing the project class files or its dependencies, e.g. P5, which can't
     * be imported in a node context.
     */
    static async #validateProject(rawImports: ImportResult, filePath: string): Promise<boolean> {
        const rawProjectModule = rawImports[filePath];
        const rawProject: string = (await rawProjectModule()) as string;
        // These checks are an extreme MVP; we could do more sophisticated validation here.
        // Proper validation is done in #loadProject, so at the very least we'll catch errors there.
        if (filePath.includes('.ts') || filePath.includes('.js')) {
            return rawProject.includes('export default class') && rawProject.includes('extends');
        } else if (filePath.includes('.frag')) {
            return rawProject.includes('void main');
        }
        return true;
    }

    static async #loadProject(fromImports: AllImports, filePath: string): Promise<Project> {
        if (filePath.includes('.ts') || filePath.includes('.js')) {
            const module = (await fromImports.projectClassFiles[filePath]()) as ProjectModule;
            if (!module.default) {
                // The project file must export a default class
                throw new Error(`No default export for ${filePath}`);
            }
            const project = new module.default();
            if (!(project instanceof Project)) {
                // The project must be a subclass of Project
                throw new Error(
                    `Project class file at path ${filePath} is not a subclass of Project`
                );
            }
            return project;
        } else if (filePath.includes('.frag')) {
            const fragShader: string = (await fromImports.projectTextFiles[filePath]()) as string;
            return new FragShaderProject(fragShader);
        } else {
            throw new Error(`Unsupported project class file type for path: ${filePath}`);
        }
    }

    static #keyFromProjectPath(path: string): string {
        const pathComponents = path.split('/');
        const projectKey = pathComponents.pop()?.split('.')[0];
        if (!projectKey) throw new Error(`Failure to parse project key from project path: ${path}`);
        return projectKey;
    }

    static #keyFromConfigPath(path: string): string {
        const pathComponents = path.split('/');
        const projectKey = pathComponents[pathComponents.length - 2];
        if (!projectKey) throw new Error(`Failure to parse project key from config path: ${path}`);
        return projectKey;
    }
}
