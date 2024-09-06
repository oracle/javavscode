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
	LanguageClientOptions,
	ServerOptions,
	StreamInfo
} from 'vscode-languageclient/node';

import {
    CloseAction,
    ErrorAction,
    Message,
    MessageType,
    LogMessageNotification,
    RevealOutputChannelOn,
    DocumentSelector,
    ErrorHandlerResult,
    CloseHandlerResult,
    SymbolInformation,
    TextDocumentFilter,
    TelemetryEventNotification
} from 'vscode-languageclient';

import * as net from 'net';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ChildProcess } from 'child_process';
import * as vscode from 'vscode';
import * as ls from 'vscode-languageserver-protocol';
import * as launcher from './nbcode';
import { StreamDebugAdapter} from './streamDebugAdapter';
import { NbTestAdapter } from './testAdapter';
import { asRanges, StatusMessageRequest, ShowStatusMessageParams, QuickPickRequest, InputBoxRequest, MutliStepInputRequest, TestProgressNotification, DebugConnector,
         TextEditorDecorationCreateRequest, TextEditorDecorationSetNotification, TextEditorDecorationDisposeNotification, HtmlPageRequest, HtmlPageParams,
         ExecInHtmlPageRequest, SetTextEditorDecorationParams, ProjectActionParams, UpdateConfigurationRequest, QuickPickStep, InputBoxStep, SaveDocumentsRequest, SaveDocumentRequestParams
} from './protocol';
import * as launchConfigurations from './launchConfigurations';
import { createTreeViewService, TreeViewService, Visualizer } from './explorer';
import { initializeRunConfiguration, runConfigurationProvider, runConfigurationNodeProvider, configureRunSettings, runConfigurationUpdateAll } from './runConfiguration';
import { InputStep, MultiStepInput } from './utils';
import { PropertiesView } from './propertiesView/propertiesView';
import { openJDKSelectionView } from './jdkDownloader';
import { l10n } from './localiser';
import { ORACLE_VSCODE_EXTENSION_ID, NODE_WINDOWS_LABEL } from './constants';
const API_VERSION : string = "1.0";
const SERVER_NAME : string = "Oracle Java SE Language Server";
export const COMMAND_PREFIX : string = "jdk";
const listeners = new Map<string, string[]>();
let client: Promise<NbLanguageClient>;
let testAdapter: NbTestAdapter | undefined;
let nbProcess : ChildProcess | null = null;
let debugPort: number = -1;
let debugHash: string | undefined;
let consoleLog: boolean = !!process.env['ENABLE_CONSOLE_LOG'];
let deactivated:boolean = true;
export class NbLanguageClient extends LanguageClient {
    private _treeViewService: TreeViewService;

    constructor (id : string, name: string, s : ServerOptions, log : vscode.OutputChannel, c : LanguageClientOptions) {
        super(id, name, s, c);
        this._treeViewService = createTreeViewService(log, this);
    }

    findTreeViewService(): TreeViewService {
        return this._treeViewService;
    }

    stop(): Promise<void> {
        // stop will be called even in case of external close & client restart, so OK.
        const r: Promise<void> = super.stop();
        this._treeViewService.dispose();
        return r;
    }

}

export function handleLog(log: vscode.OutputChannel, msg: string): void {
    log.appendLine(msg);
    if (consoleLog) {
        console.log(msg);
    }
}

function handleLogNoNL(log: vscode.OutputChannel, msg: string): void {
    log.append(msg);
    if (consoleLog) {
        process.stdout.write(msg);
    }
}

export function enableConsoleLog() {
    consoleLog = true;
    console.log("enableConsoleLog");
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
    const c : Promise<NbLanguageClient> = client;
    if (c && !(c instanceof InitialPromise)) {
        return c;
    }
    let nbcode = vscode.extensions.getExtension(ORACLE_VSCODE_EXTENSION_ID);
    if (!nbcode) {
        return Promise.reject(new Error(l10n.value("jdk.extenstion.notInstalled.label")));
    }
    const t : Thenable<NbLanguageClient> = nbcode.activate().then(nc => {
        if (client === undefined || client instanceof InitialPromise) {
            throw new Error(l10n.value("jdk.extenstion.error_msg.clientNotAvailable"));
        } else {
            return client;
        }
    });
    return Promise.resolve(t);
}

function findJDK(onChange: (path : string | null) => void): void {
    let nowDark : boolean = isDarkColorTheme();
    let nowNbJavacDisabled : boolean = isNbJavacDisabled();
    function find(): string | null {
        let nbJdk = workspace.getConfiguration('jdk').get('jdkhome');
        if (nbJdk) {
            return nbJdk as string;
        }
        let javahome = workspace.getConfiguration('java').get('home');
        if (javahome) {
            return javahome as string;
        }

        let jdkHome: any = process.env.JDK_HOME;
        if (jdkHome) {
            return jdkHome as string;
        }
        let jHome: any = process.env.JAVA_HOME;
        if (jHome) {
            return jHome as string;
        }
        return null;
    }

    let currentJdk = find();
    let projectJdk : string | undefined = getProjectJDKHome();
    let timeout: NodeJS.Timeout | undefined = undefined;
    workspace.onDidChangeConfiguration(params => {
        if (timeout) {
            return;
        }
        let interested : boolean = false;
        if (params.affectsConfiguration('jdk') || params.affectsConfiguration('java')) {
            interested = true;
        } else if (params.affectsConfiguration('workbench.colorTheme')) {
            let d = isDarkColorTheme();
            if (d != nowDark) {
                interested = true;
            }
        }
        if (!interested) {
            return;
        }
        timeout = setTimeout(() => {
            timeout = undefined;
            let newJdk = find();
            let newD = isDarkColorTheme();
            let newNbJavacDisabled = isNbJavacDisabled();
            let newProjectJdk : string | undefined = workspace.getConfiguration('jdk')?.get('project.jdkhome') as string;
            if (newJdk !== currentJdk || newD != nowDark || newNbJavacDisabled != nowNbJavacDisabled || newProjectJdk != projectJdk) {
                nowDark = newD;
                currentJdk = newJdk;
                nowNbJavacDisabled = newNbJavacDisabled;
                projectJdk = newProjectJdk
                onChange(currentJdk);
            }
        }, 0);
    });
    onChange(currentJdk);
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
    return wrapCommandWithProgress(COMMAND_PREFIX + '.project.run.action', title, log, showOutput, actionParams, ...items);
}

