"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const workspace_1 = require("../../utility/workspace");
const workspace_models_1 = require("../../utility/workspace-models");
function default_1() {
    return workspace_1.updateWorkspace(workspace => {
        for (const [, project] of workspace.projects) {
            if (project.extensions.projectType !== workspace_models_1.ProjectType.Application) {
                // Only interested in application projects since these changes only effects application builders
                continue;
            }
            for (const [, target] of project.targets) {
                // Only interested in Angular Devkit builders
                if (!(target === null || target === void 0 ? void 0 : target.builder.startsWith('@angular-devkit/build-angular'))) {
                    continue;
                }
                // Check options
                if (target.options) {
                    target.options = {
                        ...updateVendorSourceMap(target.options),
                        evalSourceMap: undefined,
                        skipAppShell: undefined,
                        profile: undefined,
                    };
                }
                // Go through each configuration entry
                if (!target.configurations) {
                    continue;
                }
                for (const configurationName of Object.keys(target.configurations)) {
                    target.configurations[configurationName] = {
                        ...updateVendorSourceMap(target.configurations[configurationName]),
                        evalSourceMap: undefined,
                        skipAppShell: undefined,
                        profile: undefined,
                    };
                }
            }
        }
    });
}
exports.default = default_1;
function updateVendorSourceMap(options) {
    if (!options) {
        return {};
    }
    const { vendorSourceMap: vendor, sourceMap = true } = options;
    if (vendor === undefined) {
        return options;
    }
    if (sourceMap === true) {
        return {
            ...options,
            sourceMap: {
                styles: true,
                scripts: true,
                vendor,
            },
            vendorSourceMap: undefined,
        };
    }
    if (typeof sourceMap === 'object') {
        return {
            ...options,
            sourceMap: {
                ...sourceMap,
                vendor,
            },
            vendorSourceMap: undefined,
        };
    }
    return {
        ...options,
        vendorSourceMap: undefined,
    };
}
