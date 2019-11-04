"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const json_utils_1 = require("../../utility/json-utils");
const workspace_models_1 = require("../../utility/workspace-models");
const utils_1 = require("./utils");
/**
 * Update the tsconfig files for applications
 * - Removes enableIvy: true
 * - Sets stricter file inclusions
 */
function updateApplicationTsConfigs() {
    return (tree) => {
        const workspace = utils_1.getWorkspace(tree);
        for (const { target } of utils_1.getTargets(workspace, 'build', workspace_models_1.Builders.Browser)) {
            updateTsConfig(tree, target, workspace_models_1.Builders.Browser);
        }
        for (const { target } of utils_1.getTargets(workspace, 'server', workspace_models_1.Builders.Server)) {
            updateTsConfig(tree, target, workspace_models_1.Builders.Server);
        }
        for (const { target } of utils_1.getTargets(workspace, 'test', workspace_models_1.Builders.Karma)) {
            updateTsConfig(tree, target, workspace_models_1.Builders.Karma);
        }
        return tree;
    };
}
exports.updateApplicationTsConfigs = updateApplicationTsConfigs;
function updateTsConfig(tree, builderConfig, builderName) {
    const options = utils_1.getAllOptions(builderConfig);
    for (const option of options) {
        let recorder;
        const tsConfigOption = json_utils_1.findPropertyInAstObject(option, 'tsConfig');
        if (!tsConfigOption || tsConfigOption.kind !== 'string') {
            continue;
        }
        const tsConfigPath = tsConfigOption.value;
        let tsConfigAst = utils_1.readJsonFileAsAstObject(tree, tsConfigPath);
        if (!tsConfigAst) {
            continue;
        }
        // Remove 'enableIvy: true' since this is the default in version 9.
        const angularCompilerOptions = json_utils_1.findPropertyInAstObject(tsConfigAst, 'angularCompilerOptions');
        if (angularCompilerOptions && angularCompilerOptions.kind === 'object') {
            const enableIvy = json_utils_1.findPropertyInAstObject(angularCompilerOptions, 'enableIvy');
            if (enableIvy && enableIvy.kind === 'true') {
                recorder = tree.beginUpdate(tsConfigPath);
                if (angularCompilerOptions.properties.length === 1) {
                    // remove entire 'angularCompilerOptions'
                    json_utils_1.removePropertyInAstObject(recorder, tsConfigAst, 'angularCompilerOptions');
                }
                else {
                    json_utils_1.removePropertyInAstObject(recorder, angularCompilerOptions, 'enableIvy');
                }
                tree.commitUpdate(recorder);
            }
        }
        // Add stricter file inclusions to avoid unused file warning during compilation
        if (builderName !== workspace_models_1.Builders.Karma) {
            // Note: we need to re-read the tsconfig after very commit because
            // otherwise the updates will be out of sync since we are ammending the same node.
            tsConfigAst = utils_1.readJsonFileAsAstObject(tree, tsConfigPath);
            const include = json_utils_1.findPropertyInAstObject(tsConfigAst, 'include');
            if (include && include.kind === 'array') {
                const tsInclude = include.elements.find(({ value }) => typeof value === 'string' && value.endsWith('**/*.ts'));
                if (tsInclude) {
                    const { start, end } = tsInclude;
                    recorder = tree.beginUpdate(tsConfigPath);
                    recorder.remove(start.offset, end.offset - start.offset);
                    // Replace ts includes with d.ts
                    recorder.insertLeft(start.offset, tsInclude.text.replace('.ts', '.d.ts'));
                    tree.commitUpdate(recorder);
                }
            }
            const files = json_utils_1.findPropertyInAstObject(tsConfigAst, 'files');
            if (!files) {
                const newFiles = [];
                const mainOption = json_utils_1.findPropertyInAstObject(option, 'main');
                if (mainOption && mainOption.kind === 'string') {
                    newFiles.push(path_1.posix.relative(path_1.posix.dirname(tsConfigPath), mainOption.value));
                }
                const polyfillsOption = json_utils_1.findPropertyInAstObject(option, 'polyfills');
                if (polyfillsOption && polyfillsOption.kind === 'string') {
                    newFiles.push(path_1.posix.relative(path_1.posix.dirname(tsConfigPath), polyfillsOption.value));
                }
                if (newFiles.length) {
                    recorder = tree.beginUpdate(tsConfigPath);
                    tsConfigAst = utils_1.readJsonFileAsAstObject(tree, tsConfigPath);
                    json_utils_1.insertPropertyInAstObjectInOrder(recorder, tsConfigAst, 'files', newFiles, 2);
                    tree.commitUpdate(recorder);
                }
                recorder = tree.beginUpdate(tsConfigPath);
                tsConfigAst = utils_1.readJsonFileAsAstObject(tree, tsConfigPath);
                json_utils_1.removePropertyInAstObject(recorder, tsConfigAst, 'exclude');
                tree.commitUpdate(recorder);
            }
        }
    }
}
