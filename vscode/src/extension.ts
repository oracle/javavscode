/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/* This file has been modified for Oracle Java SE extension */

'use strict';

import { commands, window, workspace, ExtensionContext, TextEditorDecorationType } from 'vscode';

import {
	LanguageClient,
	StreamInfo
} from 'vscode-languageclient/node';

import {
    MessageType,
    LogMessageNotification,
    TelemetryEventNotification
} from 'vscode-languageclient';

import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { StreamDebugAdapter} from './streamDebugAdapter';
import { NbTestAdapter } from './testAdapter';
import { asRanges, StatusMessageRequest, ShowStatusMessageParams, QuickPickRequest, InputBoxRequest, MutliStepInputRequest, TestProgressNotification, DebugConnector,
         TextEditorDecorationCreateRequest, TextEditorDecorationSetNotification, TextEditorDecorationDisposeNotification, HtmlPageRequest, HtmlPageParams,
         ExecInHtmlPageRequest, SetTextEditorDecorationParams, UpdateConfigurationRequest, QuickPickStep, InputBoxStep, SaveDocumentsRequest, SaveDocumentRequestParams
} from './lsp/protocol';
import * as launchConfigurations from './launchConfigurations';
import { TreeViewService, Visualizer } from './explorer';
import { initializeRunConfiguration, runConfigurationProvider, runConfigurationNodeProvider, configureRunSettings, runConfigurationUpdateAll } from './runConfiguration';
import { InputStep, MultiStepInput } from './utils';
import { PropertiesView } from './propertiesView/propertiesView';
import { l10n } from './localiser';
import { extConstants } from './constants';
import { ExtensionInfo } from './extensionInfo';
import { ClientPromise } from './lsp/clientPromise';
import { ExtensionLogger, LogLevel } from './logger';
import { NbProcessManager } from './lsp/nbProcessManager';
import { initializeServer } from './lsp/initializer';
import { NbLanguageClient } from './lsp/nbLanguageClient';
import { configChangeListener } from './configurations/listener';
import { isNbJavacDisabledHandler } from './configurations/handlers';
import { subscribeCommands } from './commands/register';
import { VSNetBeansAPI } from './lsp/types';

export let LOGGER: ExtensionLogger;
export namespace globalVars {
    export const listeners = new Map<string, string[]>();    
    export let extensionInfo: ExtensionInfo;
    export let clientPromise: ClientPromise;
    export let debugPort: number = -1;
    export let debugHash: string | undefined;
    export let deactivated: boolean = true;
    export let nbProcessManager: NbProcessManager | null;
    export let testAdapter: NbTestAdapter | undefined;
}

export function findClusters(myPath : string): string[] {
    let clusters = [];
    for (let e of vscode.extensions.all) {
        if (e.extensionPath === myPath) {
            continue;
        }
        const dir = path.join(e.extensionPath, 'nbcode');
        if (!fs.existsSync(dir)) {
            continue;
        }
        const exists = fs.readdirSync(dir);
        for (let clusterName of exists) {
            let clusterPath = path.join(dir, clusterName);
            let clusterModules = path.join(clusterPath, 'config', 'Modules');
            if (!fs.existsSync(clusterModules)) {
                continue;
            }
            let perm = fs.statSync(clusterModules);
            if (perm.isDirectory()) {
                clusters.push(clusterPath);
            }
        }
    }
    return clusters;
}

function contextUri(ctx : any) : vscode.Uri | undefined {
    if (ctx?.fsPath) {
        return ctx as vscode.Uri;
    } else if (ctx?.resourceUri) {
        return ctx.resourceUri as vscode.Uri;
    } else if (typeof ctx == 'string') {
        try {
            return vscode.Uri.parse(ctx, true);
        } catch (err) {
            return vscode.Uri.file(ctx);
        }
    }
    return vscode.window.activeTextEditor?.document?.uri;
}

