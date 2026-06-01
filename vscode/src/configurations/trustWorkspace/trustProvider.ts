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

import { Uri, workspace, WorkspaceFolder, WorkspaceFoldersChangeEvent } from "vscode";
import { getAllConfigurationKeys } from "../handlers";
import { CacheService } from "../../telemetry/types";
import { LOGGER } from "../../logger";
import { ExtensionContextInfo } from "../../extensionContextInfo";
import { globalState } from "../../globalState";
import { l10n } from "../../localiser";
import { TrustUi } from "./trustUi";
import { WorkspaceSettingsTrustCacheValue } from "../../telemetry/impl/cache/workspaceSettingsTrustCacheValue";
import { SettingLocationTrustDecision, TRUST_TYPE, SettingLocation, TrustType } from "./types";


export class TrustProvider {
    private static readonly BASE_EMPTY_KEY = "";
    private trustUi: TrustUi;

    constructor(private cacheService: CacheService<WorkspaceSettingsTrustCacheValue, string>) {
        this.trustUi = new TrustUi();
    }

    public registerListeners = (context: ExtensionContextInfo): void => {
        context.pushSubscription(workspace.onDidChangeWorkspaceFolders(this.onChangeWorkspaceHandler));
    }

    public checkTrust = async (): Promise<void> => {
        await this.handleWorkspaceFoldersTrustStatus(this.getWorkspaceFoldersTrustStatus());
    }

    public showTrustFailureErrorMessage = async (): Promise<void> => {
        await this.trustUi.showTrustFailureErrorMessage();
    }

    public showWorkspaceSettingsTrust = async (): Promise<void> => {
        const workspaceFoldersWithSettings = this.getWorkspaceFoldersSettingsFile(this.getWorkspaceFoldersTrustStatus(), getAllConfigurationKeys());
        const selectedWorkspaceFolders = await this.trustUi.showWorkspaceSettingsTrust(workspaceFoldersWithSettings);
        if (!selectedWorkspaceFolders) {
            return;
        }

        await this.updateTrustSettingsSelection(workspaceFoldersWithSettings, selectedWorkspaceFolders);
        if (selectedWorkspaceFolders.length == workspaceFoldersWithSettings.length) {
            await this.trustUi.showReloadPrompt();
            return;
        }

        await this.stopExtension();
    }

    private onChangeWorkspaceHandler = async (event: WorkspaceFoldersChangeEvent): Promise<void> => {
        try {
            await this.handleWorkspaceFoldersTrustStatus(this.getFolderTrustStatus(event.added));
        } catch (err) {
            LOGGER.error(`Java extension stopped because workspace trust failed after adding a folder: ${(err as Error).message}`);
            await this.stopExtension();
        }
    }

    private handleWorkspaceFoldersTrustStatus = async (settingsLocationTrustStatus: SettingLocationTrustDecision[]): Promise<void> => {
        if (!settingsLocationTrustStatus?.length) {
            return;
        }

        if (settingsLocationTrustStatus.some(settingsLocation => settingsLocation.isUserInputAvailable && !settingsLocation.isTrusted)) {
            LOGGER.log("Untrusted workspace folders found");
            throw new Error(l10n.value("jdk.extension.trust.error_msg.rejected"));
        }

        if (settingsLocationTrustStatus.every(settingsLocation => settingsLocation.isUserInputAvailable && settingsLocation.isTrusted)) {
            LOGGER.log("All workspace folders are trusted.");
            return;
        }

        const workspaceFoldersForPopUp = this.getWorkspaceFoldersForPopUp(settingsLocationTrustStatus);
        if (!workspaceFoldersForPopUp.length) {
            LOGGER.log("Settings file not found in the untrusted workspace folders, so skipping pop-up");
            return;
        }

        const trustType = await this.trustUi.requestTrust(workspaceFoldersForPopUp);
        await this.updateWorkspaceFoldersTrustDecision(workspaceFoldersForPopUp, trustType);
        if (trustType == TRUST_TYPE.NOT_TRUSTED) {
            throw new Error(l10n.value("jdk.extension.trust.error_msg.rejected"));
        }
    }

    private getWorkspaceFoldersTrustStatus = (): SettingLocationTrustDecision[] => {
        const settingsLocationTrustStatus: SettingLocationTrustDecision[] = [];

        const workspaceLevelUri = workspace.workspaceFile;
        if (workspaceLevelUri) {
            settingsLocationTrustStatus.push(this.getWorkspaceFolderTrustStatus(workspaceLevelUri, SettingLocation.WORKSPACE_FILE));
        }

        const { workspaceFolders } = workspace;
        if (workspaceFolders) {
            settingsLocationTrustStatus.push(...this.getFolderTrustStatus(workspaceFolders));
        }

        return settingsLocationTrustStatus;
    }

