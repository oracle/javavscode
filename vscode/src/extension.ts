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

import { commands, window, workspace, ExtensionContext, ProgressLocation, TextEditorDecorationType } from 'vscode';

import {
	LanguageClient,
	StreamInfo
} from 'vscode-languageclient/node';

import {
    MessageType,
    LogMessageNotification,
    SymbolInformation,
    TelemetryEventNotification
} from 'vscode-languageclient';

import * as net from 'net';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as ls from 'vscode-languageserver-protocol';
import { StreamDebugAdapter} from './streamDebugAdapter';
import { NbTestAdapter } from './testAdapter';
import { asRanges, StatusMessageRequest, ShowStatusMessageParams, QuickPickRequest, InputBoxRequest, MutliStepInputRequest, TestProgressNotification, DebugConnector,
         TextEditorDecorationCreateRequest, TextEditorDecorationSetNotification, TextEditorDecorationDisposeNotification, HtmlPageRequest, HtmlPageParams,
         ExecInHtmlPageRequest, SetTextEditorDecorationParams, ProjectActionParams, UpdateConfigurationRequest, QuickPickStep, InputBoxStep, SaveDocumentsRequest, SaveDocumentRequestParams
} from './protocol';
import * as launchConfigurations from './launchConfigurations';
import { TreeViewService, Visualizer } from './explorer';
import { initializeRunConfiguration, runConfigurationProvider, runConfigurationNodeProvider, configureRunSettings, runConfigurationUpdateAll } from './runConfiguration';
import { InputStep, MultiStepInput } from './utils';
import { PropertiesView } from './propertiesView/propertiesView';
import { l10n } from './localiser';
import { extConstants } from './constants';
import { JdkDownloaderView } from './jdkDownloader/view';
import { ExtensionInfo } from './extensionInfo';
import { ClientPromise } from './lsp/clientPromise';
import { ExtensionLogger, LogLevel } from './logger';
import { NbProcessManager } from './lsp/nbProcessManager';
import { initializeServer } from './lsp/initializer';
import { NbLanguageClient } from './lsp/nbLanguageClient';
import { configChangeListener } from './configurations/listener';
import { isNbJavacDisabledHandler } from './configurations/handlers';