export function activate(context: ExtensionContext): VSNetBeansAPI {
    globalVars.deactivated = false;
    globalVars.clientPromise = new ClientPromise();
    globalVars.extensionInfo = new ExtensionInfo(context);
    LOGGER = new ExtensionLogger(extConstants.SERVER_NAME);

    globalVars.clientPromise.clientPromiseInitialization();

    context.subscriptions.push(workspace.onDidChangeConfiguration(configChangeListener));
    doActivateWithJDK();
    // find acceptable JDK and launch the Java part
    // findJDK((specifiedJDK) => {
    //     let currentClusters = findClusters(context.extensionPath).sort();
    //     const dsSorter = (a: TextDocumentFilter, b: TextDocumentFilter) => {
    //         return (a.language || '').localeCompare(b.language || '')
    //             || (a.pattern || '').localeCompare(b.pattern || '')
    //             || (a.scheme || '').localeCompare(b.scheme || '');
    //     };
    //     let currentDocumentSelectors = collectDocumentSelectors().sort(dsSorter);
    //     context.subscriptions.push(vscode.extensions.onDidChange(() => {
    //         const newClusters = findClusters(context.extensionPath).sort();
    //         const newDocumentSelectors = collectDocumentSelectors().sort(dsSorter);
    //         if (newClusters.length !== currentClusters.length || newDocumentSelectors.length !== currentDocumentSelectors.length
    //             || newClusters.find((value, index) => value !== currentClusters[index]) || newDocumentSelectors.find((value, index) => value !== currentDocumentSelectors[index])) {
    //             currentClusters = newClusters;
    //             currentDocumentSelectors = newDocumentSelectors;
    //             activateWithJDK(specifiedJDK, context, log, true, clientResolve, clientReject);
    //         }
    //     }));
    //     activateWithJDK(specifiedJDK, context, log, true, clientResolve, clientReject);
    // });
    

    //register debugger:
    let debugTrackerFactory =new NetBeansDebugAdapterTrackerFactory();
    context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory(extConstants.COMMAND_PREFIX, debugTrackerFactory));
    let configInitialProvider = new NetBeansConfigurationInitialProvider();
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(extConstants.COMMAND_PREFIX, configInitialProvider, vscode.DebugConfigurationProviderTriggerKind.Initial));
    let configDynamicProvider = new NetBeansConfigurationDynamicProvider(context);
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(extConstants.COMMAND_PREFIX, configDynamicProvider, vscode.DebugConfigurationProviderTriggerKind.Dynamic));
    let configResolver = new NetBeansConfigurationResolver();
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(extConstants.COMMAND_PREFIX, configResolver));
    context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(((session) => onDidTerminateSession(session))));

    let debugDescriptionFactory = new NetBeansDebugAdapterDescriptionFactory();
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory(extConstants.COMMAND_PREFIX, debugDescriptionFactory));

    // initialize Run Configuration
    initializeRunConfiguration().then(initialized => {
		if (initialized) {
			context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(extConstants.COMMAND_PREFIX, runConfigurationProvider));
			context.subscriptions.push(vscode.window.registerTreeDataProvider('run-config', runConfigurationNodeProvider));
			context.subscriptions.push(vscode.commands.registerCommand(extConstants.COMMAND_PREFIX + '.workspace.configureRunSettings', (...params: any[]) => {
				configureRunSettings(context, params);
			}));
			vscode.commands.executeCommand('setContext', 'runConfigurationInitialized', true);
		}
	});

    // register commands
    subscribeCommands(context);

    async function findRunConfiguration(uri : vscode.Uri) : Promise<vscode.DebugConfiguration|undefined> {
        // do not invoke debug start with no (jdk) configurations, as it would probably create an user prompt
        let cfg = vscode.workspace.getConfiguration("launch");
        let c = cfg.get('configurations');
        if (!Array.isArray(c)) {
            return undefined;
        }
        let f = c.filter((v) => v['type'] === extConstants.COMMAND_PREFIX);
        if (!f.length) {
            return undefined;
        }
        class P implements vscode.DebugConfigurationProvider {
            config : vscode.DebugConfiguration | undefined;

            resolveDebugConfigurationWithSubstitutedVariables(folder: vscode.WorkspaceFolder | undefined, debugConfiguration: vscode.DebugConfiguration, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {
                this.config = debugConfiguration;
                return undefined;
            }
        }
        let provider = new P();
        let d = vscode.debug.registerDebugConfigurationProvider(extConstants.COMMAND_PREFIX, provider);
        // let vscode to select a debug config
        return await vscode.commands.executeCommand('workbench.action.debug.start', { config: {
            type: extConstants.COMMAND_PREFIX,
            mainClass: uri.toString()
        }, noDebug: true}).then((v) => {
            d.dispose();
            return provider.config;
        }, (err) => {
            d.dispose();
            return undefined;
        });
    }

    const runDebug = async (noDebug: boolean, testRun: boolean, uri: any, methodName?: string, launchConfiguration?: string, project : boolean = false, ) => {
        const docUri = contextUri(uri);
        if (docUri) {
            // attempt to find the active configuration in the vsode launch settings; undefined if no config is there.
            let debugConfig : vscode.DebugConfiguration = await findRunConfiguration(docUri) || {
                type: extConstants.COMMAND_PREFIX,
                name: "Java Single Debug",
                request: "launch"
            };
            if (methodName) {
                debugConfig['methodName'] = methodName;
            }
            if (launchConfiguration == '') {
                if (debugConfig['launchConfiguration']) {
                    delete debugConfig['launchConfiguration'];
                }
            } else {
                debugConfig['launchConfiguration'] = launchConfiguration;
            }
            debugConfig['testRun'] = testRun;
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(docUri);
            if (project) {
                debugConfig['projectFile'] = docUri.toString();
                debugConfig['project'] = true;
            } else {
                debugConfig['mainClass'] =  docUri.toString();
            }
            const debugOptions : vscode.DebugSessionOptions = {
                noDebug: noDebug,
            }


            const ret = await vscode.debug.startDebugging(workspaceFolder, debugConfig, debugOptions);
            return ret ? new Promise((resolve) => {
                const listener = vscode.debug.onDidTerminateDebugSession(() => {
                    listener.dispose();
                    resolve(true);
                });
            }) : ret;
        }
    };

    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.run.test', async (uri, methodName?, launchConfiguration?) => {
        await runDebug(true, true, uri, methodName, launchConfiguration);
    }));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.debug.test', async (uri, methodName?, launchConfiguration?) => {
        await runDebug(false, true, uri, methodName, launchConfiguration);
    }));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.run.single', async (uri, methodName?, launchConfiguration?) => {
        await runDebug(true, false, uri, methodName, launchConfiguration);
    }));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.debug.single', async (uri, methodName?, launchConfiguration?) => {
        await runDebug(false, false, uri, methodName, launchConfiguration);
    }));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.project.run', async (node, launchConfiguration?) => {
        return runDebug(true, false, contextUri(node)?.toString() || '',  undefined, launchConfiguration, true);
    }));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.project.debug', async (node, launchConfiguration?) => {
        return runDebug(false, false, contextUri(node)?.toString() || '',  undefined, launchConfiguration, true);
    }));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.project.test', async (node, launchConfiguration?) => {
        return runDebug(true, true, contextUri(node)?.toString() || '',  undefined, launchConfiguration, true);
    }));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.package.test', async (uri, launchConfiguration?) => {
        await runDebug(true, true, uri, undefined, launchConfiguration);
    }));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.node.properties.edit',
        async (node) => await PropertiesView.createOrShow(context, node, (await globalVars.clientPromise.client).findTreeViewService())));

    const archiveFileProvider = <vscode.TextDocumentContentProvider> {
        provideTextDocumentContent: async (uri: vscode.Uri, token: vscode.CancellationToken): Promise<string> => {
            return await commands.executeCommand(extConstants.COMMAND_PREFIX + '.get.archive.file.content', uri.toString());
        }
    };
    context.subscriptions.push(workspace.registerTextDocumentContentProvider('jar', archiveFileProvider));
    context.subscriptions.push(workspace.registerTextDocumentContentProvider('nbjrt', archiveFileProvider));

    launchConfigurations.updateLaunchConfig();

    // register completions:
    launchConfigurations.registerCompletion(context);
    return Object.freeze({
        version : extConstants.API_VERSION,
        apiVersion : extConstants.API_VERSION
    });
}

