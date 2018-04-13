"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const core_1 = require("@angular-devkit/core");
const schematics_1 = require("@angular-devkit/schematics");
const config_1 = require("../utility/config");
const latest_versions_1 = require("../utility/latest-versions");
// TODO: use JsonAST
// function appendPropertyInAstObject(
//   recorder: UpdateRecorder,
//   node: JsonAstObject,
//   propertyName: string,
//   value: JsonValue,
//   indent = 4,
// ) {
//   const indentStr = '\n' + new Array(indent + 1).join(' ');
//   if (node.properties.length > 0) {
//     // Insert comma.
//     const last = node.properties[node.properties.length - 1];
//     recorder.insertRight(last.start.offset + last.text.replace(/\s+$/, '').length, ',');
//   }
//   recorder.insertLeft(
//     node.end.offset - 1,
//     '  '
//     + `"${propertyName}": ${JSON.stringify(value, null, 2).replace(/\n/g, indentStr)}`
//     + indentStr.slice(0, -2),
//   );
// }
function addDependenciesToPackageJson() {
    return (host) => {
        const packageJsonPath = 'package.json';
        if (!host.exists('package.json')) {
            return host;
        }
        const source = host.read('package.json');
        if (!source) {
            return host;
        }
        const sourceText = source.toString('utf-8');
        const json = JSON.parse(sourceText);
        if (!json['devDependencies']) {
            json['devDependencies'] = {};
        }
        json.devDependencies = Object.assign({ '@angular/compiler-cli': latest_versions_1.latestVersions.Angular, '@angular-devkit/build-angular': latest_versions_1.latestVersions.DevkitBuildAngular, 'typescript': latest_versions_1.latestVersions.TypeScript }, json.devDependencies);
        host.overwrite(packageJsonPath, JSON.stringify(json, null, 2));
        return host;
    };
}
function addAppToWorkspaceFile(options, workspace) {
    return (host, context) => {
        // TODO: use JsonAST
        // const workspacePath = '/angular.json';
        // const workspaceBuffer = host.read(workspacePath);
        // if (workspaceBuffer === null) {
        //   throw new SchematicsException(`Configuration file (${workspacePath}) not found.`);
        // }
        // const workspaceJson = parseJson(workspaceBuffer.toString());
        // if (workspaceJson.value === null) {
        //   throw new SchematicsException(`Unable to parse configuration file (${workspacePath}).`);
        // }
        let projectRoot = options.projectRoot !== undefined
            ? options.projectRoot
            : `${workspace.newProjectRoot}/${options.name}`;
        if (projectRoot !== '' && !projectRoot.endsWith('/')) {
            projectRoot += '/';
        }
        const rootFilesRoot = options.projectRoot === undefined
            ? projectRoot
            : projectRoot + 'src/';
        // tslint:disable-next-line:no-any
        const project = {
            root: projectRoot,
            projectType: 'application',
            prefix: options.prefix || 'app',
            architect: {
                build: {
                    builder: '@angular-devkit/build-angular:browser',
                    options: {
                        outputPath: `dist/${options.name}`,
                        index: `${projectRoot}src/index.html`,
                        main: `${projectRoot}src/main.ts`,
                        polyfills: `${projectRoot}src/polyfills.ts`,
                        tsConfig: `${rootFilesRoot}tsconfig.app.json`,
                        assets: [
                            {
                                glob: 'favicon.ico',
                                input: `${projectRoot}src`,
                                output: '/',
                            },
                            {
                                glob: '**/*',
                                input: `${projectRoot}src/assets`,
                                output: '/assets',
                            },
                        ],
                        styles: [
                            {
                                input: `${projectRoot}src/styles.${options.style}`,
                            },
                        ],
                        scripts: [],
                    },
                    configurations: {
                        production: {
                            fileReplacements: [{
                                    replace: `${projectRoot}src/environments/environment.ts`,
                                    with: `${projectRoot}src/environments/environment.prod.ts`,
                                }],
                            optimization: true,
                            outputHashing: 'all',
                            sourceMap: false,
                            extractCss: true,
                            namedChunks: false,
                            aot: true,
                            extractLicenses: true,
                            vendorChunk: false,
                            buildOptimizer: true,
                        },
                    },
                },
                serve: {
                    builder: '@angular-devkit/build-angular:dev-server',
                    options: {
                        browserTarget: `${options.name}:build`,
                    },
                    configurations: {
                        production: {
                            browserTarget: `${options.name}:build:production`,
                        },
                    },
                },
                'extract-i18n': {
                    builder: '@angular-devkit/build-angular:extract-i18n',
                    options: {
                        browserTarget: `${options.name}:build`,
                    },
                },
                test: {
                    builder: '@angular-devkit/build-angular:karma',
                    options: {
                        main: `${projectRoot}src/test.ts`,
                        polyfills: `${projectRoot}src/polyfills.ts`,
                        tsConfig: `${rootFilesRoot}tsconfig.spec.json`,
                        karmaConfig: `${rootFilesRoot}karma.conf.js`,
                        styles: [
                            {
                                input: `${projectRoot}styles.${options.style}`,
                            },
                        ],
                        scripts: [],
                        assets: [
                            {
                                glob: 'favicon.ico',
                                input: `${projectRoot}src/`,
                                output: '/',
                            },
                            {
                                glob: '**/*',
                                input: `${projectRoot}src/assets`,
                                output: '/assets',
                            },
                        ],
                    },
                },
                lint: {
                    builder: '@angular-devkit/build-angular:tslint',
                    options: {
                        tsConfig: [
                            `${rootFilesRoot}tsconfig.app.json`,
                            `${rootFilesRoot}tsconfig.spec.json`,
                        ],
                        exclude: [
                            '**/node_modules/**',
                        ],
                    },
                },
            },
        };
        // tslint:disable-next-line:no-any
        // const projects: JsonObject = (<any> workspaceAst.value).projects || {};
        // tslint:disable-next-line:no-any
        // if (!(<any> workspaceAst.value).projects) {
        //   // tslint:disable-next-line:no-any
        //   (<any> workspaceAst.value).projects = projects;
        // }
        workspace.projects[options.name] = project;
        const schematics = {};
        if (options.inlineTemplate === true
            || options.inlineStyle === true
            || options.style !== undefined) {
            schematics['@schematics/angular:component'] = {};
            if (options.inlineTemplate === true) {
                schematics['@schematics/angular:component'].inlineTemplate = true;
            }
            if (options.inlineStyle === true) {
                schematics['@schematics/angular:component'].inlineStyle = true;
            }
            if (options.style !== undefined) {
                schematics['@schematics/angular:component'].styleext = options.style;
            }
        }
        if (options.skipTests === true) {
            ['class', 'component', 'directive', 'guard', 'module', 'pipe', 'service'].forEach((type) => {
                if (!(`@schematics/angular:${type}` in schematics)) {
                    schematics[`@schematics/angular:${type}`] = {};
                }
                schematics[`@schematics/angular:${type}`].spec = false;
            });
        }
        workspace.schematics = schematics;
        host.overwrite(config_1.getWorkspacePath(host), JSON.stringify(workspace, null, 2));
    };
}
const projectNameRegexp = /^[a-zA-Z][.0-9a-zA-Z]*(-[.0-9a-zA-Z]*)*$/;
const unsupportedProjectNames = ['test', 'ember', 'ember-cli', 'vendor', 'app'];
function getRegExpFailPosition(str) {
    const parts = str.indexOf('-') >= 0 ? str.split('-') : [str];
    const matched = [];
    parts.forEach(part => {
        if (part.match(projectNameRegexp)) {
            matched.push(part);
        }
    });
    const compare = matched.join('-');
    return (str !== compare) ? compare.length : null;
}
function validateProjectName(projectName) {
    const errorIndex = getRegExpFailPosition(projectName);
    if (errorIndex !== null) {
        const firstMessage = core_1.tags.oneLine `
      Project name "${projectName}" is not valid. New project names must
      start with a letter, and must contain only alphanumeric characters or dashes.
      When adding a dash the segment after the dash must also start with a letter.
    `;
        const msg = core_1.tags.stripIndent `
      ${firstMessage}
      ${projectName}
      ${Array(errorIndex + 1).join(' ') + '^'}
    `;
        throw new schematics_1.SchematicsException(msg);
    }
    else if (unsupportedProjectNames.indexOf(projectName) !== -1) {
        throw new schematics_1.SchematicsException(`Project name "${projectName}" is not a supported name.`);
    }
}
function default_1(options) {
    return (host, context) => {
        if (!options.name) {
            throw new schematics_1.SchematicsException(`Invalid options, "name" is required.`);
        }
        validateProjectName(options.name);
        const prefix = options.prefix || 'app';
        const appRootSelector = `${prefix}-root`;
        const componentOptions = {
            inlineStyle: options.inlineStyle,
            inlineTemplate: options.inlineTemplate,
            spec: !options.skipTests,
            styleext: options.style,
            viewEncapsulation: options.viewEncapsulation,
        };
        const workspace = config_1.getWorkspace(host);
        let newProjectRoot = workspace.newProjectRoot;
        let appDir = `${newProjectRoot}/${options.name}`;
        let sourceRoot = `${appDir}/src`;
        let sourceDir = `${sourceRoot}/app`;
        let relativeTsConfigPath = appDir.split('/').map(x => '..').join('/');
        let relativeTsLintPath = appDir.split('/').map(x => '..').join('/');
        const rootInSrc = options.projectRoot !== undefined;
        if (options.projectRoot !== undefined) {
            newProjectRoot = options.projectRoot;
            appDir = `${newProjectRoot}/src`;
            sourceRoot = appDir;
            sourceDir = `${sourceRoot}/app`;
            relativeTsConfigPath = core_1.relative(core_1.normalize('/' + sourceRoot), core_1.normalize('/'));
            if (relativeTsConfigPath === '') {
                relativeTsConfigPath = '.';
            }
            relativeTsLintPath = core_1.relative(core_1.normalize('/' + sourceRoot), core_1.normalize('/'));
            if (relativeTsLintPath === '') {
                relativeTsLintPath = '.';
            }
        }
        const tsLintRoot = appDir;
        const e2eOptions = {
            name: `${options.name}-e2e`,
            relatedAppName: options.name,
            rootSelector: appRootSelector,
        };
        if (options.projectRoot !== undefined) {
            e2eOptions.projectRoot = 'e2e';
        }
        return schematics_1.chain([
            addAppToWorkspaceFile(options, workspace),
            options.skipPackageJson ? schematics_1.noop() : addDependenciesToPackageJson(),
            schematics_1.mergeWith(schematics_1.apply(schematics_1.url('./files/src'), [
                schematics_1.template(Object.assign({ utils: core_1.strings }, options, { 'dot': '.', relativeTsConfigPath })),
                schematics_1.move(sourceRoot),
            ])),
            schematics_1.mergeWith(schematics_1.apply(schematics_1.url('./files/root'), [
                schematics_1.template(Object.assign({ utils: core_1.strings }, options, { 'dot': '.', relativeTsConfigPath,
                    rootInSrc })),
                schematics_1.move(appDir),
            ])),
            schematics_1.mergeWith(schematics_1.apply(schematics_1.url('./files/lint'), [
                schematics_1.template(Object.assign({ utils: core_1.strings }, options, { tsLintRoot,
                    relativeTsLintPath,
                    prefix })),
            ])),
            schematics_1.schematic('module', {
                name: 'app',
                commonModule: false,
                flat: true,
                routing: options.routing,
                routingScope: 'Root',
                path: sourceDir,
                spec: false,
            }),
            schematics_1.schematic('component', Object.assign({ name: 'app', selector: appRootSelector, flat: true, path: sourceDir, skipImport: true }, componentOptions)),
            schematics_1.mergeWith(schematics_1.apply(schematics_1.url('./other-files'), [
                componentOptions.inlineTemplate ? schematics_1.filter(path => !path.endsWith('.html')) : schematics_1.noop(),
                !componentOptions.spec ? schematics_1.filter(path => !path.endsWith('.spec.ts')) : schematics_1.noop(),
                schematics_1.template(Object.assign({ utils: core_1.strings }, options, { selector: appRootSelector }, componentOptions)),
                schematics_1.move(sourceDir),
            ]), schematics_1.MergeStrategy.Overwrite),
            schematics_1.schematic('e2e', e2eOptions),
        ])(host, context);
    };
}
exports.default = default_1;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL3NjaGVtYXRpY3MvYW5ndWxhci9hcHBsaWNhdGlvbi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7R0FNRztBQUNILCtDQUFzRjtBQUV0RiwyREFlb0M7QUFFcEMsOENBQW1FO0FBQ25FLGdFQUE0RDtBQUs1RCxvQkFBb0I7QUFDcEIsc0NBQXNDO0FBQ3RDLDhCQUE4QjtBQUM5Qix5QkFBeUI7QUFDekIsMEJBQTBCO0FBQzFCLHNCQUFzQjtBQUN0QixnQkFBZ0I7QUFDaEIsTUFBTTtBQUNOLDhEQUE4RDtBQUU5RCxzQ0FBc0M7QUFDdEMsdUJBQXVCO0FBQ3ZCLGdFQUFnRTtBQUNoRSwyRkFBMkY7QUFDM0YsTUFBTTtBQUVOLHlCQUF5QjtBQUN6QiwyQkFBMkI7QUFDM0IsV0FBVztBQUNYLHlGQUF5RjtBQUN6RixnQ0FBZ0M7QUFDaEMsT0FBTztBQUNQLElBQUk7QUFFSjtJQUNFLE1BQU0sQ0FBQyxDQUFDLElBQVUsRUFBRSxFQUFFO1FBQ3BCLE1BQU0sZUFBZSxHQUFHLGNBQWMsQ0FBQztRQUV2QyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztRQUFDLENBQUM7UUFFbEQsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUN6QyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFBQyxNQUFNLENBQUMsSUFBSSxDQUFDO1FBQUMsQ0FBQztRQUU3QixNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzVDLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFcEMsRUFBRSxD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dkhELDRCQXVIQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7IEpzb25PYmplY3QsIG5vcm1hbGl6ZSwgcmVsYXRpdmUsIHN0cmluZ3MsIHRhZ3MgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyBleHBlcmltZW50YWwgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQge1xuICBNZXJnZVN0cmF0ZWd5LFxuICBSdWxlLFxuICBTY2hlbWF0aWNDb250ZXh0LFxuICBTY2hlbWF0aWNzRXhjZXB0aW9uLFxuICBUcmVlLFxuICBhcHBseSxcbiAgY2hhaW4sXG4gIGZpbHRlcixcbiAgbWVyZ2VXaXRoLFxuICBtb3ZlLFxuICBub29wLFxuICBzY2hlbWF0aWMsXG4gIHRlbXBsYXRlLFxuICB1cmwsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9zY2hlbWF0aWNzJztcbmltcG9ydCB7IFNjaGVtYSBhcyBFMmVPcHRpb25zIH0gZnJvbSAnLi4vZTJlL3NjaGVtYSc7XG5pbXBvcnQgeyBnZXRXb3Jrc3BhY2UsIGdldFdvcmtzcGFjZVBhdGggfSBmcm9tICcuLi91dGlsaXR5L2NvbmZpZyc7XG5pbXBvcnQgeyBsYXRlc3RWZXJzaW9ucyB9IGZyb20gJy4uL3V0aWxpdHkvbGF0ZXN0LXZlcnNpb25zJztcbmltcG9ydCB7IFNjaGVtYSBhcyBBcHBsaWNhdGlvbk9wdGlvbnMgfSBmcm9tICcuL3NjaGVtYSc7XG5cbnR5cGUgV29ya3NwYWNlU2NoZW1hID0gZXhwZXJpbWVudGFsLndvcmtzcGFjZS5Xb3Jrc3BhY2VTY2hlbWE7XG5cbi8vIFRPRE86IHVzZSBKc29uQVNUXG4vLyBmdW5jdGlvbiBhcHBlbmRQcm9wZXJ0eUluQXN0T2JqZWN0KFxuLy8gICByZWNvcmRlcjogVXBkYXRlUmVjb3JkZXIsXG4vLyAgIG5vZGU6IEpzb25Bc3RPYmplY3QsXG4vLyAgIHByb3BlcnR5TmFtZTogc3RyaW5nLFxuLy8gICB2YWx1ZTogSnNvblZhbHVlLFxuLy8gICBpbmRlbnQgPSA0LFxuLy8gKSB7XG4vLyAgIGNvbnN0IGluZGVudFN0ciA9ICdcXG4nICsgbmV3IEFycmF5KGluZGVudCArIDEpLmpvaW4oJyAnKTtcblxuLy8gICBpZiAobm9kZS5wcm9wZXJ0aWVzLmxlbmd0aCA+IDApIHtcbi8vICAgICAvLyBJbnNlcnQgY29tbWEuXG4vLyAgICAgY29uc3QgbGFzdCA9IG5vZGUucHJvcGVydGllc1tub2RlLnByb3BlcnRpZXMubGVuZ3RoIC0gMV07XG4vLyAgICAgcmVjb3JkZXIuaW5zZXJ0UmlnaHQobGFzdC5zdGFydC5vZmZzZXQgKyBsYXN0LnRleHQucmVwbGFjZSgvXFxzKyQvLCAnJykubGVuZ3RoLCAnLCcpO1xuLy8gICB9XG5cbi8vICAgcmVjb3JkZXIuaW5zZXJ0TGVmdChcbi8vICAgICBub2RlLmVuZC5vZmZzZXQgLSAxLFxuLy8gICAgICcgICdcbi8vICAgICArIGBcIiR7cHJvcGVydHlOYW1lfVwiOiAke0pTT04uc3RyaW5naWZ5KHZhbHVlLCBudWxsLCAyKS5yZXBsYWNlKC9cXG4vZywgaW5kZW50U3RyKX1gXG4vLyAgICAgKyBpbmRlbnRTdHIuc2xpY2UoMCwgLTIpLFxuLy8gICApO1xuLy8gfVxuXG5mdW5jdGlvbiBhZGREZXBlbmRlbmNpZXNUb1BhY2thZ2VKc29uKCkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBjb25zdCBwYWNrYWdlSnNvblBhdGggPSAncGFja2FnZS5qc29uJztcblxuICAgIGlmICghaG9zdC5leGlzdHMoJ3BhY2thZ2UuanNvbicpKSB7IHJldHVybiBob3N0OyB9XG5cbiAgICBjb25zdCBzb3VyY2UgPSBob3N0LnJlYWQoJ3BhY2thZ2UuanNvbicpO1xuICAgIGlmICghc291cmNlKSB7IHJldHVybiBob3N0OyB9XG5cbiAgICBjb25zdCBzb3VyY2VUZXh0ID0gc291cmNlLnRvU3RyaW5nKCd1dGYtOCcpO1xuICAgIGNvbnN0IGpzb24gPSBKU09OLnBhcnNlKHNvdXJjZVRleHQpO1xuXG4gICAgaWYgKCFqc29uWydkZXZEZXBlbmRlbmNpZXMnXSkge1xuICAgICAganNvblsnZGV2RGVwZW5kZW5jaWVzJ10gPSB7fTtcbiAgICB9XG5cbiAgICBqc29uLmRldkRlcGVuZGVuY2llcyA9IHtcbiAgICAgICdAYW5ndWxhci9jb21waWxlci1jbGknOiBsYXRlc3RWZXJzaW9ucy5Bbmd1bGFyLFxuICAgICAgJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyJzogbGF0ZXN0VmVyc2lvbnMuRGV2a2l0QnVpbGRBbmd1bGFyLFxuICAgICAgJ3R5cGVzY3JpcHQnOiBsYXRlc3RWZXJzaW9ucy5UeXBlU2NyaXB0LFxuICAgICAgLy8gRGUtc3RydWN0dXJlIGxhc3Qga2VlcHMgZXhpc3RpbmcgdXNlciBkZXBlbmRlbmNpZXMuXG4gICAgICAuLi5qc29uLmRldkRlcGVuZGVuY2llcyxcbiAgICB9O1xuXG4gICAgaG9zdC5vdmVyd3JpdGUocGFja2FnZUpzb25QYXRoLCBKU09OLnN0cmluZ2lmeShqc29uLCBudWxsLCAyKSk7XG5cbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuZnVuY3Rpb24gYWRkQXBwVG9Xb3Jrc3BhY2VGaWxlKG9wdGlvbnM6IEFwcGxpY2F0aW9uT3B0aW9ucywgd29ya3NwYWNlOiBXb3Jrc3BhY2VTY2hlbWEpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgLy8gVE9ETzogdXNlIEpzb25BU1RcbiAgICAvLyBjb25zdCB3b3Jrc3BhY2VQYXRoID0gJy9hbmd1bGFyLmpzb24nO1xuICAgIC8vIGNvbnN0IHdvcmtzcGFjZUJ1ZmZlciA9IGhvc3QucmVhZCh3b3Jrc3BhY2VQYXRoKTtcbiAgICAvLyBpZiAod29ya3NwYWNlQnVmZmVyID09PSBudWxsKSB7XG4gICAgLy8gICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbihgQ29uZmlndXJhdGlvbiBmaWxlICgke3dvcmtzcGFjZVBhdGh9KSBub3QgZm91bmQuYCk7XG4gICAgLy8gfVxuICAgIC8vIGNvbnN0IHdvcmtzcGFjZUpzb24gPSBwYXJzZUpzb24od29ya3NwYWNlQnVmZmVyLnRvU3RyaW5nKCkpO1xuICAgIC8vIGlmICh3b3Jrc3BhY2VKc29uLnZhbHVlID09PSBudWxsKSB7XG4gICAgLy8gICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbihgVW5hYmxlIHRvIHBhcnNlIGNvbmZpZ3VyYXRpb24gZmlsZSAoJHt3b3Jrc3BhY2VQYXRofSkuYCk7XG4gICAgLy8gfVxuICAgIGxldCBwcm9qZWN0Um9vdCA9IG9wdGlvbnMucHJvamVjdFJvb3QgIT09IHVuZGVmaW5lZFxuICAgICAgPyBvcHRpb25zLnByb2plY3RSb290XG4gICAgICA6IGAke3dvcmtzcGFjZS5uZXdQcm9qZWN0Um9vdH0vJHtvcHRpb25zLm5hbWV9YDtcbiAgICBpZiAocHJvamVjdFJvb3QgIT09ICcnICYmICFwcm9qZWN0Um9vdC5lbmRzV2l0aCgnLycpKSB7XG4gICAgICBwcm9qZWN0Um9vdCArPSAnLyc7XG4gICAgfVxuICAgIGNvbnN0IHJvb3RGaWxlc1Jvb3QgPSBvcHRpb25zLnByb2plY3RSb290ID09PSB1bmRlZmluZWRcbiAgICAgID8gcHJvamVjdFJvb3RcbiAgICAgIDogcHJvamVjdFJvb3QgKyAnc3JjLyc7XG5cbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgY29uc3QgcHJvamVjdDogYW55ID0ge1xuICAgICAgcm9vdDogcHJvamVjdFJvb3QsXG4gICAgICBwcm9qZWN0VHlwZTogJ2FwcGxpY2F0aW9uJyxcbiAgICAgIHByZWZpeDogb3B0aW9ucy5wcmVmaXggfHwgJ2FwcCcsXG4gICAgICBhcmNoaXRlY3Q6IHtcbiAgICAgICAgYnVpbGQ6IHtcbiAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXI6YnJvd3NlcicsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgb3V0cHV0UGF0aDogYGRpc3QvJHtvcHRpb25zLm5hbWV9YCxcbiAgICAgICAgICAgIGluZGV4OiBgJHtwcm9qZWN0Um9vdH1zcmMvaW5kZXguaHRtbGAsXG4gICAgICAgICAgICBtYWluOiBgJHtwcm9qZWN0Um9vdH1zcmMvbWFpbi50c2AsXG4gICAgICAgICAgICBwb2x5ZmlsbHM6IGAke3Byb2plY3RSb290fXNyYy9wb2x5ZmlsbHMudHNgLFxuICAgICAgICAgICAgdHNDb25maWc6IGAke3Jvb3RGaWxlc1Jvb3R9dHNjb25maWcuYXBwLmpzb25gLFxuICAgICAgICAgICAgYXNzZXRzOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBnbG9iOiAnZmF2aWNvbi5pY28nLFxuICAgICAgICAgICAgICAgIGlucHV0OiBgJHtwcm9qZWN0Um9vdH1zcmNgLFxuICAgICAgICAgICAgICAgIG91dHB1dDogJy8nLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZ2xvYjogJyoqLyonLFxuICAgICAgICAgICAgICAgIGlucHV0OiBgJHtwcm9qZWN0Um9vdH1zcmMvYXNzZXRzYCxcbiAgICAgICAgICAgICAgICBvdXRwdXQ6ICcvYXNzZXRzJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBzdHlsZXM6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlucHV0OiBgJHtwcm9qZWN0Um9vdH1zcmMvc3R5bGVzLiR7b3B0aW9ucy5zdHlsZX1gLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHNjcmlwdHM6IFtdLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29uZmlndXJhdGlvbnM6IHtcbiAgICAgICAgICAgIHByb2R1Y3Rpb246IHtcbiAgICAgICAgICAgICAgZmlsZVJlcGxhY2VtZW50czogW3tcbiAgICAgICAgICAgICAgICByZXBsYWNlOiBgJHtwcm9qZWN0Um9vdH1zcmMvZW52aXJvbm1lbnRzL2Vudmlyb25tZW50LnRzYCxcbiAgICAgICAgICAgICAgICB3aXRoOiBgJHtwcm9qZWN0Um9vdH1zcmMvZW52aXJvbm1lbnRzL2Vudmlyb25tZW50LnByb2QudHNgLFxuICAgICAgICAgICAgICB9XSxcbiAgICAgICAgICAgICAgb3B0aW1pemF0aW9uOiB0cnVlLFxuICAgICAgICAgICAgICBvdXRwdXRIYXNoaW5nOiAnYWxsJyxcbiAgICAgICAgICAgICAgc291cmNlTWFwOiBmYWxzZSxcbiAgICAgICAgICAgICAgZXh0cmFjdENzczogdHJ1ZSxcbiAgICAgICAgICAgICAgbmFtZWRDaHVua3M6IGZhbHNlLFxuICAgICAgICAgICAgICBhb3Q6IHRydWUsXG4gICAgICAgICAgICAgIGV4dHJhY3RMaWNlbnNlczogdHJ1ZSxcbiAgICAgICAgICAgICAgdmVuZG9yQ2h1bms6IGZhbHNlLFxuICAgICAgICAgICAgICBidWlsZE9wdGltaXplcjogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgc2VydmU6IHtcbiAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXI6ZGV2LXNlcnZlcicsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgYnJvd3NlclRhcmdldDogYCR7b3B0aW9ucy5uYW1lfTpidWlsZGAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb25maWd1cmF0aW9uczoge1xuICAgICAgICAgICAgcHJvZHVjdGlvbjoge1xuICAgICAgICAgICAgICBicm93c2VyVGFyZ2V0OiBgJHtvcHRpb25zLm5hbWV9OmJ1aWxkOnByb2R1Y3Rpb25gLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAnZXh0cmFjdC1pMThuJzoge1xuICAgICAgICAgIGJ1aWxkZXI6ICdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhcjpleHRyYWN0LWkxOG4nLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIGJyb3dzZXJUYXJnZXQ6IGAke29wdGlvbnMubmFtZX06YnVpbGRgLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHRlc3Q6IHtcbiAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXI6a2FybWEnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIG1haW46IGAke3Byb2plY3RSb290fXNyYy90ZXN0LnRzYCxcbiAgICAgICAgICAgIHBvbHlmaWxsczogYCR7cHJvamVjdFJvb3R9c3JjL3BvbHlmaWxscy50c2AsXG4gICAgICAgICAgICB0c0NvbmZpZzogYCR7cm9vdEZpbGVzUm9vdH10c2NvbmZpZy5zcGVjLmpzb25gLFxuICAgICAgICAgICAga2FybWFDb25maWc6IGAke3Jvb3RGaWxlc1Jvb3R9a2FybWEuY29uZi5qc2AsXG4gICAgICAgICAgICBzdHlsZXM6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlucHV0OiBgJHtwcm9qZWN0Um9vdH1zdHlsZXMuJHtvcHRpb25zLnN0eWxlfWAsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgc2NyaXB0czogW10sXG4gICAgICAgICAgICBhc3NldHM6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGdsb2I6ICdmYXZpY29uLmljbycsXG4gICAgICAgICAgICAgICAgaW5wdXQ6IGAke3Byb2plY3RSb290fXNyYy9gLFxuICAgICAgICAgICAgICAgIG91dHB1dDogJy8nLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZ2xvYjogJyoqLyonLFxuICAgICAgICAgICAgICAgIGlucHV0OiBgJHtwcm9qZWN0Um9vdH1zcmMvYXNzZXRzYCxcbiAgICAgICAgICAgICAgICBvdXRwdXQ6ICcvYXNzZXRzJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgbGludDoge1xuICAgICAgICAgIGJ1aWxkZXI6ICdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhcjp0c2xpbnQnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHRzQ29uZmlnOiBbXG4gICAgICAgICAgICAgIGAke3Jvb3RGaWxlc1Jvb3R9dHNjb25maWcuYXBwLmpzb25gLFxuICAgICAgICAgICAgICBgJHtyb290RmlsZXNSb290fXRzY29uZmlnLnNwZWMuanNvbmAsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgZXhjbHVkZTogW1xuICAgICAgICAgICAgICAnKiovbm9kZV9tb2R1bGVzLyoqJyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfTtcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgLy8gY29uc3QgcHJvamVjdHM6IEpzb25PYmplY3QgPSAoPGFueT4gd29ya3NwYWNlQXN0LnZhbHVlKS5wcm9qZWN0cyB8fCB7fTtcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgLy8gaWYgKCEoPGFueT4gd29ya3NwYWNlQXN0LnZhbHVlKS5wcm9qZWN0cykge1xuICAgIC8vICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgIC8vICAgKDxhbnk+IHdvcmtzcGFjZUFzdC52YWx1ZSkucHJvamVjdHMgPSBwcm9qZWN0cztcbiAgICAvLyB9XG5cbiAgICB3b3Jrc3BhY2UucHJvamVjdHNbb3B0aW9ucy5uYW1lXSA9IHByb2plY3Q7XG5cbiAgICBjb25zdCBzY2hlbWF0aWNzOiBKc29uT2JqZWN0ID0ge307XG5cbiAgICBpZiAob3B0aW9ucy5pbmxpbmVUZW1wbGF0ZSA9PT0gdHJ1ZVxuICAgICAgICB8fCBvcHRpb25zLmlubGluZVN0eWxlID09PSB0cnVlXG4gICAgICAgIHx8IG9wdGlvbnMuc3R5bGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgc2NoZW1hdGljc1snQHNjaGVtYXRpY3MvYW5ndWxhcjpjb21wb25lbnQnXSA9IHt9O1xuICAgICAgaWYgKG9wdGlvbnMuaW5saW5lVGVtcGxhdGUgPT09IHRydWUpIHtcbiAgICAgICAgKHNjaGVtYXRpY3NbJ0BzY2hlbWF0aWNzL2FuZ3VsYXI6Y29tcG9uZW50J10gYXMgSnNvbk9iamVjdCkuaW5saW5lVGVtcGxhdGUgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKG9wdGlvbnMuaW5saW5lU3R5bGUgPT09IHRydWUpIHtcbiAgICAgICAgKHNjaGVtYXRpY3NbJ0BzY2hlbWF0aWNzL2FuZ3VsYXI6Y29tcG9uZW50J10gYXMgSnNvbk9iamVjdCkuaW5saW5lU3R5bGUgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKG9wdGlvbnMuc3R5bGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAoc2NoZW1hdGljc1snQHNjaGVtYXRpY3MvYW5ndWxhcjpjb21wb25lbnQnXSBhcyBKc29uT2JqZWN0KS5zdHlsZWV4dCA9IG9wdGlvbnMuc3R5bGU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMuc2tpcFRlc3RzID09PSB0cnVlKSB7XG4gICAgICBbJ2NsYXNzJywgJ2NvbXBvbmVudCcsICdkaXJlY3RpdmUnLCAnZ3VhcmQnLCAnbW9kdWxlJywgJ3BpcGUnLCAnc2VydmljZSddLmZvckVhY2goKHR5cGUpID0+IHtcbiAgICAgICAgaWYgKCEoYEBzY2hlbWF0aWNzL2FuZ3VsYXI6JHt0eXBlfWAgaW4gc2NoZW1hdGljcykpIHtcbiAgICAgICAgICBzY2hlbWF0aWNzW2BAc2NoZW1hdGljcy9hbmd1bGFyOiR7dHlwZX1gXSA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIChzY2hlbWF0aWNzW2BAc2NoZW1hdGljcy9hbmd1bGFyOiR7dHlwZX1gXSBhcyBKc29uT2JqZWN0KS5zcGVjID0gZmFsc2U7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB3b3Jrc3BhY2Uuc2NoZW1hdGljcyA9IHNjaGVtYXRpY3M7XG5cbiAgICBob3N0Lm92ZXJ3cml0ZShnZXRXb3Jrc3BhY2VQYXRoKGhvc3QpLCBKU09OLnN0cmluZ2lmeSh3b3Jrc3BhY2UsIG51bGwsIDIpKTtcbiAgfTtcbn1cbmNvbnN0IHByb2plY3ROYW1lUmVnZXhwID0gL15bYS16QS1aXVsuMC05YS16QS1aXSooLVsuMC05YS16QS1aXSopKiQvO1xuY29uc3QgdW5zdXBwb3J0ZWRQcm9qZWN0TmFtZXMgPSBbJ3Rlc3QnLCAnZW1iZXInLCAnZW1iZXItY2xpJywgJ3ZlbmRvcicsICdhcHAnXTtcblxuZnVuY3Rpb24gZ2V0UmVnRXhwRmFpbFBvc2l0aW9uKHN0cjogc3RyaW5nKTogbnVtYmVyIHwgbnVsbCB7XG4gIGNvbnN0IHBhcnRzID0gc3RyLmluZGV4T2YoJy0nKSA+PSAwID8gc3RyLnNwbGl0KCctJykgOiBbc3RyXTtcbiAgY29uc3QgbWF0Y2hlZDogc3RyaW5nW10gPSBbXTtcblxuICBwYXJ0cy5mb3JFYWNoKHBhcnQgPT4ge1xuICAgIGlmIChwYXJ0Lm1hdGNoKHByb2plY3ROYW1lUmVnZXhwKSkge1xuICAgICAgbWF0Y2hlZC5wdXNoKHBhcnQpO1xuICAgIH1cbiAgfSk7XG5cbiAgY29uc3QgY29tcGFyZSA9IG1hdGNoZWQuam9pbignLScpO1xuXG4gIHJldHVybiAoc3RyICE9PSBjb21wYXJlKSA/IGNvbXBhcmUubGVuZ3RoIDogbnVsbDtcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVQcm9qZWN0TmFtZShwcm9qZWN0TmFtZTogc3RyaW5nKSB7XG4gIGNvbnN0IGVycm9ySW5kZXggPSBnZXRSZWdFeHBGYWlsUG9zaXRpb24ocHJvamVjdE5hbWUpO1xuICBpZiAoZXJyb3JJbmRleCAhPT0gbnVsbCkge1xuICAgIGNvbnN0IGZpcnN0TWVzc2FnZSA9IHRhZ3Mub25lTGluZWBcbiAgICAgIFByb2plY3QgbmFtZSBcIiR7cHJvamVjdE5hbWV9XCIgaXMgbm90IHZhbGlkLiBOZXcgcHJvamVjdCBuYW1lcyBtdXN0XG4gICAgICBzdGFydCB3aXRoIGEgbGV0dGVyLCBhbmQgbXVzdCBjb250YWluIG9ubHkgYWxwaGFudW1lcmljIGNoYXJhY3RlcnMgb3IgZGFzaGVzLlxuICAgICAgV2hlbiBhZGRpbmcgYSBkYXNoIHRoZSBzZWdtZW50IGFmdGVyIHRoZSBkYXNoIG11c3QgYWxzbyBzdGFydCB3aXRoIGEgbGV0dGVyLlxuICAgIGA7XG4gICAgY29uc3QgbXNnID0gdGFncy5zdHJpcEluZGVudGBcbiAgICAgICR7Zmlyc3RNZXNzYWdlfVxuICAgICAgJHtwcm9qZWN0TmFtZX1cbiAgICAgICR7QXJyYXkoZXJyb3JJbmRleCArIDEpLmpvaW4oJyAnKSArICdeJ31cbiAgICBgO1xuICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKG1zZyk7XG4gIH0gZWxzZSBpZiAodW5zdXBwb3J0ZWRQcm9qZWN0TmFtZXMuaW5kZXhPZihwcm9qZWN0TmFtZSkgIT09IC0xKSB7XG4gICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oYFByb2plY3QgbmFtZSBcIiR7cHJvamVjdE5hbWV9XCIgaXMgbm90IGEgc3VwcG9ydGVkIG5hbWUuYCk7XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAob3B0aW9uczogQXBwbGljYXRpb25PcHRpb25zKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGlmICghb3B0aW9ucy5uYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbihgSW52YWxpZCBvcHRpb25zLCBcIm5hbWVcIiBpcyByZXF1aXJlZC5gKTtcbiAgICB9XG4gICAgdmFsaWRhdGVQcm9qZWN0TmFtZShvcHRpb25zLm5hbWUpO1xuICAgIGNvbnN0IHByZWZpeCA9IG9wdGlvbnMucHJlZml4IHx8ICdhcHAnO1xuICAgIGNvbnN0IGFwcFJvb3RTZWxlY3RvciA9IGAke3ByZWZpeH0tcm9vdGA7XG4gICAgY29uc3QgY29tcG9uZW50T3B0aW9ucyA9IHtcbiAgICAgIGlubGluZVN0eWxlOiBvcHRpb25zLmlubGluZVN0eWxlLFxuICAgICAgaW5saW5lVGVtcGxhdGU6IG9wdGlvbnMuaW5saW5lVGVtcGxhdGUsXG4gICAgICBzcGVjOiAhb3B0aW9ucy5za2lwVGVzdHMsXG4gICAgICBzdHlsZWV4dDogb3B0aW9ucy5zdHlsZSxcbiAgICAgIHZpZXdFbmNhcHN1bGF0aW9uOiBvcHRpb25zLnZpZXdFbmNhcHN1bGF0aW9uLFxuICAgIH07XG5cbiAgICBjb25zdCB3b3Jrc3BhY2UgPSBnZXRXb3Jrc3BhY2UoaG9zdCk7XG4gICAgbGV0IG5ld1Byb2plY3RSb290ID0gd29ya3NwYWNlLm5ld1Byb2plY3RSb290O1xuICAgIGxldCBhcHBEaXIgPSBgJHtuZXdQcm9qZWN0Um9vdH0vJHtvcHRpb25zLm5hbWV9YDtcbiAgICBsZXQgc291cmNlUm9vdCA9IGAke2FwcERpcn0vc3JjYDtcbiAgICBsZXQgc291cmNlRGlyID0gYCR7c291cmNlUm9vdH0vYXBwYDtcbiAgICBsZXQgcmVsYXRpdmVUc0NvbmZpZ1BhdGggPSBhcHBEaXIuc3BsaXQoJy8nKS5tYXAoeCA9PiAnLi4nKS5qb2luKCcvJyk7XG4gICAgbGV0IHJlbGF0aXZlVHNMaW50UGF0aCA9IGFwcERpci5zcGxpdCgnLycpLm1hcCh4ID0+ICcuLicpLmpvaW4oJy8nKTtcbiAgICBjb25zdCByb290SW5TcmMgPSBvcHRpb25zLnByb2plY3RSb290ICE9PSB1bmRlZmluZWQ7XG4gICAgaWYgKG9wdGlvbnMucHJvamVjdFJvb3QgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbmV3UHJvamVjdFJvb3QgPSBvcHRpb25zLnByb2plY3RSb290O1xuICAgICAgYXBwRGlyID0gYCR7bmV3UHJvamVjdFJvb3R9L3NyY2A7XG4gICAgICBzb3VyY2VSb290ID0gYXBwRGlyO1xuICAgICAgc291cmNlRGlyID0gYCR7c291cmNlUm9vdH0vYXBwYDtcbiAgICAgIHJlbGF0aXZlVHNDb25maWdQYXRoID0gcmVsYXRpdmUobm9ybWFsaXplKCcvJyArIHNvdXJjZVJvb3QpLCBub3JtYWxpemUoJy8nKSk7XG4gICAgICBpZiAocmVsYXRpdmVUc0NvbmZpZ1BhdGggPT09ICcnKSB7XG4gICAgICAgIHJlbGF0aXZlVHNDb25maWdQYXRoID0gJy4nO1xuICAgICAgfVxuICAgICAgcmVsYXRpdmVUc0xpbnRQYXRoID0gcmVsYXRpdmUobm9ybWFsaXplKCcvJyArIHNvdXJjZVJvb3QpLCBub3JtYWxpemUoJy8nKSk7XG4gICAgICBpZiAocmVsYXRpdmVUc0xpbnRQYXRoID09PSAnJykge1xuICAgICAgICByZWxhdGl2ZVRzTGludFBhdGggPSAnLic7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IHRzTGludFJvb3QgPSBhcHBEaXI7XG5cbiAgICBjb25zdCBlMmVPcHRpb25zOiBFMmVPcHRpb25zID0ge1xuICAgICAgbmFtZTogYCR7b3B0aW9ucy5uYW1lfS1lMmVgLFxuICAgICAgcmVsYXRlZEFwcE5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgIHJvb3RTZWxlY3RvcjogYXBwUm9vdFNlbGVjdG9yLFxuICAgIH07XG4gICAgaWYgKG9wdGlvbnMucHJvamVjdFJvb3QgIT09IHVuZGVmaW5lZCkge1xuICAgICAgZTJlT3B0aW9ucy5wcm9qZWN0Um9vdCA9ICdlMmUnO1xuICAgIH1cblxuICAgIHJldHVybiBjaGFpbihbXG4gICAgICBhZGRBcHBUb1dvcmtzcGFjZUZpbGUob3B0aW9ucywgd29ya3NwYWNlKSxcbiAgICAgIG9wdGlvbnMuc2tpcFBhY2thZ2VKc29uID8gbm9vcCgpIDogYWRkRGVwZW5kZW5jaWVzVG9QYWNrYWdlSnNvbigpLFxuICAgICAgbWVyZ2VXaXRoKFxuICAgICAgICBhcHBseSh1cmwoJy4vZmlsZXMvc3JjJyksIFtcbiAgICAgICAgICB0ZW1wbGF0ZSh7XG4gICAgICAgICAgICB1dGlsczogc3RyaW5ncyxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICAnZG90JzogJy4nLFxuICAgICAgICAgICAgcmVsYXRpdmVUc0NvbmZpZ1BhdGgsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbW92ZShzb3VyY2VSb290KSxcbiAgICAgICAgXSkpLFxuICAgICAgbWVyZ2VXaXRoKFxuICAgICAgICBhcHBseSh1cmwoJy4vZmlsZXMvcm9vdCcpLCBbXG4gICAgICAgICAgdGVtcGxhdGUoe1xuICAgICAgICAgICAgdXRpbHM6IHN0cmluZ3MsXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgJ2RvdCc6ICcuJyxcbiAgICAgICAgICAgIHJlbGF0aXZlVHNDb25maWdQYXRoLFxuICAgICAgICAgICAgcm9vdEluU3JjLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG1vdmUoYXBwRGlyKSxcbiAgICAgICAgXSkpLFxuICAgICAgbWVyZ2VXaXRoKFxuICAgICAgICBhcHBseSh1cmwoJy4vZmlsZXMvbGludCcpLCBbXG4gICAgICAgICAgdGVtcGxhdGUoe1xuICAgICAgICAgICAgdXRpbHM6IHN0cmluZ3MsXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgdHNMaW50Um9vdCxcbiAgICAgICAgICAgIHJlbGF0aXZlVHNMaW50UGF0aCxcbiAgICAgICAgICAgIHByZWZpeCxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICAvLyBUT0RPOiBNb3Zpbmcgc2hvdWxkIHdvcmsgYnV0IGlzIGJ1Z2dlZCByaWdodCBub3cuXG4gICAgICAgICAgLy8gVGhlIF9fdHNMaW50Um9vdF9fIGlzIGJlaW5nIHVzZWQgbWVhbndoaWxlLlxuICAgICAgICAgIC8vIE90aGVyd2lzZSB0aGUgdHNsaW50Lmpzb24gZmlsZSBjb3VsZCBiZSBpbnNpZGUgb2YgdGhlIHJvb3QgZm9sZGVyIGFuZFxuICAgICAgICAgIC8vIHRoaXMgYmxvY2sgYW5kIHRoZSBsaW50IGZvbGRlciBjb3VsZCBiZSByZW1vdmVkLlxuICAgICAgICBdKSksXG4gICAgICBzY2hlbWF0aWMoJ21vZHVsZScsIHtcbiAgICAgICAgbmFtZTogJ2FwcCcsXG4gICAgICAgIGNvbW1vbk1vZHVsZTogZmFsc2UsXG4gICAgICAgIGZsYXQ6IHRydWUsXG4gICAgICAgIHJvdXRpbmc6IG9wdGlvbnMucm91dGluZyxcbiAgICAgICAgcm91dGluZ1Njb3BlOiAnUm9vdCcsXG4gICAgICAgIHBhdGg6IHNvdXJjZURpcixcbiAgICAgICAgc3BlYzogZmFsc2UsXG4gICAgICB9KSxcbiAgICAgIHNjaGVtYXRpYygnY29tcG9uZW50Jywge1xuICAgICAgICBuYW1lOiAnYXBwJyxcbiAgICAgICAgc2VsZWN0b3I6IGFwcFJvb3RTZWxlY3RvcixcbiAgICAgICAgZmxhdDogdHJ1ZSxcbiAgICAgICAgcGF0aDogc291cmNlRGlyLFxuICAgICAgICBza2lwSW1wb3J0OiB0cnVlLFxuICAgICAgICAuLi5jb21wb25lbnRPcHRpb25zLFxuICAgICAgfSksXG4gICAgICBtZXJnZVdpdGgoXG4gICAgICAgIGFwcGx5KHVybCgnLi9vdGhlci1maWxlcycpLCBbXG4gICAgICAgICAgY29tcG9uZW50T3B0aW9ucy5pbmxpbmVUZW1wbGF0ZSA/IGZpbHRlcihwYXRoID0+ICFwYXRoLmVuZHNXaXRoKCcuaHRtbCcpKSA6IG5vb3AoKSxcbiAgICAgICAgICAhY29tcG9uZW50T3B0aW9ucy5zcGVjID8gZmlsdGVyKHBhdGggPT4gIXBhdGguZW5kc1dpdGgoJy5zcGVjLnRzJykpIDogbm9vcCgpLFxuICAgICAgICAgIHRlbXBsYXRlKHtcbiAgICAgICAgICAgIHV0aWxzOiBzdHJpbmdzLFxuICAgICAgICAgICAgLi4ub3B0aW9ucyBhcyBhbnksICAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWFueVxuICAgICAgICAgICAgc2VsZWN0b3I6IGFwcFJvb3RTZWxlY3RvcixcbiAgICAgICAgICAgIC4uLmNvbXBvbmVudE9wdGlvbnMsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbW92ZShzb3VyY2VEaXIpLFxuICAgICAgICBdKSwgTWVyZ2VTdHJhdGVneS5PdmVyd3JpdGUpLFxuICAgICAgc2NoZW1hdGljKCdlMmUnLCBlMmVPcHRpb25zKSxcbiAgICBdKShob3N0LCBjb250ZXh0KTtcbiAgfTtcbn1cbiJdfQ==