const listeners = new Map<string, string[]>();
export let LOGGER: ExtensionLogger;
export namespace globalVars {
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

// for tests only !
export function awaitClient() : Promise<NbLanguageClient> {
    const clientPromise = globalVars.clientPromise;
    if (clientPromise.client && clientPromise.initialPromiseResolved) {
        return clientPromise.client;
    }
    let nbcode = vscode.extensions.getExtension(extConstants.ORACLE_VSCODE_EXTENSION_ID);
    if (!nbcode) {
        return Promise.reject(new Error(l10n.value("jdk.extension.notInstalled.label")));
    }
    const t : Thenable<NbLanguageClient> = nbcode.activate().then(nc => {
        if (globalVars.clientPromise.client === undefined || !globalVars.clientPromise.initialPromiseResolved) {
            throw new Error(l10n.value("jdk.extenstion.error_msg.clientNotAvailable"));
        } else {
            return globalVars.clientPromise.client;
        }
    });
    return Promise.resolve(t);
}

interface VSNetBeansAPI {
    version : string;
    apiVersion: string;
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

/**
 * Executes a project action. It is possible to provide an explicit configuration to use (or undefined), display output from the action etc.
 * Arguments are attempted to parse as file or editor references or Nodes; otherwise they are attempted to be passed to the action as objects.
 *
 * @param action ID of the project action to run
 * @param configuration configuration to use or undefined - use default/active one.
 * @param title Title for the progress displayed in vscode
 * @param log output channel that should be revealed
 * @param showOutput if true, reveals the passed output channel
 * @param args additional arguments
 * @returns Promise for the command's result
 */
function wrapProjectActionWithProgress(action : string, configuration : string | undefined, title : string, log? : vscode.OutputChannel, showOutput? : boolean, ...args : any[]) : Thenable<unknown> {
    let items = [];
    let actionParams = {
        action : action,
        configuration : configuration,
    } as ProjectActionParams;
    for (let item of args) {
        let u : vscode.Uri | undefined;
        if (item?.fsPath) {
            items.push((item.fsPath as vscode.Uri).toString());
        } else if (item?.resourceUri) {
            items.push((item.resourceUri as vscode.Uri).toString());
        } else {
            items.push(item);
        }
    }
    return wrapCommandWithProgress(extConstants.COMMAND_PREFIX + '.project.run.action', title, log, showOutput, actionParams, ...items);
}

function wrapCommandWithProgress(lsCommand : string, title : string, log? : vscode.OutputChannel, showOutput? : boolean, ...args : any[]) : Thenable<unknown> {
    return window.withProgress({ location: ProgressLocation.Window }, p => {
        return new Promise(async (resolve, reject) => {
            let c : LanguageClient = await globalVars.clientPromise.client;
            const commands = await vscode.commands.getCommands();
            if (commands.includes(lsCommand)) {
                p.report({ message: title });
                c.outputChannel.show(true);
                const start = new Date().getTime();
                try {
                    if (log) {
                        LOGGER.log(`starting ${lsCommand}`);
                    }
                    const res = await vscode.commands.executeCommand(lsCommand, ...args)
                    const elapsed = new Date().getTime() - start;
                    if (log) {
                        LOGGER.log(`finished ${lsCommand} in ${elapsed} ms with result ${res}`);
                    }
                    const humanVisibleDelay = elapsed < 1000 ? 1000 : 0;
                    setTimeout(() => { // set a timeout so user would still see the message when build time is short
                        if (res) {
                            resolve(res);
                        } else {
                            if (log) {
                                LOGGER.log(`Command ${lsCommand} takes too long to start`, LogLevel.ERROR);
                            }
                            reject(res);
                        }
                    }, humanVisibleDelay);
                } catch (err: any) {
                    if (log) {
                        LOGGER.log(`command ${lsCommand} executed with error: ${JSON.stringify(err)}`, LogLevel.ERROR);
                    }
                }
            } else {
                reject(l10n.value("jdk.extension.progressBar.error_msg.cannotRun",{lsCommand:lsCommand,client:c}));
            }
        });
    });
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
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.workspace.new', async (ctx, template) => {
        let c : LanguageClient = await globalVars.clientPromise.client;
        const commands = await vscode.commands.getCommands();
        if (commands.includes(extConstants.COMMAND_PREFIX + '.new.from.template')) {
            const workspaces=workspace.workspaceFolders;

            if(!workspaces) {
                const userHomeDir = os.homedir();
                const folderPath = await vscode.window.showInputBox({
                    prompt: l10n.value('jdk.workspace.new.prompt'),
                    value: `${userHomeDir}`
                });
                if(!folderPath?.trim()) return;

                if(!fs.existsSync(folderPath)) {
                    await fs.promises.mkdir(folderPath);
                }
                const folderPathUri = vscode.Uri.file(folderPath);
                await vscode.commands.executeCommand(extConstants.COMMAND_PREFIX + '.new.from.template', folderPathUri.toString());
                await vscode.commands.executeCommand(`vscode.openFolder`, folderPathUri);

                return;
            }

            // first give the template (if present), then the context, and then the open-file hint in the case the context is not specific enough
            const params = [];
            if (typeof template === 'string') {
                params.push(template);
            }
            params.push(contextUri(ctx)?.toString(), vscode.window.activeTextEditor?.document?.uri?.toString());
            const res = await vscode.commands.executeCommand(extConstants.COMMAND_PREFIX + '.new.from.template', ...params);
            
            if (typeof res === 'string') {
                let newFile = vscode.Uri.parse(res as string);
                await vscode.window.showTextDocument(newFile, { preview: false });
            } else if (Array.isArray(res)) {
                for(let r of res) {
                    if (typeof r === 'string') {
                        let newFile = vscode.Uri.parse(r as string);
                        await vscode.window.showTextDocument(newFile, { preview: false });
                    }
                }
            }
        } else {
            throw l10n.value("jdk.extension.error_msg.doesntSupportNewTeamplate",{client:c});
        }
    }));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.workspace.newproject', async (ctx) => {
        let c : LanguageClient = await globalVars.clientPromise.client;
        const commands = await vscode.commands.getCommands();
        if (commands.includes(extConstants.COMMAND_PREFIX + '.new.project')) {
            const res = await vscode.commands.executeCommand(extConstants.COMMAND_PREFIX + '.new.project', contextUri(ctx)?.toString());
            if (typeof res === 'string') {
                let newProject = vscode.Uri.parse(res as string);

                const OPEN_IN_NEW_WINDOW = l10n.value("jdk.extension.label.openInNewWindow");
                const ADD_TO_CURRENT_WORKSPACE = l10n.value("jdk.extension.label.addToWorkSpace");

                const value = await vscode.window.showInformationMessage(l10n.value("jdk.extension.message.newProjectCreated"), OPEN_IN_NEW_WINDOW, ADD_TO_CURRENT_WORKSPACE);
                if (value === OPEN_IN_NEW_WINDOW) {
                    await vscode.commands.executeCommand('vscode.openFolder', newProject, true);
                } else if (value === ADD_TO_CURRENT_WORKSPACE) {
                    vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, undefined, { uri: newProject });
                }
            }
        } else {
            throw l10n.value("jdk.extenstion.error_msg.doesntSupportNewProject",{client: globalVars.clientPromise.client,c});
        }
    }));

    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.open.test', async (ctx) => {
        let c: LanguageClient = await globalVars.clientPromise.client;
        const commands = await vscode.commands.getCommands();
        if (commands.includes(extConstants.COMMAND_PREFIX + '.go.to.test')) {
            try {
                const res: any = await vscode.commands.executeCommand(extConstants.COMMAND_PREFIX + '.go.to.test', contextUri(ctx)?.toString());
                if("errorMessage" in res){
                    throw new Error(res.errorMessage);
                }
                res?.providerErrors?.map((error: any) => {
                    if(error?.message){
                        vscode.window.showErrorMessage(error.message);
                    }
                });
                if (res?.locations?.length) {
                    if (res.locations.length === 1) {
                        const { file, offset } = res.locations[0];
                        const filePath = vscode.Uri.parse(file);
                        const editor = await vscode.window.showTextDocument(filePath, { preview: false });
                        if (offset != -1) {
                            const pos: vscode.Position = editor.document.positionAt(offset);
                            editor.selections = [new vscode.Selection(pos, pos)];
                            const range = new vscode.Range(pos, pos);
                            editor.revealRange(range);
                        }

                    } else {
                        const namePathMapping: { [key: string]: string } = {}
                        res.locations.forEach((fp:any) => {
                            const fileName = path.basename(fp.file);
                            namePathMapping[fileName] = fp.file
                        });
                        const selected = await window.showQuickPick(Object.keys(namePathMapping), {
                            title: l10n.value("jdk.extension.fileSelector.label.selectFiles"),
                            placeHolder: l10n.value("jdk.extension.fileSelector.label.testFilesOrSourceFiles"),
                            canPickMany: true
                        });
                        if (selected) {
                            for await (const filePath of selected) {
                                let file = vscode.Uri.parse(filePath);
                                await vscode.window.showTextDocument(file, { preview: false });
                            }
                        } else {
                            vscode.window.showInformationMessage(l10n.value("jdk.extension.fileSelector.label.noFileSelected"));
                        }
                    }
                }
            } catch (err:any) {
                vscode.window.showInformationMessage(err?.message || l10n.value("jdk.extension.fileSelector.label.noTestFound"));
            }
        } else {
            throw l10n.value("jdk.extension.error_msg.doesntSupportGoToTest",{client:c});
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand(extConstants.COMMAND_PREFIX + ".delete.cache", async () => {
        const storagePath = context.storageUri?.fsPath;
        if (!storagePath) {
            vscode.window.showErrorMessage(l10n.value("jdk.extension.cache.error_msg.cannotFindWrkSpacePath"));
            return;
        }

        const userDir = path.join(storagePath, "userdir");
        if (userDir && fs.existsSync(userDir)) {
            const yes =  l10n.value("jdk.extension.cache.label.confirmation.yes")
            const cancel = l10n.value("jdk.extension.cache.label.confirmation.cancel")
            const confirmation = await vscode.window.showInformationMessage('Are you sure you want to delete cache for this workspace  and reload the window ?',
                yes, cancel);
            if (confirmation === yes) {
                const reloadWindowActionLabel = l10n.value("jdk.extension.cache.label.reloadWindow");
                try {
                    await globalVars.clientPromise.stopClient();
                    globalVars.deactivated = true;
                    await globalVars.nbProcessManager?.killProcess(false);
                    await fs.promises.rmdir(userDir, { recursive: true });
                    await vscode.window.showInformationMessage(l10n.value("jdk.extension.message.cacheDeleted"), reloadWindowActionLabel);
                } catch (err) {
                    await vscode.window.showErrorMessage(l10n.value("jdk.extension.error_msg.cacheDeletionError"), reloadWindowActionLabel);
                } finally {
                    vscode.commands.executeCommand("workbench.action.reloadWindow");
                }
            }
        } else {
            vscode.window.showErrorMessage(l10n.value("jdk.extension.cache.message.noUserDir"));
        }
    }));
    

    context.subscriptions.push(vscode.commands.registerCommand(extConstants.COMMAND_PREFIX + ".download.jdk", async () => { 
        const jdkDownloaderView = new JdkDownloaderView();
        jdkDownloaderView.createView();
    }));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.workspace.compile', () =>
        wrapCommandWithProgress(extConstants.COMMAND_PREFIX + '.build.workspace', l10n.value('jdk.extension.command.progress.compilingWorkSpace'), LOGGER.getOutputChannel(), true)
    ));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.workspace.clean', () =>
        wrapCommandWithProgress(extConstants.COMMAND_PREFIX + '.clean.workspace',l10n.value('jdk.extension.command.progress.cleaningWorkSpace'), LOGGER.getOutputChannel(), true)
    ));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.project.compile', (args) => {
        wrapProjectActionWithProgress('build', undefined, l10n.value('jdk.extension.command.progress.compilingProject'), LOGGER.getOutputChannel(), true, args);
    }));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.project.clean', (args) => {
        wrapProjectActionWithProgress('clean', undefined, l10n.value('jdk.extension.command.progress.cleaningProject'), LOGGER.getOutputChannel(), true, args);
    }));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.open.type', () => {
        wrapCommandWithProgress(extConstants.COMMAND_PREFIX + '.quick.open', l10n.value('jdk.extension.command.progress.quickOpen'), LOGGER.getOutputChannel(), true).then(() => {
            commands.executeCommand('workbench.action.focusActiveEditorGroup');
        });
    }));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.java.goto.super.implementation', async () => {
        if (window.activeTextEditor?.document.languageId !== extConstants.LANGUAGE_ID) {
            return;
        }
        const uri = window.activeTextEditor.document.uri;
        const position = window.activeTextEditor.selection.active;
        const locations: any[] = await vscode.commands.executeCommand(extConstants.COMMAND_PREFIX + '.java.super.implementation', uri.toString(), position) || [];
        return vscode.commands.executeCommand('editor.action.goToLocations', window.activeTextEditor.document.uri, position,
            locations.map(location => new vscode.Location(vscode.Uri.parse(location.uri), new vscode.Range(location.range.start.line, location.range.start.character, location.range.end.line, location.range.end.character))),
            'peek', l10n.value('jdk.extension.error_msg.noSuperImpl'));
    }));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.rename.element.at', async (offset) => {
        const editor = window.activeTextEditor;
        if (editor) {
            await commands.executeCommand('editor.action.rename', [
                editor.document.uri,
                editor.document.positionAt(offset),
            ]);
        }
    }));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.surround.with', async (items) => {
        const selected: any = await window.showQuickPick(items, { placeHolder: l10n.value('jdk.extension.command.quickPick.placeholder.surroundWith') });
        if (selected) {
            if (selected.userData.edit) {
                const edit = await (await globalVars.clientPromise.client).protocol2CodeConverter.asWorkspaceEdit(selected.userData.edit as ls.WorkspaceEdit);
                await workspace.applyEdit(edit);
                await commands.executeCommand('workbench.action.focusActiveEditorGroup');
            }
            await commands.executeCommand(selected.userData.command.command, ...(selected.userData.command.arguments || []));
        }
    }));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.generate.code', async (command, data) => {
        const edit: any = await commands.executeCommand(command, data);
        if (edit) {
            const wsEdit = await (await globalVars.clientPromise.client).protocol2CodeConverter.asWorkspaceEdit(edit as ls.WorkspaceEdit);
            await workspace.applyEdit(wsEdit);
            await commands.executeCommand('workbench.action.focusActiveEditorGroup');
        }
    }));

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
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.open.stacktrace', async (uri, methodName, fileName, line) => {
        const location: string | undefined = uri ? await commands.executeCommand(extConstants.COMMAND_PREFIX + '.resolve.stacktrace.location', uri, methodName, fileName) : undefined;
        if (location) {
            const lNum = line - 1;
            window.showTextDocument(vscode.Uri.parse(location), { selection: new vscode.Range(new vscode.Position(lNum, 0), new vscode.Position(lNum, 0)) });
        } else {
            if (methodName) {
                const fqn: string = methodName.substring(0, methodName.lastIndexOf('.'));
                commands.executeCommand('workbench.action.quickOpen', '#' + fqn.substring(fqn.lastIndexOf('.') + 1));
            }
        }
    }));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.workspace.symbols', async (query) => {
        const c = await globalVars.clientPromise.client;
        return (await c.sendRequest<SymbolInformation[]>("workspace/symbol", { "query": query })) ?? [];
    }));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.java.complete.abstract.methods', async () => {
        const active = vscode.window.activeTextEditor;
        if (active) {
            const position = new vscode.Position(active.selection.start.line, active.selection.start.character);
            await commands.executeCommand(extConstants.COMMAND_PREFIX + '.java.implement.all.abstract.methods', active.document.uri.toString(), position);
        }
    }));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.startup.condition', async () => {
        return globalVars.clientPromise.client;
    }));
    context.subscriptions.push(commands.registerCommand(extConstants.COMMAND_PREFIX + '.addEventListener', (eventName, listener) => {
        let ls = listeners.get(eventName);
        if (!ls) {
            ls = [];
            listeners.set(eventName, ls);
        }
        ls.push(listener);
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
                const ls = listeners.get(param);
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

