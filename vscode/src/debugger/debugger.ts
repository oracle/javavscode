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

import * as net from 'net';
import * as vscode from 'vscode';
import { commands, ExtensionContext } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { DebugConnector } from '../lsp/protocol';
import { extConstants } from '../constants';
import { l10n } from '../localiser';
import { StreamDebugAdapter } from './streamDebugAdapter';
import { extCommands, nbCommands } from '../commands/commands';
import { argumentsNode, environmentVariablesNode, vmOptionsNode, workingDirectoryNode } from '../views/runConfiguration';
import { initializeRunConfiguration } from '../utils';
import { globalState } from '../globalState';

export function registerDebugger(context: ExtensionContext): void {
    let debugTrackerFactory = new NetBeansDebugAdapterTrackerFactory();
    context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory(extConstants.COMMAND_PREFIX, debugTrackerFactory));
    let configInitialProvider = new NetBeansConfigurationInitialProvider();
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(extConstants.COMMAND_PREFIX, configInitialProvider, vscode.DebugConfigurationProviderTriggerKind.Initial));
    let configDynamicProvider = new NetBeansConfigurationDynamicProvider(context);
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(extConstants.COMMAND_PREFIX, configDynamicProvider, vscode.DebugConfigurationProviderTriggerKind.Dynamic));
    let configResolver = new NetBeansConfigurationResolver();
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(extConstants.COMMAND_PREFIX, configResolver));
    let debugDescriptionFactory = new NetBeansDebugAdapterDescriptionFactory();
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory(extConstants.COMMAND_PREFIX, debugDescriptionFactory));
    initializeRunConfiguration().then(initialized => {
        if (initialized) {
            context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(extConstants.COMMAND_PREFIX, new RunConfigurationProvider()));
        }
    });
};

class NetBeansDebugAdapterTrackerFactory implements vscode.DebugAdapterTrackerFactory {

    createDebugAdapterTracker(_session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterTracker> {
        return {
            onDidSendMessage(message: any): void {
                const testAdapter = globalState.getTestAdapter();
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
                if (globalState.getDebugPort() < 0) {
                    if (cnt-- > 0) {
                        setTimeout(fnc, 1000);
                    } else {
                        reject(new Error(l10n.value('jdk.extension.debugger.error_msg.debugAdapterNotInitialized')));
                    }
                } else {
                    // resolve(new vscode.DebugAdapterServer(debugPort));
                    const socket = net.connect(globalState.getDebugPort(), "127.0.0.1", () => { });
                    socket.on("connect", () => {
                        const adapter = new StreamDebugAdapter();
                        socket.write(globalState?.getDebugHash() || "");
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

    async doProvideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined, _token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration[]> {
        let c: LanguageClient = await globalState.getClientPromise().client;
        if (!folder) {
            return [];
        }
        var u: vscode.Uri | undefined;
        if (folder && folder.uri) {
            u = folder.uri;
        } else {
            u = vscode.window.activeTextEditor?.document?.uri
        }
        let result: vscode.DebugConfiguration[] = [];
        const configNames: string[] | null | undefined = await vscode.commands.executeCommand(nbCommands.projectConfigurations, u?.toString());
        if (configNames) {
            let first: boolean = true;
            for (let cn of configNames) {
                let cname: string;

                if (first) {
                    // ignore the default config, comes first.
                    first = false;
                    continue;
                } else {
                    cname = "Launch Java: " + cn;
                }
                const debugConfig: vscode.DebugConfiguration = {
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

    async doProvideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined, context: ExtensionContext, commandValues: Map<string, string>, _token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration[]> {
        let c: LanguageClient = await globalState.getClientPromise().client;
        if (!folder) {
            return [];
        }
        let result: vscode.DebugConfiguration[] = [];
        const attachConnectors: DebugConnector[] | null | undefined = await vscode.commands.executeCommand(extCommands.attachDebuggerConfigurations);
        if (attachConnectors) {
            for (let ac of attachConnectors) {
                const debugConfig: vscode.DebugConfiguration = {
                    name: ac.name,
                    type: ac.type,
                    request: "attach",
                };
                for (let i = 0; i < ac.arguments.length; i++) {
                    let defaultValue: string = ac.defaultValues[i];
                    if (!defaultValue.startsWith("${command:")) {
                        // Create a command that asks for the argument value:
                        let cmd: string = `${extCommands.attachDebuggerConnector}.${ac.id}.${ac.arguments[i]}`;
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

class RunConfigurationProvider implements vscode.DebugConfigurationProvider {

    resolveDebugConfiguration(_folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, _token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {
        return new Promise<vscode.DebugConfiguration>(resolve => {
            resolve(config);
        });
    }

    resolveDebugConfigurationWithSubstitutedVariables?(_folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, _token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {
        return new Promise<vscode.DebugConfiguration>(resolve => {
            const args = argumentsNode.getValue();
            if (args) {
                if (!config.args) {
                    config.args = args;
                } else {
                    config.args = `${config.args} ${args}`;
                }
            }

            const vmArgs = vmOptionsNode.getValue();
            if (vmArgs) {
                if (!config.vmArgs) {
                    config.vmArgs = vmArgs;
                } else {
                    config.vmArgs = `${config.vmArgs} ${vmArgs}`;
                }
            }

            const env = environmentVariablesNode.getValue();
            if (env) {
                const envs = env.split(',');
                if (!config.env) {
                    config.env = {};
                }
                for (let val of envs) {
                    val = val.trim();
                    const div = val.indexOf('=');
                    if (div > 0) { // div === 0 means bad format (no ENV name)
                        config.env[val.substring(0, div)] = val.substring(div + 1, val.length);
                    }
                }
            }

            const cwd = workingDirectoryNode.getValue();
            if (cwd) {
                config.cwd = cwd;
            }

            resolve(config);
        });
    }

}
