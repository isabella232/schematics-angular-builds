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
const tasks_1 = require("@angular-devkit/schematics/tasks");
const ts = require("typescript");
const ast_utils_1 = require("../utility/ast-utils");
const change_1 = require("../utility/change");
const config_1 = require("../utility/config");
const dependencies_1 = require("../utility/dependencies");
const ng_ast_utils_1 = require("../utility/ng-ast-utils");
const project_1 = require("../utility/project");
const project_targets_1 = require("../utility/project-targets");
const workspace_models_1 = require("../utility/workspace-models");
function getFileReplacements(target) {
    const fileReplacements = target.build &&
        target.build.configurations &&
        target.build.configurations.production &&
        target.build.configurations.production.fileReplacements;
    return fileReplacements || [];
}
function updateConfigFile(options, tsConfigDirectory) {
    return (host) => {
        const workspace = config_1.getWorkspace(host);
        const clientProject = project_1.getProject(workspace, options.clientProject);
        const projectTargets = project_targets_1.getProjectTargets(clientProject);
        projectTargets.server = {
            builder: workspace_models_1.Builders.Server,
            options: {
                outputPath: `dist/${options.clientProject}-server`,
                main: `${clientProject.root}src/main.server.ts`,
                tsConfig: core_1.join(tsConfigDirectory, `${options.tsconfigFileName}.json`),
            },
            configurations: {
                production: {
                    fileReplacements: getFileReplacements(projectTargets),
                    sourceMap: false,
                    optimization: {
                        scripts: false,
                        styles: true,
                    },
                },
            },
        };
        return config_1.updateWorkspace(workspace);
    };
}
function findBrowserModuleImport(host, modulePath) {
    const moduleBuffer = host.read(modulePath);
    if (!moduleBuffer) {
        throw new schematics_1.SchematicsException(`Module file (${modulePath}) not found`);
    }
    const moduleFileText = moduleBuffer.toString('utf-8');
    const source = ts.createSourceFile(modulePath, moduleFileText, ts.ScriptTarget.Latest, true);
    const decoratorMetadata = ast_utils_1.getDecoratorMetadata(source, 'NgModule', '@angular/core')[0];
    const browserModuleNode = ast_utils_1.findNode(decoratorMetadata, ts.SyntaxKind.Identifier, 'BrowserModule');
    if (browserModuleNode === null) {
        throw new schematics_1.SchematicsException(`Cannot find BrowserModule import in ${modulePath}`);
    }
    return browserModuleNode;
}
function wrapBootstrapCall(options) {
    return (host) => {
        const clientTargets = project_targets_1.getProjectTargets(host, options.clientProject);
        if (!clientTargets.build) {
            throw project_targets_1.targetBuildNotFoundError();
        }
        const mainPath = core_1.normalize('/' + clientTargets.build.options.main);
        let bootstrapCall = ng_ast_utils_1.findBootstrapModuleCall(host, mainPath);
        if (bootstrapCall === null) {
            throw new schematics_1.SchematicsException('Bootstrap module not found.');
        }
        let bootstrapCallExpression = null;
        let currentCall = bootstrapCall;
        while (bootstrapCallExpression === null && currentCall.parent) {
            currentCall = currentCall.parent;
            if (currentCall.kind === ts.SyntaxKind.ExpressionStatement) {
                bootstrapCallExpression = currentCall;
            }
        }
        bootstrapCall = currentCall;
        const recorder = host.beginUpdate(mainPath);
        const beforeText = `document.addEventListener('DOMContentLoaded', () => {\n  `;
        const afterText = `\n});`;
        recorder.insertLeft(bootstrapCall.getStart(), beforeText);
        recorder.insertRight(bootstrapCall.getEnd(), afterText);
        host.commitUpdate(recorder);
    };
}
function addServerTransition(options) {
    return (host) => {
        const clientProject = project_1.getProject(host, options.clientProject);
        const clientTargets = project_targets_1.getProjectTargets(clientProject);
        if (!clientTargets.build) {
            throw project_targets_1.targetBuildNotFoundError();
        }
        const mainPath = core_1.normalize('/' + clientTargets.build.options.main);
        const bootstrapModuleRelativePath = ng_ast_utils_1.findBootstrapModulePath(host, mainPath);
        const bootstrapModulePath = core_1.normalize(`/${clientProject.root}/src/${bootstrapModuleRelativePath}.ts`);
        const browserModuleImport = findBrowserModuleImport(host, bootstrapModulePath);
        const appId = options.appId;
        const transitionCall = `.withServerTransition({ appId: '${appId}' })`;
        const position = browserModuleImport.pos + browserModuleImport.getFullText().length;
        const transitionCallChange = new change_1.InsertChange(bootstrapModulePath, position, transitionCall);
        const transitionCallRecorder = host.beginUpdate(bootstrapModulePath);
        transitionCallRecorder.insertLeft(transitionCallChange.pos, transitionCallChange.toAdd);
        host.commitUpdate(transitionCallRecorder);
    };
}
function addDependencies() {
    return (host) => {
        const coreDep = dependencies_1.getPackageJsonDependency(host, '@angular/core');
        if (coreDep === null) {
            throw new schematics_1.SchematicsException('Could not find version.');
        }
        const platformServerDep = Object.assign({}, coreDep, { name: '@angular/platform-server' });
        const httpDep = Object.assign({}, coreDep, { name: '@angular/http' });
        dependencies_1.addPackageJsonDependency(host, platformServerDep);
        dependencies_1.addPackageJsonDependency(host, httpDep);
        return host;
    };
}
function getTsConfigOutDir(host, targets) {
    const tsConfigPath = targets.build.options.tsConfig;
    const tsConfigBuffer = host.read(tsConfigPath);
    if (!tsConfigBuffer) {
        throw new schematics_1.SchematicsException(`Could not read ${tsConfigPath}`);
    }
    const tsConfigContent = tsConfigBuffer.toString();
    const tsConfig = core_1.parseJson(tsConfigContent);
    if (tsConfig === null || typeof tsConfig !== 'object' || Array.isArray(tsConfig) ||
        tsConfig.compilerOptions === null || typeof tsConfig.compilerOptions !== 'object' ||
        Array.isArray(tsConfig.compilerOptions)) {
        throw new schematics_1.SchematicsException(`Invalid tsconfig - ${tsConfigPath}`);
    }
    const outDir = tsConfig.compilerOptions.outDir;
    return outDir;
}
function default_1(options) {
    return (host, context) => {
        const clientProject = project_1.getProject(host, options.clientProject);
        if (clientProject.projectType !== 'application') {
            throw new schematics_1.SchematicsException(`Universal requires a project type of "application".`);
        }
        const clientTargets = project_targets_1.getProjectTargets(clientProject);
        const outDir = getTsConfigOutDir(host, clientTargets);
        if (!clientTargets.build) {
            throw project_targets_1.targetBuildNotFoundError();
        }
        const tsConfigExtends = core_1.basename(core_1.normalize(clientTargets.build.options.tsConfig));
        const rootInSrc = clientProject.root === '';
        const tsConfigDirectory = core_1.join(core_1.normalize(clientProject.root), rootInSrc ? 'src' : '');
        if (!options.skipInstall) {
            context.addTask(new tasks_1.NodePackageInstallTask());
        }
        const templateSource = schematics_1.apply(schematics_1.url('./files/src'), [
            schematics_1.template(Object.assign({}, core_1.strings, options, { stripTsExtension: (s) => s.replace(/\.ts$/, '') })),
            schematics_1.move(core_1.join(core_1.normalize(clientProject.root), 'src')),
        ]);
        const rootSource = schematics_1.apply(schematics_1.url('./files/root'), [
            schematics_1.template(Object.assign({}, core_1.strings, options, { stripTsExtension: (s) => s.replace(/\.ts$/, ''), outDir,
                tsConfigExtends,
                rootInSrc })),
            schematics_1.move(tsConfigDirectory),
        ]);
        return schematics_1.chain([
            schematics_1.mergeWith(templateSource),
            schematics_1.mergeWith(rootSource),
            addDependencies(),
            updateConfigFile(options, tsConfigDirectory),
            wrapBootstrapCall(options),
            addServerTransition(options),
        ]);
    };
}
exports.default = default_1;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL3NjaGVtYXRpY3MvYW5ndWxhci91bml2ZXJzYWwvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7O0dBTUc7QUFDSCwrQ0FROEI7QUFDOUIsMkRBV29DO0FBQ3BDLDREQUUwQztBQUMxQyxpQ0FBaUM7QUFDakMsb0RBQXNFO0FBQ3RFLDhDQUFpRDtBQUNqRCw4Q0FBa0U7QUFDbEUsMERBQTZGO0FBQzdGLDBEQUEyRjtBQUMzRixnREFBZ0Q7QUFDaEQsZ0VBQXlGO0FBQ3pGLGtFQUF5RTtBQUl6RSxTQUFTLG1CQUFtQixDQUFDLE1BQXdCO0lBQ25ELE1BQU0sZ0JBQWdCLEdBQ3BCLE1BQU0sQ0FBQyxLQUFLO1FBQ1osTUFBTSxDQUFDLEtBQUssQ0FBQyxjQUFjO1FBQzNCLE1BQU0sQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLFVBQVU7UUFDdEMsTUFBTSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDO0lBRTFELE9BQU8sZ0JBQWdCLElBQUksRUFBRSxDQUFDO0FBQ2hDLENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLE9BQXlCLEVBQUUsaUJBQXVCO0lBQzFFLE9BQU8sQ0FBQyxJQUFVLEVBQUUsRUFBRTtRQUNwQixNQUFNLFNBQVMsR0FBRyxxQkFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3JDLE1BQU0sYUFBYSxHQUFHLG9CQUFVLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNuRSxNQUFNLGNBQWMsR0FBRyxtQ0FBaUIsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUV4RCxjQUFjLENBQUMsTUFBTSxHQUFHO1lBQ3RCLE9BQU8sRUFBRSwyQkFBUSxDQUFDLE1BQU07WUFDeEIsT0FBTyxFQUFFO2dCQUNQLFVBQVUsRUFBRSxRQUFRLE9BQU8sQ0FBQyxhQUFhLFNBQVM7Z0JBQ2xE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LENBQUMsQ0FBQztRQUVILE9BQU8sa0JBQUssQ0FBQztZQUNYLHNCQUFTLENBQUMsY0FBYyxDQUFDO1lBQ3pCLHNCQUFTLENBQUMsVUFBVSxDQUFDO1lBQ3JCLGVBQWUsRUFBRTtZQUNqQixnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsaUJBQWlCLENBQUM7WUFDNUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDO1lBQzFCLG1CQUFtQixDQUFDLE9BQU8sQ0FBQztTQUM3QixDQUFDLENBQUM7SUFDTCxDQUFDLENBQUM7QUFDSixDQUFDO0FBakRELDRCQWlEQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7XG4gIFBhdGgsXG4gIGJhc2VuYW1lLFxuICBleHBlcmltZW50YWwsXG4gIGpvaW4sXG4gIG5vcm1hbGl6ZSxcbiAgcGFyc2VKc29uLFxuICBzdHJpbmdzLFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQge1xuICBSdWxlLFxuICBTY2hlbWF0aWNDb250ZXh0LFxuICBTY2hlbWF0aWNzRXhjZXB0aW9uLFxuICBUcmVlLFxuICBhcHBseSxcbiAgY2hhaW4sXG4gIG1lcmdlV2l0aCxcbiAgbW92ZSxcbiAgdGVtcGxhdGUsXG4gIHVybCxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MnO1xuaW1wb3J0IHtcbiAgTm9kZVBhY2thZ2VJbnN0YWxsVGFzayxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MvdGFza3MnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBmaW5kTm9kZSwgZ2V0RGVjb3JhdG9yTWV0YWRhdGEgfSBmcm9tICcuLi91dGlsaXR5L2FzdC11dGlscyc7XG5pbXBvcnQgeyBJbnNlcnRDaGFuZ2UgfSBmcm9tICcuLi91dGlsaXR5L2NoYW5nZSc7XG5pbXBvcnQgeyBnZXRXb3Jrc3BhY2UsIHVwZGF0ZVdvcmtzcGFjZSB9IGZyb20gJy4uL3V0aWxpdHkvY29uZmlnJztcbmltcG9ydCB7IGFkZFBhY2thZ2VKc29uRGVwZW5kZW5jeSwgZ2V0UGFja2FnZUpzb25EZXBlbmRlbmN5IH0gZnJvbSAnLi4vdXRpbGl0eS9kZXBlbmRlbmNpZXMnO1xuaW1wb3J0IHsgZmluZEJvb3RzdHJhcE1vZHVsZUNhbGwsIGZpbmRCb290c3RyYXBNb2R1bGVQYXRoIH0gZnJvbSAnLi4vdXRpbGl0eS9uZy1hc3QtdXRpbHMnO1xuaW1wb3J0IHsgZ2V0UHJvamVjdCB9IGZyb20gJy4uL3V0aWxpdHkvcHJvamVjdCc7XG5pbXBvcnQgeyBnZXRQcm9qZWN0VGFyZ2V0cywgdGFyZ2V0QnVpbGROb3RGb3VuZEVycm9yIH0gZnJvbSAnLi4vdXRpbGl0eS9wcm9qZWN0LXRhcmdldHMnO1xuaW1wb3J0IHsgQnVpbGRlcnMsIFdvcmtzcGFjZVRhcmdldHMgfSBmcm9tICcuLi91dGlsaXR5L3dvcmtzcGFjZS1tb2RlbHMnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIFVuaXZlcnNhbE9wdGlvbnMgfSBmcm9tICcuL3NjaGVtYSc7XG5cblxuZnVuY3Rpb24gZ2V0RmlsZVJlcGxhY2VtZW50cyh0YXJnZXQ6IFdvcmtzcGFjZVRhcmdldHMpIHtcbiAgY29uc3QgZmlsZVJlcGxhY2VtZW50cyA9XG4gICAgdGFyZ2V0LmJ1aWxkICYmXG4gICAgdGFyZ2V0LmJ1aWxkLmNvbmZpZ3VyYXRpb25zICYmXG4gICAgdGFyZ2V0LmJ1aWxkLmNvbmZpZ3VyYXRpb25zLnByb2R1Y3Rpb24gJiZcbiAgICB0YXJnZXQuYnVpbGQuY29uZmlndXJhdGlvbnMucHJvZHVjdGlvbi5maWxlUmVwbGFjZW1lbnRzO1xuXG4gIHJldHVybiBmaWxlUmVwbGFjZW1lbnRzIHx8IFtdO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVDb25maWdGaWxlKG9wdGlvbnM6IFVuaXZlcnNhbE9wdGlvbnMsIHRzQ29uZmlnRGlyZWN0b3J5OiBQYXRoKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIGNvbnN0IHdvcmtzcGFjZSA9IGdldFdvcmtzcGFjZShob3N0KTtcbiAgICBjb25zdCBjbGllbnRQcm9qZWN0ID0gZ2V0UHJvamVjdCh3b3Jrc3BhY2UsIG9wdGlvbnMuY2xpZW50UHJvamVjdCk7XG4gICAgY29uc3QgcHJvamVjdFRhcmdldHMgPSBnZXRQcm9qZWN0VGFyZ2V0cyhjbGllbnRQcm9qZWN0KTtcblxuICAgIHByb2plY3RUYXJnZXRzLnNlcnZlciA9IHtcbiAgICAgIGJ1aWxkZXI6IEJ1aWxkZXJzLlNlcnZlcixcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgb3V0cHV0UGF0aDogYGRpc3QvJHtvcHRpb25zLmNsaWVudFByb2plY3R9LXNlcnZlcmAsXG4gICAgICAgIG1haW46IGAke2NsaWVudFByb2plY3Qucm9vdH1zcmMvbWFpbi5zZXJ2ZXIudHNgLFxuICAgICAgICB0c0NvbmZpZzogam9pbih0c0NvbmZpZ0RpcmVjdG9yeSwgYCR7b3B0aW9ucy50c2NvbmZpZ0ZpbGVOYW1lfS5qc29uYCksXG4gICAgICB9LFxuICAgICAgY29uZmlndXJhdGlvbnM6IHtcbiAgICAgICAgcHJvZHVjdGlvbjoge1xuICAgICAgICAgIGZpbGVSZXBsYWNlbWVudHM6IGdldEZpbGVSZXBsYWNlbWVudHMocHJvamVjdFRhcmdldHMpLFxuICAgICAgICAgIHNvdXJjZU1hcDogZmFsc2UsXG4gICAgICAgICAgb3B0aW1pemF0aW9uOiB7XG4gICAgICAgICAgICBzY3JpcHRzOiBmYWxzZSxcbiAgICAgICAgICAgIHN0eWxlczogdHJ1ZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgcmV0dXJuIHVwZGF0ZVdvcmtzcGFjZSh3b3Jrc3BhY2UpO1xuICB9O1xufVxuXG5mdW5jdGlvbiBmaW5kQnJvd3Nlck1vZHVsZUltcG9ydChob3N0OiBUcmVlLCBtb2R1bGVQYXRoOiBzdHJpbmcpOiB0cy5Ob2RlIHtcbiAgY29uc3QgbW9kdWxlQnVmZmVyID0gaG9zdC5yZWFkKG1vZHVsZVBhdGgpO1xuICBpZiAoIW1vZHVsZUJ1ZmZlcikge1xuICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKGBNb2R1bGUgZmlsZSAoJHttb2R1bGVQYXRofSkgbm90IGZvdW5kYCk7XG4gIH1cbiAgY29uc3QgbW9kdWxlRmlsZVRleHQgPSBtb2R1bGVCdWZmZXIudG9TdHJpbmcoJ3V0Zi04Jyk7XG5cbiAgY29uc3Qgc291cmNlID0gdHMuY3JlYXRlU291cmNlRmlsZShtb2R1bGVQYXRoLCBtb2R1bGVGaWxlVGV4dCwgdHMuU2NyaXB0VGFyZ2V0LkxhdGVzdCwgdHJ1ZSk7XG5cbiAgY29uc3QgZGVjb3JhdG9yTWV0YWRhdGEgPSBnZXREZWNvcmF0b3JNZXRhZGF0YShzb3VyY2UsICdOZ01vZHVsZScsICdAYW5ndWxhci9jb3JlJylbMF07XG4gIGNvbnN0IGJyb3dzZXJNb2R1bGVOb2RlID0gZmluZE5vZGUoZGVjb3JhdG9yTWV0YWRhdGEsIHRzLlN5bnRheEtpbmQuSWRlbnRpZmllciwgJ0Jyb3dzZXJNb2R1bGUnKTtcblxuICBpZiAoYnJvd3Nlck1vZHVsZU5vZGUgPT09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbihgQ2Fubm90IGZpbmQgQnJvd3Nlck1vZHVsZSBpbXBvcnQgaW4gJHttb2R1bGVQYXRofWApO1xuICB9XG5cbiAgcmV0dXJuIGJyb3dzZXJNb2R1bGVOb2RlO1xufVxuXG5mdW5jdGlvbiB3cmFwQm9vdHN0cmFwQ2FsbChvcHRpb25zOiBVbml2ZXJzYWxPcHRpb25zKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIGNvbnN0IGNsaWVudFRhcmdldHMgPSBnZXRQcm9qZWN0VGFyZ2V0cyhob3N0LCBvcHRpb25zLmNsaWVudFByb2plY3QpO1xuICAgIGlmICghY2xpZW50VGFyZ2V0cy5idWlsZCkge1xuICAgICAgdGhyb3cgdGFyZ2V0QnVpbGROb3RGb3VuZEVycm9yKCk7XG4gICAgfVxuICAgIGNvbnN0IG1haW5QYXRoID0gbm9ybWFsaXplKCcvJyArIGNsaWVudFRhcmdldHMuYnVpbGQub3B0aW9ucy5tYWluKTtcbiAgICBsZXQgYm9vdHN0cmFwQ2FsbDogdHMuTm9kZSB8IG51bGwgPSBmaW5kQm9vdHN0cmFwTW9kdWxlQ2FsbChob3N0LCBtYWluUGF0aCk7XG4gICAgaWYgKGJvb3RzdHJhcENhbGwgPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKCdCb290c3RyYXAgbW9kdWxlIG5vdCBmb3VuZC4nKTtcbiAgICB9XG5cbiAgICBsZXQgYm9vdHN0cmFwQ2FsbEV4cHJlc3Npb246IHRzLk5vZGUgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgY3VycmVudENhbGwgPSBib290c3RyYXBDYWxsO1xuICAgIHdoaWxlIChib290c3RyYXBDYWxsRXhwcmVzc2lvbiA9PT0gbnVsbCAmJiBjdXJyZW50Q2FsbC5wYXJlbnQpIHtcbiAgICAgIGN1cnJlbnRDYWxsID0gY3VycmVudENhbGwucGFyZW50O1xuICAgICAgaWYgKGN1cnJlbnRDYWxsLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuRXhwcmVzc2lvblN0YXRlbWVudCkge1xuICAgICAgICBib290c3RyYXBDYWxsRXhwcmVzc2lvbiA9IGN1cnJlbnRDYWxsO1xuICAgICAgfVxuICAgIH1cbiAgICBib290c3RyYXBDYWxsID0gY3VycmVudENhbGw7XG5cbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUobWFpblBhdGgpO1xuICAgIGNvbnN0IGJlZm9yZVRleHQgPSBgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsICgpID0+IHtcXG4gIGA7XG4gICAgY29uc3QgYWZ0ZXJUZXh0ID0gYFxcbn0pO2A7XG4gICAgcmVjb3JkZXIuaW5zZXJ0TGVmdChib290c3RyYXBDYWxsLmdldFN0YXJ0KCksIGJlZm9yZVRleHQpO1xuICAgIHJlY29yZGVyLmluc2VydFJpZ2h0KGJvb3RzdHJhcENhbGwuZ2V0RW5kKCksIGFmdGVyVGV4dCk7XG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICB9O1xufVxuXG5mdW5jdGlvbiBhZGRTZXJ2ZXJUcmFuc2l0aW9uKG9wdGlvbnM6IFVuaXZlcnNhbE9wdGlvbnMpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgY29uc3QgY2xpZW50UHJvamVjdCA9IGdldFByb2plY3QoaG9zdCwgb3B0aW9ucy5jbGllbnRQcm9qZWN0KTtcbiAgICBjb25zdCBjbGllbnRUYXJnZXRzID0gZ2V0UHJvamVjdFRhcmdldHMoY2xpZW50UHJvamVjdCk7XG4gICAgaWYgKCFjbGllbnRUYXJnZXRzLmJ1aWxkKSB7XG4gICAgICB0aHJvdyB0YXJnZXRCdWlsZE5vdEZvdW5kRXJyb3IoKTtcbiAgICB9XG4gICAgY29uc3QgbWFpblBhdGggPSBub3JtYWxpemUoJy8nICsgY2xpZW50VGFyZ2V0cy5idWlsZC5vcHRpb25zLm1haW4pO1xuXG4gICAgY29uc3QgYm9vdHN0cmFwTW9kdWxlUmVsYXRpdmVQYXRoID0gZmluZEJvb3RzdHJhcE1vZHVsZVBhdGgoaG9zdCwgbWFpblBhdGgpO1xuICAgIGNvbnN0IGJvb3RzdHJhcE1vZHVsZVBhdGggPSBub3JtYWxpemUoXG4gICAgICBgLyR7Y2xpZW50UHJvamVjdC5yb290fS9zcmMvJHtib290c3RyYXBNb2R1bGVSZWxhdGl2ZVBhdGh9LnRzYCk7XG5cbiAgICBjb25zdCBicm93c2VyTW9kdWxlSW1wb3J0ID0gZmluZEJyb3dzZXJNb2R1bGVJbXBvcnQoaG9zdCwgYm9vdHN0cmFwTW9kdWxlUGF0aCk7XG4gICAgY29uc3QgYXBwSWQgPSBvcHRpb25zLmFwcElkO1xuICAgIGNvbnN0IHRyYW5zaXRpb25DYWxsID0gYC53aXRoU2VydmVyVHJhbnNpdGlvbih7IGFwcElkOiAnJHthcHBJZH0nIH0pYDtcbiAgICBjb25zdCBwb3NpdGlvbiA9IGJyb3dzZXJNb2R1bGVJbXBvcnQucG9zICsgYnJvd3Nlck1vZHVsZUltcG9ydC5nZXRGdWxsVGV4dCgpLmxlbmd0aDtcbiAgICBjb25zdCB0cmFuc2l0aW9uQ2FsbENoYW5nZSA9IG5ldyBJbnNlcnRDaGFuZ2UoXG4gICAgICBib290c3RyYXBNb2R1bGVQYXRoLCBwb3NpdGlvbiwgdHJhbnNpdGlvbkNhbGwpO1xuXG4gICAgY29uc3QgdHJhbnNpdGlvbkNhbGxSZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUoYm9vdHN0cmFwTW9kdWxlUGF0aCk7XG4gICAgdHJhbnNpdGlvbkNhbGxSZWNvcmRlci5pbnNlcnRMZWZ0KHRyYW5zaXRpb25DYWxsQ2hhbmdlLnBvcywgdHJhbnNpdGlvbkNhbGxDaGFuZ2UudG9BZGQpO1xuICAgIGhvc3QuY29tbWl0VXBkYXRlKHRyYW5zaXRpb25DYWxsUmVjb3JkZXIpO1xuICB9O1xufVxuXG5mdW5jdGlvbiBhZGREZXBlbmRlbmNpZXMoKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIGNvbnN0IGNvcmVEZXAgPSBnZXRQYWNrYWdlSnNvbkRlcGVuZGVuY3koaG9zdCwgJ0Bhbmd1bGFyL2NvcmUnKTtcbiAgICBpZiAoY29yZURlcCA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oJ0NvdWxkIG5vdCBmaW5kIHZlcnNpb24uJyk7XG4gICAgfVxuICAgIGNvbnN0IHBsYXRmb3JtU2VydmVyRGVwID0ge1xuICAgICAgLi4uY29yZURlcCxcbiAgICAgIG5hbWU6ICdAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXInLFxuICAgIH07XG4gICAgY29uc3QgaHR0cERlcCA9IHtcbiAgICAgIC4uLmNvcmVEZXAsXG4gICAgICBuYW1lOiAnQGFuZ3VsYXIvaHR0cCcsXG4gICAgfTtcbiAgICBhZGRQYWNrYWdlSnNvbkRlcGVuZGVuY3koaG9zdCwgcGxhdGZvcm1TZXJ2ZXJEZXApO1xuICAgIGFkZFBhY2thZ2VKc29uRGVwZW5kZW5jeShob3N0LCBodHRwRGVwKTtcblxuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG5mdW5jdGlvbiBnZXRUc0NvbmZpZ091dERpcihob3N0OiBUcmVlLCB0YXJnZXRzOiBleHBlcmltZW50YWwud29ya3NwYWNlLldvcmtzcGFjZVRvb2wpOiBzdHJpbmcge1xuICBjb25zdCB0c0NvbmZpZ1BhdGggPSB0YXJnZXRzLmJ1aWxkLm9wdGlvbnMudHNDb25maWc7XG4gIGNvbnN0IHRzQ29uZmlnQnVmZmVyID0gaG9zdC5yZWFkKHRzQ29uZmlnUGF0aCk7XG4gIGlmICghdHNDb25maWdCdWZmZXIpIHtcbiAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbihgQ291bGQgbm90IHJlYWQgJHt0c0NvbmZpZ1BhdGh9YCk7XG4gIH1cbiAgY29uc3QgdHNDb25maWdDb250ZW50ID0gdHNDb25maWdCdWZmZXIudG9TdHJpbmcoKTtcbiAgY29uc3QgdHNDb25maWcgPSBwYXJzZUpzb24odHNDb25maWdDb250ZW50KTtcbiAgaWYgKHRzQ29uZmlnID09PSBudWxsIHx8IHR5cGVvZiB0c0NvbmZpZyAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheSh0c0NvbmZpZykgfHxcbiAgICB0c0NvbmZpZy5jb21waWxlck9wdGlvbnMgPT09IG51bGwgfHwgdHlwZW9mIHRzQ29uZmlnLmNvbXBpbGVyT3B0aW9ucyAhPT0gJ29iamVjdCcgfHxcbiAgICBBcnJheS5pc0FycmF5KHRzQ29uZmlnLmNvbXBpbGVyT3B0aW9ucykpIHtcbiAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbihgSW52YWxpZCB0c2NvbmZpZyAtICR7dHNDb25maWdQYXRofWApO1xuICB9XG4gIGNvbnN0IG91dERpciA9IHRzQ29uZmlnLmNvbXBpbGVyT3B0aW9ucy5vdXREaXI7XG5cbiAgcmV0dXJuIG91dERpciBhcyBzdHJpbmc7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChvcHRpb25zOiBVbml2ZXJzYWxPcHRpb25zKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IGNsaWVudFByb2plY3QgPSBnZXRQcm9qZWN0KGhvc3QsIG9wdGlvbnMuY2xpZW50UHJvamVjdCk7XG4gICAgaWYgKGNsaWVudFByb2plY3QucHJvamVjdFR5cGUgIT09ICdhcHBsaWNhdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKGBVbml2ZXJzYWwgcmVxdWlyZXMgYSBwcm9qZWN0IHR5cGUgb2YgXCJhcHBsaWNhdGlvblwiLmApO1xuICAgIH1cbiAgICBjb25zdCBjbGllbnRUYXJnZXRzID0gZ2V0UHJvamVjdFRhcmdldHMoY2xpZW50UHJvamVjdCk7XG4gICAgY29uc3Qgb3V0RGlyID0gZ2V0VHNDb25maWdPdXREaXIoaG9zdCwgY2xpZW50VGFyZ2V0cyk7XG4gICAgaWYgKCFjbGllbnRUYXJnZXRzLmJ1aWxkKSB7XG4gICAgICB0aHJvdyB0YXJnZXRCdWlsZE5vdEZvdW5kRXJyb3IoKTtcbiAgICB9XG4gICAgY29uc3QgdHNDb25maWdFeHRlbmRzID0gYmFzZW5hbWUobm9ybWFsaXplKGNsaWVudFRhcmdldHMuYnVpbGQub3B0aW9ucy50c0NvbmZpZykpO1xuICAgIGNvbnN0IHJvb3RJblNyYyA9IGNsaWVudFByb2plY3Qucm9vdCA9PT0gJyc7XG4gICAgY29uc3QgdHNDb25maWdEaXJlY3RvcnkgPSBqb2luKG5vcm1hbGl6ZShjbGllbnRQcm9qZWN0LnJvb3QpLCByb290SW5TcmMgPyAnc3JjJyA6ICcnKTtcblxuICAgIGlmICghb3B0aW9ucy5za2lwSW5zdGFsbCkge1xuICAgICAgY29udGV4dC5hZGRUYXNrKG5ldyBOb2RlUGFja2FnZUluc3RhbGxUYXNrKCkpO1xuICAgIH1cblxuICAgIGNvbnN0IHRlbXBsYXRlU291cmNlID0gYXBwbHkodXJsKCcuL2ZpbGVzL3NyYycpLCBbXG4gICAgICB0ZW1wbGF0ZSh7XG4gICAgICAgIC4uLnN0cmluZ3MsXG4gICAgICAgIC4uLm9wdGlvbnMgYXMgb2JqZWN0LFxuICAgICAgICBzdHJpcFRzRXh0ZW5zaW9uOiAoczogc3RyaW5nKSA9PiBzLnJlcGxhY2UoL1xcLnRzJC8sICcnKSxcbiAgICAgIH0pLFxuICAgICAgbW92ZShqb2luKG5vcm1hbGl6ZShjbGllbnRQcm9qZWN0LnJvb3QpLCAnc3JjJykpLFxuICAgIF0pO1xuXG4gICAgY29uc3Qgcm9vdFNvdXJjZSA9IGFwcGx5KHVybCgnLi9maWxlcy9yb290JyksIFtcbiAgICAgIHRlbXBsYXRlKHtcbiAgICAgICAgLi4uc3RyaW5ncyxcbiAgICAgICAgLi4ub3B0aW9ucyBhcyBvYmplY3QsXG4gICAgICAgIHN0cmlwVHNFeHRlbnNpb246IChzOiBzdHJpbmcpID0+IHMucmVwbGFjZSgvXFwudHMkLywgJycpLFxuICAgICAgICBvdXREaXIsXG4gICAgICAgIHRzQ29uZmlnRXh0ZW5kcyxcbiAgICAgICAgcm9vdEluU3JjLFxuICAgICAgfSksXG4gICAgICBtb3ZlKHRzQ29uZmlnRGlyZWN0b3J5KSxcbiAgICBdKTtcblxuICAgIHJldHVybiBjaGFpbihbXG4gICAgICBtZXJnZVdpdGgodGVtcGxhdGVTb3VyY2UpLFxuICAgICAgbWVyZ2VXaXRoKHJvb3RTb3VyY2UpLFxuICAgICAgYWRkRGVwZW5kZW5jaWVzKCksXG4gICAgICB1cGRhdGVDb25maWdGaWxlKG9wdGlvbnMsIHRzQ29uZmlnRGlyZWN0b3J5KSxcbiAgICAgIHdyYXBCb290c3RyYXBDYWxsKG9wdGlvbnMpLFxuICAgICAgYWRkU2VydmVyVHJhbnNpdGlvbihvcHRpb25zKSxcbiAgICBdKTtcbiAgfTtcbn1cbiJdfQ==