function wrapCommandWithProgress(lsCommand : string, title : string, log? : vscode.OutputChannel, showOutput? : boolean, ...args : any[]) : Thenable<unknown> {
    return window.withProgress({ location: ProgressLocation.Window }, p => {
        return new Promise(async (resolve, reject) => {
            let c : LanguageClient = await client;
            const commands = await vscode.commands.getCommands();
            if (commands.includes(lsCommand)) {
                p.report({ message: title });
                c.outputChannel.show(true);
                const start = new Date().getTime();
                try {
                    if (log) {
                        handleLog(log, `starting ${lsCommand}`);
                    }
                    const res = await vscode.commands.executeCommand(lsCommand, ...args)
                    const elapsed = new Date().getTime() - start;
                    if (log) {
                        handleLog(log, `finished ${lsCommand} in ${elapsed} ms with result ${res}`);
                    }
                    const humanVisibleDelay = elapsed < 1000 ? 1000 : 0;
                    setTimeout(() => { // set a timeout so user would still see the message when build time is short
                        if (res) {
                            resolve(res);
                        } else {
                            if (log) {
                                handleLog(log, `Command ${lsCommand} takes too long to start`);
                            }
                            reject(res);
                        }
                    }, humanVisibleDelay);
                } catch (err: any) {
                    if (log) {
                        handleLog(log, `command ${lsCommand} executed with error: ${JSON.stringify(err)}`);
                    }
                }
            } else {
                reject(l10n.value("jdk.extenstion.progressBar.error_msg.cannotRun",{lsCommand:lsCommand,client:c}));
            }
        });
    });
}

/**
 * Just a simple promise subclass, so I can test for the 'initial promise' value:
 * unlike all other promises, that must be fullfilled in order to e.g. properly stop the server or otherwise communicate with it,
 * the initial one needs to be largely ignored in the launching/mgmt code, BUT should be available to normal commands / features.
 */
class InitialPromise extends Promise<NbLanguageClient> {
    constructor(f : (resolve: (value: NbLanguageClient | PromiseLike<NbLanguageClient>) => void, reject: (reason?: any) => void) => void) {
        super(f);
    }
}