    private getFolderTrustStatus = (folders: readonly WorkspaceFolder[]): SettingLocationTrustDecision[] => {
        return folders.map(folder => this.getWorkspaceFolderTrustStatus(folder.uri, SettingLocation.FOLDER));
    }

    private getWorkspaceFolderTrustStatus = (uri: Uri, type: SettingLocation): SettingLocationTrustDecision => {
        const trustStatus = this.cacheService.get(uri.toString());
        return {
            uri,
            type,
            isUserInputAvailable: trustStatus != undefined,
            isTrusted: trustStatus == TRUST_TYPE.TRUSTED
        };
    }

    private getWorkspaceFoldersForPopUp = (settingLocationTrustDecisions: SettingLocationTrustDecision[]): SettingLocationTrustDecision[] => {
        const workspaceFoldersWithoutUserInput = settingLocationTrustDecisions.filter(folder => !folder.isUserInputAvailable);
        if (!workspaceFoldersWithoutUserInput.length) {
            return [];
        }

        return this.getWorkspaceFoldersSettingsFile(workspaceFoldersWithoutUserInput, getAllConfigurationKeys());
    }

    private updateWorkspaceFoldersTrustDecision = async (settingLocationTrustDecisions: SettingLocationTrustDecision[], trustType: TrustType): Promise<void> => {
        await Promise.all(settingLocationTrustDecisions.map(decision => this.cacheService.put(decision.uri.toString(), new WorkspaceSettingsTrustCacheValue(trustType))));
    }

    private updateTrustSettingsSelection = async (settingLocationTrustDecisions: SettingLocationTrustDecision[], trustedWorkspaceFolders: SettingLocationTrustDecision[]): Promise<void> => {
        const trustedWorkspaceFolderUris = new Set(trustedWorkspaceFolders.map(folder => folder.uri.toString()));
        await Promise.all(settingLocationTrustDecisions.map(decision => this.cacheService.put(
            decision.uri.toString(),
            new WorkspaceSettingsTrustCacheValue(trustedWorkspaceFolderUris.has(decision.uri.toString()) ? TRUST_TYPE.TRUSTED : TRUST_TYPE.NOT_TRUSTED)            
        )));
    }

    private getWorkspaceFoldersSettingsFile = (settingLocationTrustDecisions: SettingLocationTrustDecision[], keys: string[]): SettingLocationTrustDecision[] => {
        let isConfigPresentAtWorkspaceLevel = false;
        const workspaceFoldersWithSettingsFile: SettingLocationTrustDecision[] = [];
        const workspaceFile = settingLocationTrustDecisions.find(decision => decision.type == SettingLocation.WORKSPACE_FILE);
        const folderResources = new Map<string, SettingLocationTrustDecision>(
            settingLocationTrustDecisions
                .filter(decision => decision.type == SettingLocation.FOLDER)
                .map(decision => [decision.uri.toString(), decision])
        );

        for (const key of keys) {
            if (workspaceFile && !isConfigPresentAtWorkspaceLevel) {
                isConfigPresentAtWorkspaceLevel = this.hasWorkspaceLevelConfiguration(key);
                if (isConfigPresentAtWorkspaceLevel) {
                    workspaceFoldersWithSettingsFile.push(workspaceFile);
                }
            }

            for (const [folderUriKey, folderResource] of folderResources) {
                if (this.hasWorkspaceFolderConfiguration(key, folderResource.uri)) {
                    workspaceFoldersWithSettingsFile.push(folderResource);
                    folderResources.delete(folderUriKey);
                }
            }

            if (isConfigPresentAtWorkspaceLevel && folderResources.size == 0) {
                break;
            }
        }

        return workspaceFoldersWithSettingsFile;
    }

    private hasWorkspaceLevelConfiguration = (key: string): boolean => {
        return workspace.getConfiguration(TrustProvider.BASE_EMPTY_KEY).inspect(key)?.workspaceValue != undefined;
    }

    private hasWorkspaceFolderConfiguration = (key: string, folderUri: Uri): boolean => {
        return workspace.getConfiguration(TrustProvider.BASE_EMPTY_KEY, folderUri).inspect(key)?.workspaceFolderValue != undefined;
    }

    private stopExtension = async (): Promise<void> => {
        try {
            await globalState.getClientPromise().stopClient();
            globalState.setDeactivated(true);
            await globalState.getNbProcessManager()?.killProcess(false);
        } catch (stopErr) {
            LOGGER.error(`Failed to stop Java extension after workspace trust failure: ${(stopErr as Error).message}`);
        } finally {
            await this.trustUi.showTrustFailureErrorMessage();
        }
    }

}