function doActivateWithJDK(): void {
        const connection: () => Promise<StreamInfo> = initializeServer();
        const c = NbLanguageClient.build(connection, LOGGER);
        
        LOGGER.log('Language Client: Starting');
        c.start().then(() => {
            globalVars.testAdapter = new NbTestAdapter();
            c.onNotification(StatusMessageRequest.type, showStatusBarMessage);
            c.onRequest(HtmlPageRequest.type, showHtmlPage);
            c.onRequest(ExecInHtmlPageRequest.type, execInHtmlPage);
            c.onNotification(LogMessageNotification.type, (param) => LOGGER.log(param.message));
            c.onRequest(QuickPickRequest.type, async param => {
                const selected = await window.showQuickPick(param.items, { title: param.title, placeHolder: param.placeHolder, canPickMany: param.canPickMany, ignoreFocusOut: true });
                return selected ? Array.isArray(selected) ? selected : [selected] : undefined;
            });
            c.onRequest(UpdateConfigurationRequest.type, async (param) => {
                LOGGER.log("Received config update: " + param.section + "." + param.key + "=" + param.value);
                let wsFile: vscode.Uri | undefined = vscode.workspace.workspaceFile;
                let wsConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(param.section);
                if (wsConfig) {
                    try {
                        wsConfig.update(param.key, param.value, wsFile ? null : true)
                            .then(() => {
                                LOGGER.log("Updated configuration: " + param.section + "." + param.key + "=" + param.value + "; in: " + (wsFile ? wsFile.toString() : "Global"));
                            })
                            .then(() => {
                                runConfigurationUpdateAll();
                            });
                    } catch (err) {
                        LOGGER.log("Failed to update configuration. Reason: " + (typeof err === "string" ? err : err instanceof Error ? err.message : "error"), LogLevel.ERROR);
                    }
                }
            });
            c.onRequest(SaveDocumentsRequest.type, async (request : SaveDocumentRequestParams) => {
                const uriList = request.documents.map(s => {
                    let re = /^file:\/(?:\/\/)?([A-Za-z]):\/(.*)$/.exec(s);
                    if (!re) {
                        return s;
                    }
                    // don't ask why vscode mangles URIs this way; in addition, it uses lowercase drive letter ???
                    return `file:///${re[1].toLowerCase()}%3A/${re[2]}`;
                });
                for (let ed of workspace.textDocuments) {
                    if (uriList.includes(ed.uri.toString())) {
                        return ed.save();
                    }
                }
                return false;
            });
            c.onRequest(InputBoxRequest.type, async param => {
                return await window.showInputBox({ title: param.title, prompt: param.prompt, value: param.value, password: param.password });
            });
            c.onRequest(MutliStepInputRequest.type, async param => {
                const data: { [name: string]: readonly vscode.QuickPickItem[] | string } = {};
                async function nextStep(input: MultiStepInput, step: number, state: { [name: string]: readonly vscode.QuickPickItem[] | string }): Promise<InputStep | void> {
                    const inputStep = await c.sendRequest(MutliStepInputRequest.step, { inputId: param.id, step, data: state });
                    if (inputStep && inputStep.hasOwnProperty('items')) {
                        const quickPickStep = inputStep as QuickPickStep;
                        state[inputStep.stepId] = await input.showQuickPick({
                            title: param.title,
                            step,
                            totalSteps: quickPickStep.totalSteps,
                            placeholder: quickPickStep.placeHolder,
                            items: quickPickStep.items,
                            canSelectMany: quickPickStep.canPickMany,
                            selectedItems: quickPickStep.items.filter(item => item.picked)
                        });
                        return (input: MultiStepInput) => nextStep(input, step + 1, state);
                    } else if (inputStep && inputStep.hasOwnProperty('value')) {
                        const inputBoxStep = inputStep as InputBoxStep;
                        state[inputStep.stepId] = await input.showInputBox({
                            title: param.title,
                            step,
                            totalSteps: inputBoxStep.totalSteps,
                            value: state[inputStep.stepId] as string || inputBoxStep.value,
                            prompt: inputBoxStep.prompt,
                            password: inputBoxStep.password,
                            validate: (val) => {
                                const d = { ...state };
                                d[inputStep.stepId] = val;
                                return c.sendRequest(MutliStepInputRequest.validate, { inputId: param.id, step, data: d });
                            }
                        });
                        return (input: MultiStepInput) => nextStep(input, step + 1, state);
                    }
                }
                await MultiStepInput.run(input => nextStep(input, 1, data));
                return data;
            });
            c.onNotification(TestProgressNotification.type, param => {
                if (globalVars.testAdapter) {
                    globalVars.testAdapter.testProgress(param.suite);
                }
            });
            let decorations = new Map<string, TextEditorDecorationType>();
            let decorationParamsByUri = new Map<vscode.Uri, SetTextEditorDecorationParams>();
            c.onRequest(TextEditorDecorationCreateRequest.type, param => {
                let decorationType = vscode.window.createTextEditorDecorationType(param);
                decorations.set(decorationType.key, decorationType);
                return decorationType.key;
            });
            c.onNotification(TextEditorDecorationSetNotification.type, param => {
                let decorationType = decorations.get(param.key);
                if (decorationType) {
                    let editorsWithUri = vscode.window.visibleTextEditors.filter(
                        editor => editor.document.uri.toString() == param.uri
                    );
                    if (editorsWithUri.length > 0) {
                        editorsWithUri[0].setDecorations(decorationType, asRanges(param.ranges));
                        decorationParamsByUri.set(editorsWithUri[0].document.uri, param);
                    }
                }
            });
            let disposableListener = vscode.window.onDidChangeVisibleTextEditors(editors => {
                editors.forEach(editor => {
                    let decorationParams = decorationParamsByUri.get(editor.document.uri);
                    if (decorationParams) {
                        let decorationType = decorations.get(decorationParams.key);
                        if (decorationType) {
                            editor.setDecorations(decorationType, asRanges(decorationParams.ranges));
                        }
                    }
                });
            });
            globalVars.extensionInfo.pushSubscription(disposableListener);
            c.onNotification(TextEditorDecorationDisposeNotification.type, param => {
                let decorationType = decorations.get(param);
                if (decorationType) {
                    decorations.delete(param);
                    decorationType.dispose();
                    decorationParamsByUri.forEach((value, key, map) => {
                        if (value.key == param) {
                            map.delete(key);
                        }
                    });
                }
            });
            c.onNotification(TelemetryEventNotification.type, (param) => {
                const ls = globalVars.listeners.get(param);
                if (ls) {
                    for (const listener of ls) {
                        commands.executeCommand(listener);
                    }
                }
            });
            LOGGER.log('Language Client: Ready');
            globalVars.clientPromise.setClient[0](c);
            commands.executeCommand('setContext', 'nbJdkReady', true);
        
            // create project explorer:
            //c.findTreeViewService().createView('foundProjects', 'Projects', { canSelectMany : false });
            createProjectView(c);
        }).catch(globalVars.clientPromise.setClient[1]);
}
    async function createProjectView(client : NbLanguageClient) {
        const ts : TreeViewService = client.findTreeViewService();
        let tv : vscode.TreeView<Visualizer> = await ts.createView('foundProjects', 'Projects', { canSelectMany : false });

        async function revealActiveEditor(ed? : vscode.TextEditor) {
            const uri = window.activeTextEditor?.document?.uri;
            if (!uri || uri.scheme.toLowerCase() !== 'file') {
                return;
            }
            if (!tv.visible) {
                return;
            }
            let vis : Visualizer | undefined = await ts.findPath(tv, uri.toString());
            if (!vis) {
                return;
            }
            tv.reveal(vis, { select : true, focus : false, expand : false });
        }
        const netbeansConfig = workspace.getConfiguration(extConstants.COMMAND_PREFIX);
        globalVars.extensionInfo.pushSubscription(window.onDidChangeActiveTextEditor(ed => {
            if (netbeansConfig.get("revealActiveInProjects")) {
                revealActiveEditor(ed);
            }
        }));
        globalVars.extensionInfo.pushSubscription(vscode.commands.registerCommand(extConstants.COMMAND_PREFIX + ".select.editor.projects", () => revealActiveEditor()));

        // attempt to reveal NOW:
        if (netbeansConfig.get("revealActiveInProjects")) {
            revealActiveEditor();
        }
    }

    const webviews = new Map<string, vscode.Webview>();

    async function showHtmlPage(params : HtmlPageParams): Promise<void> {
        return new Promise(resolve => {
            let data = params.text;
            const match = /<title>(.*)<\/title>/i.exec(data);
            const name = match && match.length > 1 ? match[1] : '';
            const resourceDir = vscode.Uri.joinPath(globalVars.extensionInfo.getGlobalStorage(), params.id);
            workspace.fs.createDirectory(resourceDir);
            let view = vscode.window.createWebviewPanel('htmlView', name, vscode.ViewColumn.Beside, {
                enableScripts: true,
                localResourceRoots: [resourceDir, vscode.Uri.joinPath(globalVars.extensionInfo.getExtensionStorageUri(), 'node_modules', '@vscode/codicons', 'dist')]
            });
            webviews.set(params.id, view.webview);
            const resources = params.resources;
            if (resources) {
                for (const resourceName in resources) {
                    const resourceText = resources[resourceName];
                    const resourceUri = vscode.Uri.joinPath(resourceDir, resourceName);
                    workspace.fs.writeFile(resourceUri, Buffer.from(resourceText, 'utf8'));
                    data = data.replace('href="' + resourceName + '"', 'href="' + view.webview.asWebviewUri(resourceUri) + '"');
                }
            }
            const codiconsUri = view.webview.asWebviewUri(vscode.Uri.joinPath(globalVars.extensionInfo.getExtensionStorageUri(), 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
            view.webview.html = data.replace('href="codicon.css"', 'href="' + codiconsUri + '"');
            view.webview.onDidReceiveMessage(message => {
                switch (message.command) {
                    case 'dispose':
                        webviews.delete(params.id);
                        view.dispose();
                        break;
                    case 'command':
                        vscode.commands.executeCommand(extConstants.COMMAND_PREFIX + '.htmlui.process.command', message.data);
                        break;
                }
            });
            view.onDidDispose(() => {
                resolve();
                workspace.fs.delete(resourceDir, {recursive: true});
            });
        });
    }

    async function execInHtmlPage(params : HtmlPageParams): Promise<boolean> {
        return new Promise(resolve => {
            const webview = webviews.get(params.id);
            if (webview) {
                webview.postMessage({
                    execScript: params.text,
                    pause: params.pause
                }).then(ret => {
                    resolve(ret);
                });
            }
            resolve(false);
        });
    }

    function showStatusBarMessage(params : ShowStatusMessageParams) {
        let decorated : string = params.message;
        let defTimeout;

        switch (params.type) {
            case MessageType.Error:
                decorated = '$(error) ' + params.message;
                defTimeout = 0;
                checkInstallNbJavac(params.message);
                break;
            case MessageType.Warning:
                decorated = '$(warning) ' + params.message;
                defTimeout = 0;
                break;
            default:
                defTimeout = 10000;
                break;
        }
        // params.timeout may be defined but 0 -> should be used
        const timeout = params.timeout != undefined ? params.timeout : defTimeout;
        if (timeout > 0) {
            window.setStatusBarMessage(decorated, timeout);
        } else {
            window.setStatusBarMessage(decorated);
        }
    }

function checkInstallNbJavac(msg: string) {
    const NO_JAVA_SUPPORT = "Cannot initialize Java support";
    if (msg.startsWith(NO_JAVA_SUPPORT)) {
        if (isNbJavacDisabledHandler()) {
            const message = l10n.value("jdk.extension.nbjavac.message.supportedVersionRequired");
            const enable = l10n.value("jdk.extension.nbjavac.label.enableNbjavac");
            const settings = l10n.value("jdk.extension.nbjavac.label.openSettings");
            window.showErrorMessage(message, enable, settings).then(reply => {
                if (enable === reply) {
                    workspace.getConfiguration().update(extConstants.COMMAND_PREFIX + '.advanced.disable.nbjavac', false);
                } else if (settings === reply) {
                    vscode.commands.executeCommand('workbench.action.openSettings', extConstants.COMMAND_PREFIX + '.jdkhome');
                }
            });
        }
    }
}


export function deactivate(): Thenable<void> {
    if (globalVars.nbProcessManager?.getProcess() != null) {
        globalVars.nbProcessManager?.getProcess()?.kill();
    }
    return globalVars.clientPromise.stopClient();
}


class NetBeansDebugAdapterTrackerFactory implements vscode.DebugAdapterTrackerFactory {

    createDebugAdapterTracker(_session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterTracker> {
        return {
            onDidSendMessage(message: any): void {
                if (globalVars.testAdapter && message.type === 'event' && message.event === 'output') {
                    globalVars.testAdapter.testOutput(message.body.output);
                }
            }
        }
    }
}

class NetBeansDebugAdapterDescriptionFactory implements vscode.DebugAdapterDescriptorFactory {

    createDebugAdapterDescriptor(_session: vscode.DebugSession, _executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        return new Promise<vscode.DebugAdapterDescriptor>((resolve, reject) => {
            let cnt = 10;
            const fnc = () => {
                if (globalVars.debugPort < 0) {
                    if (cnt-- > 0) {
                        setTimeout(fnc, 1000);
                    } else {
                        reject(new Error(l10n.value('jdk.extension.debugger.error_msg.debugAdapterNotInitialized')));
                    }
                } else {
                    // resolve(new vscode.DebugAdapterServer(debugPort));
                   const socket = net.connect(globalVars.debugPort, "127.0.0.1", () => {});
                   socket.on("connect", () => {
                       const adapter = new StreamDebugAdapter();
                       socket.write(globalVars.debugHash ? globalVars.debugHash : "");
                       adapter.connect(socket, socket);
                       resolve(new vscode.DebugAdapterInlineImplementation(adapter));
                   });
                }
            }
            fnc();
        });
    }
}


class NetBeansConfigurationInitialProvider implements vscode.DebugConfigurationProvider {

    provideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration[]> {
       return this.doProvideDebugConfigurations(folder, token);
    }

    async doProvideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined, _token?:  vscode.CancellationToken):  Promise<vscode.DebugConfiguration[]> {
        let c : LanguageClient = await globalVars.clientPromise.client;
        if (!folder) {
            return [];
        }
        var u : vscode.Uri | undefined;
        if (folder && folder.uri) {
            u = folder.uri;
        } else {
            u = vscode.window.activeTextEditor?.document?.uri
        }
        let result : vscode.DebugConfiguration[] = [];
        const configNames : string[] | null | undefined = await vscode.commands.executeCommand(extConstants.COMMAND_PREFIX + '.project.configurations', u?.toString());
        if (configNames) {
            let first : boolean = true;
            for (let cn of configNames) {
                let cname : string;

                if (first) {
                    // ignore the default config, comes first.
                    first = false;
                    continue;
                } else {
                    cname = "Launch Java: " + cn;
                }
                const debugConfig : vscode.DebugConfiguration = {
                    name: cname,
                    type: extConstants.COMMAND_PREFIX,
                    request: "launch",
                    launchConfiguration: cn,
                };
                result.push(debugConfig);
            }
        }
        return result;
    }
}

class NetBeansConfigurationDynamicProvider implements vscode.DebugConfigurationProvider {

    context: ExtensionContext;
    commandValues = new Map<string, string>();

    constructor(context: ExtensionContext) {
        this.context = context;
    }

    provideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration[]> {
       return this.doProvideDebugConfigurations(folder, this.context, this.commandValues, token);
    }

    async doProvideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined, context: ExtensionContext, commandValues: Map<string, string>, _token?:  vscode.CancellationToken):  Promise<vscode.DebugConfiguration[]> {
        let c : LanguageClient = await globalVars.clientPromise.client;
        if (!folder) {
            return [];
        }
        let result : vscode.DebugConfiguration[] = [];
        const attachConnectors : DebugConnector[] | null | undefined = await vscode.commands.executeCommand(extConstants.COMMAND_PREFIX + '.java.attachDebugger.configurations');
        if (attachConnectors) {
            for (let ac of attachConnectors) {
                const debugConfig : vscode.DebugConfiguration = {
                    name: ac.name,
                    type: ac.type,
                    request: "attach",
                };
                for (let i = 0; i < ac.arguments.length; i++) {
                    let defaultValue: string = ac.defaultValues[i];
                    if (!defaultValue.startsWith("${command:")) {
                        // Create a command that asks for the argument value:
                        let cmd: string = extConstants.COMMAND_PREFIX + ".java.attachDebugger.connector." + ac.id + "." + ac.arguments[i];
                        debugConfig[ac.arguments[i]] = "${command:" + cmd + "}";
                        if (!commandValues.has(cmd)) {
                            commandValues.set(cmd, ac.defaultValues[i]);
                            let description: string = ac.descriptions[i];
                            context.subscriptions.push(commands.registerCommand(cmd, async (ctx) => {
                                return vscode.window.showInputBox({
                                    prompt: description,
                                    value: commandValues.get(cmd),
                                }).then((value) => {
                                    if (value) {
                                        commandValues.set(cmd, value);
                                    }
                                    return value;
                                });
                            }));
                        }
                    } else {
                        debugConfig[ac.arguments[i]] = defaultValue;
                    }
                }
                result.push(debugConfig);
            }
        }
        return result;
    }
}

class NetBeansConfigurationResolver implements vscode.DebugConfigurationProvider {

    resolveDebugConfiguration(_folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, _token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {
        if (!config.type) {
            config.type = extConstants.COMMAND_PREFIX;
        }
        if (!config.request) {
            config.request = 'launch';
        }
        if (vscode.window.activeTextEditor) {
            config.file = '${file}';
        }
        if (!config.classPaths) {
            config.classPaths = ['any'];
        }
        if (!config.console) {
            config.console = 'internalConsole';
        }

        return config;
    }
}

function onDidTerminateSession(session: vscode.DebugSession): any {
    const config = session.configuration;
    if (config.env) {
        const file = config.env["MICRONAUT_CONFIG_FILES"];
        if (file) {
            vscode.workspace.fs.delete(vscode.Uri.file(file));
        }
    }
}