export function activate(context: ExtensionContext): VSNetBeansAPI {
    deactivated=false;
    let log = vscode.window.createOutputChannel(SERVER_NAME);
    var clientResolve : (x : NbLanguageClient) => void;
    var clientReject : (err : any) => void;

    // establish a waitable Promise, export the callbacks so they can be called after activation.
    client = new InitialPromise((resolve, reject) => {
        clientResolve = resolve;
        clientReject = reject;
    });

    // find acceptable JDK and launch the Java part
    findJDK((specifiedJDK) => {
        let currentClusters = findClusters(context.extensionPath).sort();
        const dsSorter = (a: TextDocumentFilter, b: TextDocumentFilter) => {
            return (a.language || '').localeCompare(b.language || '')
                || (a.pattern || '').localeCompare(b.pattern || '')
                || (a.scheme || '').localeCompare(b.scheme || '');
        };
        let currentDocumentSelectors = collectDocumentSelectors().sort(dsSorter);
        context.subscriptions.push(vscode.extensions.onDidChange(() => {
            const newClusters = findClusters(context.extensionPath).sort();
            const newDocumentSelectors = collectDocumentSelectors().sort(dsSorter);
            if (newClusters.length !== currentClusters.length || newDocumentSelectors.length !== currentDocumentSelectors.length
                || newClusters.find((value, index) => value !== currentClusters[index]) || newDocumentSelectors.find((value, index) => value !== currentDocumentSelectors[index])) {
                currentClusters = newClusters;
                currentDocumentSelectors = newDocumentSelectors;
                activateWithJDK(specifiedJDK, context, log, true, clientResolve, clientReject);
            }
        }));
        activateWithJDK(specifiedJDK, context, log, true, clientResolve, clientReject);
    });

    //register debugger:
    let debugTrackerFactory =new NetBeansDebugAdapterTrackerFactory();
    context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory('jdk', debugTrackerFactory));
    let configInitialProvider = new NetBeansConfigurationInitialProvider();
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('jdk', configInitialProvider, vscode.DebugConfigurationProviderTriggerKind.Initial));
    let configDynamicProvider = new NetBeansConfigurationDynamicProvider(context);
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('jdk', configDynamicProvider, vscode.DebugConfigurationProviderTriggerKind.Dynamic));
    let configResolver = new NetBeansConfigurationResolver();
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('jdk', configResolver));
    context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(((session) => onDidTerminateSession(session))));

    let debugDescriptionFactory = new NetBeansDebugAdapterDescriptionFactory();
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('jdk', debugDescriptionFactory));

    // initialize Run Configuration
    initializeRunConfiguration().then(initialized => {
		if (initialized) {
			context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('jdk', runConfigurationProvider));
			context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('java', runConfigurationProvider));
			context.subscriptions.push(vscode.window.registerTreeDataProvider('run-config', runConfigurationNodeProvider));
			context.subscriptions.push(vscode.commands.registerCommand(COMMAND_PREFIX + '.workspace.configureRunSettings', (...params: any[]) => {
				configureRunSettings(context, params);
			}));
			vscode.commands.executeCommand('setContext', 'runConfigurationInitialized', true);
		}
	});

    // register commands
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.workspace.new', async (ctx, template) => {
        let c : LanguageClient = await client;
        const commands = await vscode.commands.getCommands();
        if (commands.includes(COMMAND_PREFIX + '.new.from.template')) {
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
                await vscode.commands.executeCommand(COMMAND_PREFIX + '.new.from.template', folderPathUri.toString());
                await vscode.commands.executeCommand(`vscode.openFolder`, folderPathUri);

                return;
            }

            // first give the template (if present), then the context, and then the open-file hint in the case the context is not specific enough
            const params = [];
            if (typeof template === 'string') {
                params.push(template);
            }
            params.push(contextUri(ctx)?.toString(), vscode.window.activeTextEditor?.document?.uri?.toString());
            const res = await vscode.commands.executeCommand(COMMAND_PREFIX + '.new.from.template', ...params);
            
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
            throw l10n.value("jdk.extenstion.error_msg.doesntSupportNewTeamplate",{client:c});
        }
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.workspace.newproject', async (ctx) => {
        let c : LanguageClient = await client;
        const commands = await vscode.commands.getCommands();
        if (commands.includes(COMMAND_PREFIX + '.new.project')) {
            const res = await vscode.commands.executeCommand(COMMAND_PREFIX + '.new.project', contextUri(ctx)?.toString());
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
            throw l10n.value("jdk.extenstion.error_msg.doesntSupportNewProject",{client,c});
        }
    }));

    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.open.test', async (ctx) => {
        let c: LanguageClient = await client;
        const commands = await vscode.commands.getCommands();
        if (commands.includes(COMMAND_PREFIX + '.go.to.test')) {
            try {
                const res: any = await vscode.commands.executeCommand(COMMAND_PREFIX + '.go.to.test', contextUri(ctx)?.toString());
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
            throw l10n.value("jdk.extenstion.error_msg.doesntSupportGoToTest",{client:c});
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand(COMMAND_PREFIX + ".delete.cache", async () => {
        const storagePath = context.storageUri?.fsPath;
        if (!storagePath) {
            vscode.window.showErrorMessage(l10n.value("jdk.extenstion.cache.error_msg.cannotFindWrkSpacePath"));
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
                    await stopClient(client);
                    deactivated = true;
                    await killNbProcess(false, log);
                    await fs.promises.rmdir(userDir, { recursive: true });
                    await vscode.window.showInformationMessage(l10n.value("jdk.extenstion.message.cacheDeleted"), reloadWindowActionLabel);
                } catch (err) {
                    await vscode.window.showErrorMessage(l10n.value("jdk.extenstion.error_msg.cacheDeletionError"), reloadWindowActionLabel);
                } finally {
                    vscode.commands.executeCommand("workbench.action.reloadWindow");
                }
            }
        } else {
            vscode.window.showErrorMessage(l10n.value("jdk.extension.cache.message.noUserDir"));
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand(COMMAND_PREFIX + ".download.jdk", async () => { openJDKSelectionView(log); }));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.workspace.compile', () =>
        wrapCommandWithProgress(COMMAND_PREFIX + '.build.workspace', l10n.value('jdk.extension.command.progress.compilingWorkSpace'), log, true)
    ));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.workspace.clean', () =>
        wrapCommandWithProgress(COMMAND_PREFIX + '.clean.workspace',l10n.value('jdk.extension.command.progress.cleaningWorkSpace'), log, true)
    ));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.project.compile', (args) => {
        wrapProjectActionWithProgress('build', undefined, l10n.value('jdk.extension.command.progress.compilingProject'), log, true, args);
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.project.clean', (args) => {
        wrapProjectActionWithProgress('clean', undefined, l10n.value('jdk.extension.command.progress.cleaningProject'), log, true, args);
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.open.type', () => {
        wrapCommandWithProgress(COMMAND_PREFIX + '.quick.open', l10n.value('jdk.extension.command.progress.quickOpen'), log, true).then(() => {
            commands.executeCommand('workbench.action.focusActiveEditorGroup');
        });
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.java.goto.super.implementation', async () => {
        if (window.activeTextEditor?.document.languageId !== "java") {
            return;
        }
        const uri = window.activeTextEditor.document.uri;
        const position = window.activeTextEditor.selection.active;
        const locations: any[] = await vscode.commands.executeCommand(COMMAND_PREFIX + '.java.super.implementation', uri.toString(), position) || [];
        return vscode.commands.executeCommand('editor.action.goToLocations', window.activeTextEditor.document.uri, position,
            locations.map(location => new vscode.Location(vscode.Uri.parse(location.uri), new vscode.Range(location.range.start.line, location.range.start.character, location.range.end.line, location.range.end.character))),
            'peek', l10n.value('jdk.extenstion.error_msg.noSuperImpl'));
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.rename.element.at', async (offset) => {
        const editor = window.activeTextEditor;
        if (editor) {
            await commands.executeCommand('editor.action.rename', [
                editor.document.uri,
                editor.document.positionAt(offset),
            ]);
        }
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.surround.with', async (items) => {
        const selected: any = await window.showQuickPick(items, { placeHolder: l10n.value('jdk.extension.command.quickPick.placeholder.surroundWith') });
        if (selected) {
            if (selected.userData.edit) {
                const edit = await (await client).protocol2CodeConverter.asWorkspaceEdit(selected.userData.edit as ls.WorkspaceEdit);
                await workspace.applyEdit(edit);
                await commands.executeCommand('workbench.action.focusActiveEditorGroup');
            }
            await commands.executeCommand(selected.userData.command.command, ...(selected.userData.command.arguments || []));
        }
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.generate.code', async (command, data) => {
        const edit: any = await commands.executeCommand(command, data);
        if (edit) {
            const wsEdit = await (await client).protocol2CodeConverter.asWorkspaceEdit(edit as ls.WorkspaceEdit);
            await workspace.applyEdit(wsEdit);
            await commands.executeCommand('workbench.action.focusActiveEditorGroup');
        }
    }));

    async function findRunConfiguration(uri : vscode.Uri) : Promise<vscode.DebugConfiguration|undefined> {
        // do not invoke debug start with no (java+) configurations, as it would probably create an user prompt
        let cfg = vscode.workspace.getConfiguration("launch");
        let c = cfg.get('configurations');
        if (!Array.isArray(c)) {
            return undefined;
        }
        let f = c.filter((v) => v['type'] === 'java+');
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
        let d = vscode.debug.registerDebugConfigurationProvider('java+', provider);
        // let vscode to select a debug config
        return await vscode.commands.executeCommand('workbench.action.debug.start', { config: {
            type: 'java+',
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
                type: "jdk",
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

    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.run.test', async (uri, methodName?, launchConfiguration?) => {
        await runDebug(true, true, uri, methodName, launchConfiguration);
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.debug.test', async (uri, methodName?, launchConfiguration?) => {
        await runDebug(false, true, uri, methodName, launchConfiguration);
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.run.single', async (uri, methodName?, launchConfiguration?) => {
        await runDebug(true, false, uri, methodName, launchConfiguration);
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.debug.single', async (uri, methodName?, launchConfiguration?) => {
        await runDebug(false, false, uri, methodName, launchConfiguration);
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.project.run', async (node, launchConfiguration?) => {
        return runDebug(true, false, contextUri(node)?.toString() || '',  undefined, launchConfiguration, true);
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.project.debug', async (node, launchConfiguration?) => {
        return runDebug(false, false, contextUri(node)?.toString() || '',  undefined, launchConfiguration, true);
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.project.test', async (node, launchConfiguration?) => {
        return runDebug(true, true, contextUri(node)?.toString() || '',  undefined, launchConfiguration, true);
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.package.test', async (uri, launchConfiguration?) => {
        await runDebug(true, true, uri, undefined, launchConfiguration);
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.open.stacktrace', async (uri, methodName, fileName, line) => {
        const location: string | undefined = uri ? await commands.executeCommand(COMMAND_PREFIX + '.resolve.stacktrace.location', uri, methodName, fileName) : undefined;
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
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.workspace.symbols', async (query) => {
        const c = await client;
        return (await c.sendRequest<SymbolInformation[]>("workspace/symbol", { "query": query })) ?? [];
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.java.complete.abstract.methods', async () => {
        const active = vscode.window.activeTextEditor;
        if (active) {
            const position = new vscode.Position(active.selection.start.line, active.selection.start.character);
            await commands.executeCommand(COMMAND_PREFIX + '.java.implement.all.abstract.methods', active.document.uri.toString(), position);
        }
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.startup.condition', async () => {
        return client;
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.addEventListener', (eventName, listener) => {
        let ls = listeners.get(eventName);
        if (!ls) {
            ls = [];
            listeners.set(eventName, ls);
        }
        ls.push(listener);
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND_PREFIX + '.node.properties.edit',
        async (node) => await PropertiesView.createOrShow(context, node, (await client).findTreeViewService())));

    const archiveFileProvider = <vscode.TextDocumentContentProvider> {
        provideTextDocumentContent: async (uri: vscode.Uri, token: vscode.CancellationToken): Promise<string> => {
            return await commands.executeCommand(COMMAND_PREFIX + '.get.archive.file.content', uri.toString());
        }
    };
    context.subscriptions.push(workspace.registerTextDocumentContentProvider('jar', archiveFileProvider));
    context.subscriptions.push(workspace.registerTextDocumentContentProvider('nbjrt', archiveFileProvider));

    launchConfigurations.updateLaunchConfig();

    // register completions:
    launchConfigurations.registerCompletion(context);
    return Object.freeze({
        version : API_VERSION,
        apiVersion : API_VERSION
    });
}

/**
 * Pending maintenance (install) task, activations should be chained after it.
 */
let maintenance : Promise<void> | null;

/**
 * Pending activation flag. Will be cleared when the process produces some message or fails.
 */
let activationPending : boolean = false;

function activateWithJDK(specifiedJDK: string | null, context: ExtensionContext, log : vscode.OutputChannel, notifyKill: boolean, 
    clientResolve? : (x : NbLanguageClient) => void, clientReject? : (x : any) => void): void {
    if (activationPending) {
        // do not activate more than once in parallel.
        handleLog(log, "Server activation requested repeatedly, ignoring...");
        return;
    }
    let oldClient = client;
    let setClient : [(c : NbLanguageClient) => void, (err : any) => void];
    client = new Promise<NbLanguageClient>((clientOK, clientErr) => {
        setClient = [
            function (c : NbLanguageClient) {
                clientOK(c);
                if (clientResolve) {
                    clientResolve(c);
                }
            }, function (err) {
                clientErr(err);
                if (clientReject) {
                    clientReject(err);
                }
            }
        ]
        //setClient = [ clientOK, clientErr ];
    });
    const a : Promise<void> | null = maintenance;

    commands.executeCommand('setContext', 'nbJdkReady', false);
    activationPending = true;
    // chain the restart after termination of the former process.
    if (a != null) {
        handleLog(log, "Server activation initiated while in maintenance mode, scheduling after maintenance");
        a.then(() => stopClient(oldClient)).then(() => killNbProcess(notifyKill, log)).then(() => {
            doActivateWithJDK(specifiedJDK, context, log, notifyKill, setClient);
        });
    } else {
        handleLog(log, "Initiating server activation");
        stopClient(oldClient).then(() => killNbProcess(notifyKill, log)).then(() => {
            doActivateWithJDK(specifiedJDK, context, log, notifyKill, setClient);
        });
    }
}


function killNbProcess(notifyKill : boolean, log : vscode.OutputChannel, specProcess?: ChildProcess) : Promise<void> {
    const p = nbProcess;
    handleLog(log, "Request to kill LSP server.");
    if (p && (!specProcess || specProcess == p)) {
        if (notifyKill) {
            vscode.window.setStatusBarMessage(l10n.value("jdk.extension.command.statusBar.message.restartingServer",{SERVER_NAME:SERVER_NAME}), 2000);
        }
        return new Promise((resolve, reject) => {
            nbProcess = null;
            p.on('close', function(code: number) {
                handleLog(log, "LSP server closed: " + p.pid)
                resolve();
            });
            handleLog(log, "Killing LSP server " + p.pid);
            if (!p.kill()) {
                reject("Cannot kill");
            }
        });
    } else {
        let msg = "Cannot kill: ";
        if (specProcess) {
            msg += "Requested kill on " + specProcess.pid + ", ";
        }
        handleLog(log, msg + "current process is " + (p ? p.pid : "None"));
        return new Promise((res, rej) => { res(); });
    }
}

/**
 * Attempts to determine if the Workbench is using dark-style color theme, so that NBLS
 * starts with some dark L&F for icon resource selection.
 */
function isDarkColorTheme() : boolean {
    const themeName = workspace.getConfiguration('workbench')?.get('colorTheme');
    if (!themeName) {
        return false;
    }
    for (const ext of vscode.extensions.all) {
        const themeList : object[] =  ext.packageJSON?.contributes && ext.packageJSON?.contributes['themes'];
        if (!themeList) {
            continue;
        }
        let t : any;
        for (t of themeList) {
            if (t.id !== themeName) {
                continue;
            }
            const uiTheme = t.uiTheme;
            if (typeof(uiTheme) == 'string') {
                if (uiTheme.includes('-dark') || uiTheme.includes('-black')) {
                    return true;
                }
            }
        }
    }
    return false;
}

function isNbJavacDisabled() : boolean {
    return workspace.getConfiguration('jdk')?.get('advanced.disable.nbjavac') as boolean;
}

function getProjectJDKHome() : string {
    return workspace.getConfiguration('jdk')?.get('project.jdkhome') as string;
}

function doActivateWithJDK(specifiedJDK: string | null, context: ExtensionContext, log : vscode.OutputChannel, notifyKill: boolean,
    setClient : [(c : NbLanguageClient) => void, (err : any) => void]
): void {
    maintenance = null;
    let restartWithJDKLater : ((time: number, n: boolean) => void) = function restartLater(time: number, n : boolean) {
        handleLog(log, `Restart of ${SERVER_NAME} requested in ${(time / 1000)} s.`);
        setTimeout(() => {
            activateWithJDK(specifiedJDK, context, log, n);
        }, time);
    };

    const netbeansConfig = workspace.getConfiguration('jdk');
    const beVerbose : boolean = netbeansConfig.get('verbose', false);
    let userdir = process.env['nbcode_userdir'] || netbeansConfig.get('userdir', 'local');
    switch (userdir) {
        case 'local':
            if (context.storagePath) {
                userdir = context.storagePath;
                break;
            }
            // fallthru
        case 'global':
            userdir = context.globalStoragePath;
            break;
        default:
            // assume storage is path on disk
    }

    let disableModules : string[] = [];
    let enableModules : string[] = [];
    if (isNbJavacDisabled()) {
        disableModules.push('org.netbeans.libs.nbjavacapi');
    } else {
        enableModules.push('org.netbeans.libs.nbjavacapi');
    }

    let projectSearchRoots:string = '';
    const isProjectFolderSearchLimited : boolean = !netbeansConfig.get('advanced.disable.projectSearchLimit', false);
    if (isProjectFolderSearchLimited) {
        try {
            projectSearchRoots = os.homedir() as string;
        } catch (err:any) {
            handleLog(log, `Failed to obtain the user home directory due to: ${err}`);
        }
        if (!projectSearchRoots) {
            projectSearchRoots = os.type() === NODE_WINDOWS_LABEL ? '%USERPROFILE%' : '$HOME';   // The launcher script may perform the env variable substitution
            handleLog(log, `Using userHomeDir = "${projectSearchRoots}" as the launcher script may perform env var substitution to get its value.`);
        }
        const workspaces = workspace.workspaceFolders;
        if (workspaces) {
            workspaces.forEach(workspace => {
                if (workspace.uri) {
                    try {
                        projectSearchRoots = projectSearchRoots + path.delimiter + path.normalize(workspace.uri.fsPath);
                    } catch (err:any) {
                        handleLog(log, `Failed to get the workspace path: ${err}`);
                    }
                }
            });
        }
    }

    let info = {
        clusters : findClusters(context.extensionPath),
        extensionPath: context.extensionPath,
        storagePath : userdir,
        jdkHome : specifiedJDK,
        projectSearchRoots: projectSearchRoots,
        verbose: beVerbose,
        disableModules : disableModules,
        enableModules : enableModules,
    };

    const requiredJdk = specifiedJDK ? specifiedJDK : 'default system JDK';
    let launchMsg = l10n.value("jdk.extension.lspServer.statusBar.message.launching",{
        SERVER_NAME:SERVER_NAME,
        requiredJdk:requiredJdk,
        userdir:userdir
        });
    handleLog(log, launchMsg);
    vscode.window.setStatusBarMessage(launchMsg, 2000);

    let ideRunning = new Promise((resolve, reject) => {
        let stdOut : string | null = '';
        let stdErr : string | null = '';
        function logAndWaitForEnabled(text: string, isOut: boolean) {
            if (p == nbProcess) {
                activationPending = false;
            }
            handleLogNoNL(log, text);
            if (stdOut == null) {
                return;
            }
            if (isOut) {
                stdOut += text;
            } else {
                stdErr += text;
            }
            if (stdOut.match(/org.netbeans.modules.java.lsp.server/)) {
                resolve(text);
                stdOut = null;
            }
        }
        let extras : string[] = ["--modules", "--list", "-J-XX:PerfMaxStringConstLength=10240"];
        if (isDarkColorTheme()) {
            extras.push('--laf', 'com.formdev.flatlaf.FlatDarkLaf');
        }
        let serverVmOptions: string[] = workspace.getConfiguration('jdk').get("serverVmOptions",[]);
        extras.push(...serverVmOptions.map(el => `-J${el}`));
        let p = launcher.launch(info, ...extras);
        handleLog(log, "LSP server launching: " + p.pid);
        handleLog(log, "LSP server user directory: " + userdir);
        p.stdout.on('data', function(d: any) {
            logAndWaitForEnabled(d.toString(), true);
        });
        p.stderr.on('data', function(d: any) {
            logAndWaitForEnabled(d.toString(), false);
        });
        nbProcess = p;
        p.on('close', function(code: number) {
            if (p == nbProcess) {
                nbProcess = null;
            }
            if (p == nbProcess && code != 0 && code) {
                vscode.window.showWarningMessage(l10n.value("jdk.extension.lspServer.warning_message.serverExited",{SERVER_NAME:SERVER_NAME,code:code}));
            }
            if (stdErr?.match(/Cannot find java/) || (os.type() === NODE_WINDOWS_LABEL && !deactivated) ) {
                const downloadAndSetupActionLabel = l10n.value("jdk.extension.lspServer.label.downloadAndSetup")
                vscode.window.showInformationMessage(
                    l10n.value("jdk.extension.lspServer.message.noJdkFound"),
                    downloadAndSetupActionLabel
                ).then( selection => {
                    if (selection === downloadAndSetupActionLabel) {
                        openJDKSelectionView(log);
                    }
                });
            }
            if (stdOut != null) {
                let match = stdOut.match(/org.netbeans.modules.java.lsp.server[^\n]*/)
                if (match?.length == 1) {
                    handleLog(log, match[0]);
                } else {
                    handleLog(log, "Cannot find org.netbeans.modules.java.lsp.server in the log!");
                }
                handleLog(log, `Please refer to troubleshooting section for more info: https://github.com/oracle/javavscode/blob/main/README.md#troubleshooting`);
                log.show(false);
                killNbProcess(false, log, p);
                reject(`${SERVER_NAME} not enabled!`);
            } else {
                handleLog(log, "LSP server " + p.pid + " terminated with " + code);
                handleLog(log, "Exit code " + code);
            }
        });
    });

    ideRunning.then(() => {
        const connection = () => new Promise<StreamInfo>((resolve, reject) => {
            const srv = launcher.launch(info,
                `--start-java-language-server=listen-hash:0`,
                `--start-java-debug-adapter-server=listen-hash:0`
            );
            if (!srv) {
                reject();
            } else {
                if (!srv.stdout) {
                    reject(`No stdout to parse!`);
                    srv.disconnect();
                    return;
                }
                debugPort = -1;
                var lspServerStarted = false;
                srv.stdout.on("data", (chunk) => {
                    if (debugPort < 0) {
                        const info = chunk.toString().match(/Debug Server Adapter listening at port (\d*) with hash (.*)\n/);
                        if (info) {
                            debugPort = info[1];
                            debugHash = info[2];
                        }
                    }
                    if (!lspServerStarted) {
                        const info = chunk.toString().match(/Java Language Server listening at port (\d*) with hash (.*)\n/);
                        if (info) {
                            const port : number = info[1];
                            const server = net.connect(port, "127.0.0.1", () => {
                                server.write(info[2]);
                                resolve({
                                    reader: server,
                                    writer: server
                                });
                            });
                            lspServerStarted = true;
                        }
                    }
                });
                srv.once("error", (err) => {
                    reject(err);
                });
            }
        });
        const conf = workspace.getConfiguration();
        let documentSelectors : DocumentSelector = [
                { language: 'java' },
                { language: 'yaml', pattern: '**/{application,bootstrap}*.yml' },
                { language: 'properties', pattern: '**/{application,bootstrap}*.properties' },
                { language: 'jackpot-hint' },
                { language: 'xml', pattern: '**/pom.xml' },
                { pattern: '**/build.gradle'}
        ];
        documentSelectors.push(...collectDocumentSelectors());
        // Options to control the language client
        let clientOptions: LanguageClientOptions = {
            // Register the server for java documents
            documentSelector: documentSelectors,
            synchronize: {
                configurationSection: [
                    'jdk.hints',
                    'jdk.format',
                    'jdk.java.imports',
                    'jdk.project.jdkhome',
                    'jdk.runConfig.vmOptions',
                    'jdk.runConfig.cwd'
                ],
                fileEvents: [
                    workspace.createFileSystemWatcher('**/*.java')
                ]
            },
            outputChannel: log,
            revealOutputChannelOn: RevealOutputChannelOn.Never,
            progressOnInitialization: true,
            initializationOptions : {
                'nbcodeCapabilities' : {
                    'statusBarMessageSupport' : true,
                    'testResultsSupport' : true,
                    'showHtmlPageSupport' : true,
                    'wantsJavaSupport' : true,
                    'wantsGroovySupport' : false,
                    'commandPrefix': COMMAND_PREFIX,
                    'configurationPrefix': 'jdk.',
                    'altConfigurationPrefix': 'jdk.'
                }
            },
            errorHandler: {
                error : function(error: Error, _message: Message, count: number): ErrorHandlerResult {
                    return { action: ErrorAction.Continue, message: error.message };
                },
                closed : function(): CloseHandlerResult {
                    handleLog(log, `Connection to ${SERVER_NAME} closed.`);
                    if (!activationPending) {
                        restartWithJDKLater(10000, false);
                    }
                    return { action: CloseAction.DoNotRestart };
                }
            }
        }


        let c = new NbLanguageClient(
                'java',
                'Oracle Java SE',
                connection,
                log,
                clientOptions
        );
        handleLog(log, 'Language Client: Starting');
        c.start().then(() => {
            testAdapter = new NbTestAdapter();
            c.onNotification(StatusMessageRequest.type, showStatusBarMessage);
            c.onRequest(HtmlPageRequest.type, showHtmlPage);
            c.onRequest(ExecInHtmlPageRequest.type, execInHtmlPage);
            c.onNotification(LogMessageNotification.type, (param) => handleLog(log, param.message));
            c.onRequest(QuickPickRequest.type, async param => {
                const selected = await window.showQuickPick(param.items, { title: param.title, placeHolder: param.placeHolder, canPickMany: param.canPickMany, ignoreFocusOut: true });
                return selected ? Array.isArray(selected) ? selected : [selected] : undefined;
            });
            c.onRequest(UpdateConfigurationRequest.type, async (param) => {
                handleLog(log, "Received config update: " + param.section + "." + param.key + "=" + param.value);
                let wsFile: vscode.Uri | undefined = vscode.workspace.workspaceFile;
                let wsConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(param.section);
                if (wsConfig) {
                    try {
                        wsConfig.update(param.key, param.value, wsFile ? null : true)
                            .then(() => {
                                handleLog(log, "Updated configuration: " + param.section + "." + param.key + "=" + param.value + "; in: " + (wsFile ? wsFile.toString() : "Global"));
                            })
                            .then(() => {
                                runConfigurationUpdateAll();
                            });
                    } catch (err) {
                        handleLog(log, "Failed to update configuration. Reason: " + (typeof err === "string" ? err : err instanceof Error ? err.message : "error"));
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
                if (testAdapter) {
                    testAdapter.testProgress(param.suite);
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
            context.subscriptions.push(disposableListener);
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
            handleLog(log, 'Language Client: Ready');
            setClient[0](c);
            commands.executeCommand('setContext', 'nbJdkReady', true);
        
            // create project explorer:
            //c.findTreeViewService().createView('foundProjects', 'Projects', { canSelectMany : false });
            createProjectView(context, c);
        }).catch(setClient[1]);
    }).catch((reason) => {
        activationPending = false;
        handleLog(log, reason);
        window.showErrorMessage(l10n.value("jdk.extension.lspServer.error_message",{reason:reason}));
    });

    async function createProjectView(ctx : ExtensionContext, client : NbLanguageClient) {
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

        ctx.subscriptions.push(window.onDidChangeActiveTextEditor(ed => {
            const netbeansConfig = workspace.getConfiguration('jdk');
            if (netbeansConfig.get("revealActiveInProjects")) {
                revealActiveEditor(ed);
            }
        }));
        ctx.subscriptions.push(vscode.commands.registerCommand(COMMAND_PREFIX + ".select.editor.projects", () => revealActiveEditor()));

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
            const resourceDir = vscode.Uri.joinPath(context.globalStorageUri, params.id);
            workspace.fs.createDirectory(resourceDir);
            let view = vscode.window.createWebviewPanel('htmlView', name, vscode.ViewColumn.Beside, {
                enableScripts: true,
                localResourceRoots: [resourceDir, vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode/codicons', 'dist')]
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
            const codiconsUri = view.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
            view.webview.html = data.replace('href="codicon.css"', 'href="' + codiconsUri + '"');
            view.webview.onDidReceiveMessage(message => {
                switch (message.command) {
                    case 'dispose':
                        webviews.delete(params.id);
                        view.dispose();
                        break;
                    case 'command':
                        vscode.commands.executeCommand(COMMAND_PREFIX + '.htmlui.process.command', message.data);
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

    function checkInstallNbJavac(msg : string) {
        const NO_JAVA_SUPPORT = "Cannot initialize Java support";
        if (msg.startsWith(NO_JAVA_SUPPORT)) {
            if (isNbJavacDisabled()) {
                const message = l10n.value("jdk.extension.nbjavac.message.supportedVersionRequired");
                const enable = l10n.value("jdk.extension.nbjavac.label.enableNbjavac");
                const settings = l10n.value("jdk.extension.nbjavac.label.openSettings");
                window.showErrorMessage(message, enable, settings).then(reply => {
                    if (enable === reply) {
                        workspace.getConfiguration().update('jdk.advanced.disable.nbjavac', false);
                    } else if (settings === reply) {
                        vscode.commands.executeCommand('workbench.action.openSettings', 'jdk.jdkhome');
                    }
                });
            } else {
                const yes = l10n.value("jdk.extension.javaSupport.label.installGpl");
                window.showErrorMessage(l10n.value("jdk.extension.javaSupport.message.needAdditionalSupport"), yes).then(reply => {
                    if (yes === reply) {
                        vscode.window.setStatusBarMessage(`Preparing ${SERVER_NAME} for additional installation`, 2000);
                        restartWithJDKLater = function() {
                            handleLog(log, `Ignoring request for restart of ${SERVER_NAME}`);
                        };
                        maintenance = new Promise((resolve, reject) => {
                            const kill : Promise<void> = killNbProcess(false, log);
                            kill.then(() => {
                                let installProcess = launcher.launch(info, "-J-Dnetbeans.close=true", "--modules", "--install", ".*nbjavac.*");
                                handleLog(log, "Launching installation process: " + installProcess.pid);
                                let logData = function(d: any) {
                                    handleLogNoNL(log, d.toString());
                                };
                                installProcess.stdout.on('data', logData);
                                installProcess.stderr.on('data', logData);
                                installProcess.addListener("error", reject);
                                // MUST wait on 'close', since stdout is inherited by children. The installProcess dies but
                                // the inherited stream will be closed by the last child dying.
                                installProcess.on('close', function(code: number) {
                                    handleLog(log, "Installation completed: " + installProcess.pid);
                                    handleLog(log, "Additional Java Support installed with exit code " + code);
                                    // will be actually run after maintenance is resolve()d.
                                    activateWithJDK(specifiedJDK, context, log, notifyKill)
                                    resolve();
                                });
                                return installProcess;
                            });
                        });
                    }
                });
            }
        }
    }
}

function stopClient(clientPromise: Promise<LanguageClient>): Thenable<void> {
    if (testAdapter) {
        testAdapter.dispose();
        testAdapter = undefined;
    }
    return clientPromise && !(clientPromise instanceof InitialPromise) ? clientPromise.then(c => c.stop()) : Promise.resolve();
}

export function deactivate(): Thenable<void> {
    if (nbProcess != null) {
        nbProcess.kill();
    }
    return stopClient(client);
}

function collectDocumentSelectors(): TextDocumentFilter[] {
    const selectors = [];
    for (const extension of vscode.extensions.all) {
        const contributesSection = extension.packageJSON['contributes'];
        if (contributesSection) {
            const documentSelectors = contributesSection['netbeans.documentSelectors'];
            if (Array.isArray(documentSelectors) && documentSelectors.length) {
                selectors.push(...documentSelectors);
            }
        }
    }
    return selectors;
}

class NetBeansDebugAdapterTrackerFactory implements vscode.DebugAdapterTrackerFactory {

    createDebugAdapterTracker(_session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterTracker> {
        return {
            onDidSendMessage(message: any): void {
                if (testAdapter && message.type === 'event' && message.event === 'output') {
                    testAdapter.testOutput(message.body.output);
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
                if (debugPort < 0) {
                    if (cnt-- > 0) {
                        setTimeout(fnc, 1000);
                    } else {
                        reject(new Error(l10n.value('jdk.extenstion.debugger.error_msg.debugAdapterNotInitialized')));
                    }
                } else {
                    // resolve(new vscode.DebugAdapterServer(debugPort));
                   const socket = net.connect(debugPort, "127.0.0.1", () => {});
                   socket.on("connect", () => {
                       const adapter = new StreamDebugAdapter();
                       socket.write(debugHash ? debugHash : "");
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
        let c : LanguageClient = await client;
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
        const configNames : string[] | null | undefined = await vscode.commands.executeCommand(COMMAND_PREFIX + '.project.configurations', u?.toString());
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
                    type: "jdk",
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
        let c : LanguageClient = await client;
        if (!folder) {
            return [];
        }
        let result : vscode.DebugConfiguration[] = [];
        const attachConnectors : DebugConnector[] | null | undefined = await vscode.commands.executeCommand(COMMAND_PREFIX + '.java.attachDebugger.configurations');
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
                        let cmd: string = COMMAND_PREFIX + ".java.attachDebugger.connector." + ac.id + "." + ac.arguments[i];
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
            config.type = 'jdk';
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

