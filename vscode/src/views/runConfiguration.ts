/*
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

import * as vscode from 'vscode';
import { homedir } from 'os';
import { l10n } from '../localiser';
import { getConfigurationValue, updateConfigurationValue } from '../configurations/handlers';
import { configKeys } from '../configurations/configuration';

class RunConfigurationNodeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

	private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null> = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
	readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null> = this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
		if (!element) {
			return [argumentsNode, vmOptionsNode, environmentVariablesNode, workingDirectoryNode];
		}
		return [];
	}

}
export const runConfigurationNodeProvider = new RunConfigurationNodeProvider();

class RunConfigurationNode extends vscode.TreeItem {

	prompt: string;
	hint: string;
	value: string | undefined;

	settingsKey: string;

	constructor(label: string, prompt: string, hint: string, settingsKey: string) {
		super(label);
		this.contextValue = 'configureRunSettings';
		this.collapsibleState = vscode.TreeItemCollapsibleState.None;

		this.prompt = prompt;
		this.hint = hint;

		this.settingsKey = settingsKey;

		this.value = getConfigurationValue(this.settingsKey);
		this.updateNode();
	}

	public configure(_context: vscode.ExtensionContext) {
		vscode.window.showInputBox(
			{
				prompt: this.prompt,
				value: this.value,
				placeHolder: this.hint,
				ignoreFocusOut: true
			}
		).then(async val => {
			if (val !== undefined) {
				const value = val.toString().trim();
				this.setValue(value ? value : undefined);
			}
		});
	}

	public getValue(): string | undefined {
		return this.value;
	}

	setValue(value: string | undefined) {
		this.value = value;
		updateConfigurationValue(this.settingsKey, this.value, vscode.workspace.name || vscode.workspace.workspaceFile ? null : true);
		this.updateNode();
	}

	updateNode(reload?: boolean) {
		if (reload) {
			this.value =  getConfigurationValue(this.settingsKey) as string;
		}
		this.description = this.value ? this.value : l10n.value("jdk.extension.runConfig.default.label");
		this.tooltip = `${this.label} ${this.description}`;
		runConfigurationNodeProvider.refresh();
	}
}

class ArgumentsNode extends RunConfigurationNode {

	constructor() {
		super(l10n.value("jdk.extension.runConfig.arguments.label"), l10n.value("jdk.extension.runConfig.arguments.prompt"), l10n.value("jdk.extension.runConfig.example.label", { data: "foo bar" }), configKeys.runConfigArguments);
	}

}
export const argumentsNode = new ArgumentsNode();

class VMOptionsNode extends RunConfigurationNode {

	constructor() {
		super(l10n.value("jdk.extension.runConfig.vmoptions.label"), l10n.value("jdk.extension.runConfig.vmoptions.prompt"), l10n.value("jdk.extension.runConfig.example.label", { data: "-Xmx512m -Xms256m" }), configKeys.runConfigVmOptions);
	}

}
export const vmOptionsNode = new VMOptionsNode();

class EnvironmentVariablesNode extends RunConfigurationNode {

	constructor() {
		super(l10n.value("jdk.extension.runConfig.env.label"), l10n.value("jdk.extension.runConfig.env.prompt"), l10n.value("jdk.extension.runConfig.example.label", { data: "var1=one, varTwo=2" }), configKeys.runConfigEnv);
	}

}
export const environmentVariablesNode = new EnvironmentVariablesNode();

class WorkingDirectoryNode extends RunConfigurationNode {

	constructor() {
		super(l10n.value("jdk.extension.runConfig.wrkdir.label"), l10n.value("jdk.extension.runConfig.wrkdir.prompt"), WorkingDirectoryNode.getExample(), configKeys.runConfigCwd);
	}

	static getExample(): string {
		const dir = homedir();
		return l10n.value("jdk.extension.runConfig.example.label", { data: dir });
	}

}
export const workingDirectoryNode = new WorkingDirectoryNode();

export function configureRunSettings(context: vscode.ExtensionContext, ...params: any[]) {
	if (params[0][0]) {
		(params[0][0] as RunConfigurationNode).configure(context);
	}
}
export function runConfigurationUpdateAll() {
	argumentsNode.updateNode(true);
	vmOptionsNode.updateNode(true);
	environmentVariablesNode.updateNode(true);
	workingDirectoryNode.updateNode(true);
}
