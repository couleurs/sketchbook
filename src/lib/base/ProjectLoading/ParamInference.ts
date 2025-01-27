import type { ParamConfig } from '../ConfigModels/ParamConfig';
import { FileReaderMode } from '../ConfigModels/ParamConfigs/FileParamConfig';
import { NumberParamStyle } from '../ConfigModels/ParamConfigs/NumberParamConfig';
import { NumericArrayParamStyle } from '../ConfigModels/ParamConfigs/NumericArrayParamConfig';
import { StringParamStyle } from '../ConfigModels/ParamConfigs/StringParamConfig';
import { ParamGuards } from '../ConfigModels/ParamTypes';
import ColorConversions from '../Util/ColorConversions';

export enum InferenceMode {
    ProjectFile,
    ShaderFile,
    None
}

type Intentions = {
    name?: string;
    range?: [number, number];
    step?: number;
    numberValues: number[];
    booleanValues: boolean[];
    numericArrayValues: number[][];
    metaStrings: string[];
};

/**
 * ParamInference provides methods for "inferring" parameter configurations and values from inline
 * comments in project files (either ts/js or .frag shaders), evaluated in context with what we
 * already know about a given parameter (its type, and its key, if enabled) . This enables creators
 * to quickly configure the basics in a project with simple commented syntax, without needing to set
 * up detailed configs.
 */
export default class ParamInference {
    static paramAnnotations(
        paramKeys: string[],
        mode: InferenceMode,
        rawFileText: string
    ): Record<string, string> {
        if (mode === InferenceMode.None) return {};

        const lines = rawFileText.split('\n');
        const annotations: Record<string, string> = {};
        let keyForNextLine: string | undefined;
        for (const line of lines) {
            const comment = line.match(/\/\/\s*(.*)/);
            // Look for an annotation on the next line, after a function definition
            if (comment && comment.length > 1 && keyForNextLine) {
                annotations[keyForNextLine] = comment[1];
            }
            keyForNextLine = undefined;

            // Find definition lines that contain the key
            for (const key of paramKeys) {
                const definitionMatcher =
                    mode === InferenceMode.ShaderFile
                        ? `.*uniform.*${key}`
                        : `(${key}\\s*[:=])|(this.${key}\\s*[:=])`;

                if (line.match(new RegExp(definitionMatcher))) {
                    // If we find a match, extract the comment
                    if (comment && comment.length > 1) annotations[key] = comment[1];
                    // Otherwise if this line contains a function definition, use next line
                    else if (line.match(/.*\)\s*=>\s*\{\s*$/)) keyForNextLine = key;
                }
            }

            // Break early if we've collected all possible annotations
            if (Object.keys(annotations).length === paramKeys.length) break;
        }
        return annotations;
    }

