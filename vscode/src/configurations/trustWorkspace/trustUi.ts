/*
  Copyright (c) 2026, Oracle and/or its affiliates.

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

import { commands, Uri, window, workspace } from "vscode";
import { builtInCommands, extCommands } from "../../commands/commands";
import { l10n } from "../../localiser";
import { vscodeConfigConstants } from "../constants";
import { SettingLocationTrustDecision, TrustType, TRUST_TYPE, TrustQuickPickItem, SettingLocation } from "./types";

export class TrustUi {

    public requestTrust = async (workspaceFoldersForPopUp: SettingLocationTrustDecision[], showAsModal: boolean = true): Promise<TrustType> => {
        const reviewSettingsAction = l10n.value("jdk.extension.trust.label.reviewSettings");
        const yesAction = l10n.value("jdk.downloader.message.confirmation.yes");
        const noAction = l10n.value("jdk.downloader.message.confirmation.no");
        const selectedAction = await window.showWarningMessage(
            l10n.value("jdk.extension.trust.message.confirmWorkspaceSettings"),
            { modal: showAsModal },
            reviewSettingsAction,
            yesAction,
            noAction
        );

        switch (selectedAction) {
            case reviewSettingsAction:
                await this.openSettingsFiles(workspaceFoldersForPopUp);
                return this.requestTrust(workspaceFoldersForPopUp, false);
            case yesAction:
                return TRUST_TYPE.TRUSTED;
            default:
                return TRUST_TYPE.NOT_TRUSTED;
        }
    }

    public showTrustFailureErrorMessage = async (): Promise<void> => {
        const openWorkspaceTrustSettings = l10n.value("jdk.extension.trust.label.openWorkspaceSettingsTrustDecisions");
        const selectedAction = await window.showErrorMessage(l10n.value("jdk.extension.trust.error_msg.activationStopped"), openWorkspaceTrustSettings);
        if (selectedAction == openWorkspaceTrustSettings) {
            await commands.executeCommand(extCommands.workspaceSettingsTrustDecisions);
        }
    }

    public showWorkspaceSettingsTrust = async (settingLocationTrustDecisions: SettingLocationTrustDecision[]): Promise<SettingLocationTrustDecision[] | undefined> => {
        const items = settingLocationTrustDecisions.map(decision => this.createTrustQuickPickItem(decision));
        if (!items.length) {
            await window.showInformationMessage(l10n.value("jdk.extension.trust.message.noWorkspaceSettingsTrustDecisions"));
            return undefined;
        }

        const quickPick = window.createQuickPick<TrustQuickPickItem>();
        quickPick.title = l10n.value("jdk.extension.trust.quickPick.title");
        quickPick.placeholder = l10n.value("jdk.extension.trust.quickPick.placeholder");
        quickPick.canSelectMany = true;
        quickPick.items = items;
        quickPick.selectedItems = items.filter(item => item.resource.isTrusted);
        quickPick.ignoreFocusOut = true;

        return new Promise(resolve => {
            let accepted = false;
            quickPick.onDidAccept(() => {
                accepted = true;
                const selectedWorkspaceFolders = quickPick.selectedItems.map(item => item.resource);
                quickPick.hide();
                resolve(selectedWorkspaceFolders);
            });

            quickPick.onDidHide(() => {
                quickPick.dispose();
                if (!accepted) {
                    resolve(undefined);
                }
            });

            quickPick.show();
        });
    }

    private openSettingsFiles = async (settingLocationTrustDecisions: SettingLocationTrustDecision[]): Promise<void> => {
        for (const folder of settingLocationTrustDecisions) {
            const settingsUri = this.getSettingsUri(folder);
            const document = await workspace.openTextDocument(settingsUri);
            await window.showTextDocument(document, { preview: false });
        }
    }

    private getSettingsUri = (settingLocationTrustDecision: SettingLocationTrustDecision): Uri => {
        if (settingLocationTrustDecision.type == SettingLocation.WORKSPACE_FILE) {
            return settingLocationTrustDecision.uri;
        }

        return Uri.joinPath(
            settingLocationTrustDecision.uri,
            vscodeConfigConstants.VSCODE_WORKSPACE_CONFIG_FOLDER,
            vscodeConfigConstants.VSCODE_CONFIG_FILE_NAME
        );
    }

    public showReloadPrompt = async (): Promise<void> => {
        const reloadNow = l10n.value("jdk.downloader.message.reload");
        const selected = await window.showInformationMessage(l10n.value("jdk.configChanged"), reloadNow);
        if (selected === reloadNow) {
            await commands.executeCommand(builtInCommands.reloadWindow);
        }
    }

    private createTrustQuickPickItem = (settingLocationTrustDecision: SettingLocationTrustDecision): TrustQuickPickItem => {
        return {
            label: this.getWorkspaceFolderSettingsLabel(settingLocationTrustDecision),
            description: settingLocationTrustDecision.isTrusted ? l10n.value("jdk.extension.trust.label.trusted") : l10n.value("jdk.extension.trust.label.notTrusted"),
            detail: settingLocationTrustDecision.uri.fsPath || settingLocationTrustDecision.uri.toString(),
            resource: settingLocationTrustDecision
        };
    }

    private getWorkspaceFolderSettingsLabel = (settingLocationTrustDecision: SettingLocationTrustDecision): string => {
        if (settingLocationTrustDecision.type == SettingLocation.WORKSPACE_FILE) {
            return l10n.value("jdk.extension.trust.label.workspaceFile");
        }

        const folder = workspace.getWorkspaceFolder(settingLocationTrustDecision.uri);
        return folder?.name || settingLocationTrustDecision.uri.fsPath || settingLocationTrustDecision.uri.toString();
    }
}
