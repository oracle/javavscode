/*
  Copyright (c) 2023-2024, Oracle and/or its affiliates.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

     https://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
import { appendPrefixToCommand } from "../utils";


export const extCommands = {
    configureRunSettings: appendPrefixToCommand('workspace.configureRunSettings'),
    newFromTemplate: appendPrefixToCommand('workspace.new'),
    newProject: appendPrefixToCommand('workspace.newproject'),
    openTest: appendPrefixToCommand('open.test'),
    deleteCache: appendPrefixToCommand('delete.cache'),
    downloadJdk: appendPrefixToCommand('download.jdk'),
    compileWorkspace: appendPrefixToCommand('workspace.compile'),
    cleanWorkspace: appendPrefixToCommand('workspace.clean'),
    compileProject: appendPrefixToCommand('project.compile'),
    cleanProject: appendPrefixToCommand('project.clean'),
    openType: appendPrefixToCommand('open.type'),
    goToSuperImpl: appendPrefixToCommand('java.goto.super.implementation'),
    renameElement: appendPrefixToCommand('rename.element.at'),
    surroundWith: appendPrefixToCommand('surround.with'),
    generateCode: appendPrefixToCommand('generate.code'),
    runTest: appendPrefixToCommand('run.test'),
    debugTest: appendPrefixToCommand('debug.test'),
    runSingle: appendPrefixToCommand('run.single'),
    debugSingle: appendPrefixToCommand('debug.single'),
    projectRun: appendPrefixToCommand('project.run'),
    projectDebug: appendPrefixToCommand('project.debug'),
    projectTest: appendPrefixToCommand('project.test'),
    packageTest: appendPrefixToCommand('package.test'),
    openStackTrace: appendPrefixToCommand('open.stacktrace'),
    workspaceSymbols: appendPrefixToCommand('workspace.symbols'),
    abstractMethodsComplete: appendPrefixToCommand('java.complete.abstract.methods'),
    startupCondition: appendPrefixToCommand('startup.condition'),
    nbEventListener: appendPrefixToCommand('addEventListener'),
    selectEditorProjs: appendPrefixToCommand('select.editor.projects'),
    attachDebuggerConnector: appendPrefixToCommand("java.attachDebugger.connector"),
    attachDebuggerConfigurations: appendPrefixToCommand("java.attachDebugger.configurations"),
    loadWorkspaceTests: appendPrefixToCommand("load.workspace.tests"),
    projectDeleteEntry: appendPrefixToCommand("foundProjects.deleteEntry")
}

export const builtInCommands = {
    setCustomContext: 'setContext',
    openFolder: 'vscode.openFolder',
    reloadWindow: 'workbench.action.reloadWindow',
    focusActiveEditorGroup: 'workbench.action.focusActiveEditorGroup',
    goToEditorLocations: 'editor.action.goToLocations',
    renameSymbol: 'editor.action.rename',
    quickAccess: 'workbench.action.quickOpen',
    openSettings: 'workbench.action.openSettings',
    startDebug: 'workbench.action.debug.start',
    focusReplDebug: 'workbench.debug.action.focusRepl',
}

export const nbCommands = {
    newFromTemplate: appendPrefixToCommand('new.from.template'),
    newProject: appendPrefixToCommand('new.project'),
    goToTest: appendPrefixToCommand('go.to.test'),
    quickOpen: appendPrefixToCommand('quick.open'),
    superImpl: appendPrefixToCommand('java.super.implementation'),
    resolveStackLocation: appendPrefixToCommand('resolve.stacktrace.location'),
    implementAbstractMethods: appendPrefixToCommand('java.implement.all.abstract.methods'),
    archiveFileContent: appendPrefixToCommand('get.archive.file.content'),
    htmlProcessCmd: appendPrefixToCommand('htmlui.process.command'),
    projectConfigurations: appendPrefixToCommand('project.configurations'),
    debuggerConfigurations: appendPrefixToCommand('java.attachDebugger.configurations'),
    runProjectAction: appendPrefixToCommand('project.run.action'),
    buildWorkspace: appendPrefixToCommand('build.workspace'),
    cleanWorkspace: appendPrefixToCommand('clean.workspace'),
    clearProjectCaches: appendPrefixToCommand('clear.project.caches'),
    javaProjectPackages: appendPrefixToCommand('java.get.project.packages'),
    openStackTrace: appendPrefixToCommand('open.stacktrace')
}