    static paramWithInference(
        initialConfig: ParamConfig,
        mode: InferenceMode,
        comment: string | undefined
    ): ParamConfig {
        if (mode === InferenceMode.None) return initialConfig;

        // Fill out a config and value with inferred values, if available
        const newConfig = { ...initialConfig };
        const intentions = comment ? this.intentionsFrom(comment) : undefined;

        // Assign name token
        if (intentions?.name) {
            newConfig.name = intentions.name;
        }

        // Assign range and step tokens for numeric param types
        if (
            ParamGuards.isNumberParamConfig(newConfig) ||
            ParamGuards.isNumericArrayParamConfig(newConfig)
        ) {
            if (intentions?.range) {
                const [min, max] = intentions.range;
                newConfig.min = min;
                newConfig.max = max;
            }
            if (intentions?.step) newConfig.step = intentions.step;
        }

        // If we're parsing a shader, assign default values in supported param types
        if (mode === InferenceMode.ShaderFile) {
            // Assign number value tokens
            if (ParamGuards.isNumberParamConfig(newConfig) && intentions?.numberValues?.length) {
                newConfig.default = Number(intentions.numberValues[0]);
            }

            // Assign boolean value tokens
            if (ParamGuards.isBooleanParamConfig(newConfig) && intentions?.booleanValues?.length) {
                newConfig.default = intentions.booleanValues[0];
            }

            // Assign numeric array value tokens via numeric array or hex string
            const hexMetaString = intentions?.metaStrings?.find((meta) =>
                meta.match(/^#([0-9a-f]{6})$/i)
            );
            if (ParamGuards.isNumericArrayParamConfig(newConfig)) {
                if (intentions?.numericArrayValues?.length) {
                    newConfig.default = intentions.numericArrayValues[0];
                } else if (hexMetaString) {
                    newConfig.default = ColorConversions.hexToRgb(hexMetaString, true);
                }
            }
        }

        // Infer styles, modes, etc from stringTokens and the parameter key
        const configWithStyle = this.assignMeta(newConfig, intentions?.metaStrings);

        return configWithStyle;
    }

    // Helper functions, public for easy unit testing

    static assignMeta(config: ParamConfig, metaStrings: string[] | undefined): ParamConfig {
        // Interpret meta strings as styles, modes, etc, depending on the parameter type
        const applyString = (metaString: string) => {
            if (ParamGuards.isNumberParamConfig(config)) {
                if (metaString.includes('combo')) config.style = NumberParamStyle.Combo;
                else if (metaString.includes('slider')) config.style = NumberParamStyle.Slider;
                else if (metaString.includes('field')) config.style = NumberParamStyle.Field;
            } else if (ParamGuards.isNumericArrayParamConfig(config)) {
                if (metaString.includes('combo')) config.style = NumericArrayParamStyle.Combo;
                else if (metaString.includes('compact') && metaString.includes('slider'))
                    config.style = NumericArrayParamStyle.CompactSlider;
                else if (metaString.includes('slider'))
                    config.style = NumericArrayParamStyle.Slider;
                else if (metaString.includes('compact') && metaString.includes('field'))
                    config.style = NumericArrayParamStyle.CompactField;
                else if (metaString.includes('field')) config.style = NumericArrayParamStyle.Field;
                else if (metaString.includes('unit') && metaString.includes('color'))
                    config.style = NumericArrayParamStyle.UnitColor;
                else if (metaString.includes('byte') && metaString.includes('color'))
                    config.style = NumericArrayParamStyle.ByteColor;
                // shorthand: "compact" implies "compactslider", "color" implies "unitcolor"
                else if (metaString.includes('compact'))
                    config.style = NumericArrayParamStyle.CompactSlider;
                else if (metaString.includes('color'))
                    config.style = NumericArrayParamStyle.UnitColor;
            } else if (ParamGuards.isStringParamConfig(config)) {
                if (metaString.includes('single')) config.style = StringParamStyle.SingleLine;
                else if (metaString.includes('multi')) config.style = StringParamStyle.MultiLine;
                else if (metaString.includes('color')) config.style = StringParamStyle.Color;
            } else if (ParamGuards.isFileParamConfig(config)) {
                if (metaString.includes('arraybuffer')) config.mode = FileReaderMode.ArrayBuffer;
                else if (metaString.includes('binarystring'))
                    config.mode = FileReaderMode.BinaryString;
                else if (metaString.includes('dataurl')) config.mode = FileReaderMode.DataURL;
                else if (metaString.includes('text')) config.mode = FileReaderMode.Text;
                else if (metaString.includes('image')) config.mode = FileReaderMode.Image;
                if (metaString.includes('multi')) config.multiple = true;
            } else if (ParamGuards.isFunctionParamConfig(config)) {
                // No-op; function params have no meta assignments at the moment
            } else if (ParamGuards.isBooleanParamConfig(config)) {
                // No-op; boolean params have no meta assignments at the moment
            }
        };

        // First apply key name as a meta string
        applyString(config.key.toLowerCase());

        // Then assign annotations as meta strings
        if (metaStrings) {
            for (const potentialMeta of metaStrings) {
                applyString(potentialMeta.toLowerCase());
            }
        }

        return config;
    }

    static intentionsFrom(parseString: string): Intentions {
        // Split on commas, don't include whitespace, ignore commas inside square brackets
        const stringTokens = parseString.trim().split(/\s*,\s*(?![^[]*])/);

        // Collect tokens that match intention patterns
        const nameTokens = stringTokens.filter((token) => token.match(/^["']([^"']*)["']$/));
        const rangeTokens = stringTokens.filter((token) =>
            token.match(/^(-?\d*\.{0,1}\d+)\s*to\s*(-?\d*\.{0,1}\d+)$/)
        );
        const stepTokens = stringTokens.filter((token) =>
            token.match(/(^step\s*\d*\.{0,1}\d+$)|(^\d*\.{0,1}\d+\s*step$)/)
        );
        const numberTokens = stringTokens.filter((token) =>
            token.match(/^(-?\d*\.{0,1}\d+)(?![^[]*])$/)
        );
        const booleanTokens = stringTokens.filter((token) => token.match(/^(true|false)$/));
        const numericArrayTokens = stringTokens.filter((token) =>
            token.match(/^\[(\s*-?\d*\.{0,1}\d+\s*,\s*)+(\s*-?\d*\.{0,1}\d+\s*)\]$/)
        );
        const potentialMetaTokens = stringTokens.filter(
            (token) =>
                token.match(/(^[a-zA-Z]+$)|(^#([0-9a-fA-F]{6})$)/) && !token.match(/true|false/)
        );

        // Return an object with adapted tokens, if any
        const rangeMinMax = rangeTokens?.length ? rangeTokens[0].split(/\s*to\s*/) : undefined;
        return {
            name: nameTokens?.length ? nameTokens[0].replace(/["']/g, '').trim() : undefined,
            range: rangeMinMax ? [Number(rangeMinMax[0]), Number(rangeMinMax[1])] : undefined,
            step: stepTokens?.length ? Number(stepTokens[0].replace(/\s*step\s*/, '')) : undefined,
            booleanValues: booleanTokens?.length
                ? booleanTokens.map((bool) => bool === 'true')
                : [],
            numberValues: numberTokens?.length ? numberTokens.map((num) => Number(num)) : [],
            numericArrayValues: numericArrayTokens?.length
                ? numericArrayTokens.map((arrayString) =>
                      arrayString
                          .replace(/\[|\]/g, '')
                          .split(/\s*,\s*/)
                          .map((x) => Number(x))
                  )
                : [],
            metaStrings: potentialMetaTokens?.length ? potentialMetaTokens : []
        };
    }
}
