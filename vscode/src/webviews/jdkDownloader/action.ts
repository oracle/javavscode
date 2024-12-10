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

import { commands, OpenDialogOptions, window, workspace } from "vscode";
import { JdkDownloaderView } from "./view";
import { jdkDownloaderConstants } from "../../constants";
import * as path from 'path';
import * as fs from 'fs';
import { calculateChecksum, downloadFileWithProgressBar, httpsGet } from "../../utils";
import * as cp from 'child_process';
import { promisify } from "util";
import { l10n } from "../../localiser";
import { LOGGER } from "../../logger";
import { updateConfigurationValue } from "../../configurations/handlers";
import { configKeys } from "../../configurations/configuration";

export class JdkDownloaderAction {
    public static readonly MANUAL_INSTALLATION_TYPE = "manual";
    public static readonly AUTO_INSTALLATION_TYPE = "automatic";
    private readonly DOWNLOAD_DIR = path.join(__dirname, 'jdk_downloads');

    private jdkType?: string;
    private jdkVersion?: string;
    private osType?: string;
    private machineArch?: string;
    private installType?: string;
    private installationPath?: string | null;
    private downloadFilePath?: string;
    private downloadUrl?: string;

    constructor(private readonly downloaderView: JdkDownloaderView) { }

    public attachListener = async (message: any) => {
        const { command, id, jdkVersion, jdkOS, jdkArch, installType } = message;
        if (command === JdkDownloaderView.DOWNLOAD_CMD_LABEL) {
            LOGGER.log(`Request received for downloading ${id} version ${jdkVersion}`);

            this.jdkType = id;
            this.jdkVersion = jdkVersion;
            this.osType = jdkOS;
            this.machineArch = jdkArch;
            this.installType = installType;
            this.installationPath = await this.getInstallationPathFromUser();

            LOGGER.log(`Parameters set in JDK Downloader: 
                JDK Type: ${this.jdkType}, 
                JDK Version: ${this.jdkVersion}, 
                OS Type: ${this.osType}, 
                Machine Architecture: ${this.machineArch}, 
                Install Type: ${this.installType}, 
                Installation Path: ${this.installationPath}`);

            if (this.installationPath != null) {
                this.startInstallation();
            } else {
                window.showInformationMessage(l10n.value("jdk.downloader.message.noLocationSelected"));
            }
        }
    }

    private getInstallationPathFromUser = async (): Promise<string | null> => {
        const options: OpenDialogOptions = {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: this.installType === JdkDownloaderAction.MANUAL_INSTALLATION_TYPE ?
                l10n.value('jdk.downloader.label.selectJdk') :
                l10n.value("jdk.downloader.label.installJdk")
        };

        const selectedFolders = await window.showOpenDialog(options);

        if (selectedFolders && selectedFolders.length > 0) {
            return selectedFolders[0].fsPath;
        }
        return null;
    }

    private startInstallation = async () => {
        try {
            if (this.installType === JdkDownloaderAction.MANUAL_INSTALLATION_TYPE) {
                updateConfigurationValue(configKeys.jdkHome, this.installationPath, true);
                await this.installationCompletion();

                LOGGER.log(`manual JDK installation completed successfully`);
                return;
            }

            await this.jdkInstallationManager();
        } catch (err: any) {
            window.showErrorMessage(l10n.value("jdk.downloader.error_message.installingJDK", { error: err }));
            LOGGER.error(err?.message || "No Error message received");
        }
    }

    private installationCompletion = async (): Promise<void> => {
        let dialogBoxMessage: string;
        if (this.installType === JdkDownloaderAction.MANUAL_INSTALLATION_TYPE) {
            dialogBoxMessage = l10n.value("jdk.downloader.message.addedJdkPath");
        } else {
            dialogBoxMessage = l10n.value("jdk.downloader.message.completedInstallingJdk");
        }
        LOGGER.log(`JDK installation completed successfully`);

        const reloadNow: string = l10n.value("jdk.downloader.message.reload");
        const selected = await window.showInformationMessage(dialogBoxMessage, reloadNow);
        if (selected === reloadNow) {
            await this.downloaderView.disposeView();
            await commands.executeCommand('workbench.action.reloadWindow');
        }
    }

    private jdkInstallationManager = async () => {
        const startingInstallationMessage = l10n.value("jdk.downloader.message.downloadingAndCompletingSetup", {
            jdkType: this.jdkType,
            jdkVersion: this.jdkVersion
        });

        window.showInformationMessage(startingInstallationMessage);
        this.downloadUrl = this.generateDownloadUrl();
        this.downloadFilePath = this.getDownloadLocation();
        if (!this.downloadUrl || !this.downloadFilePath) {
            throw new Error(l10n.value("jdk.downloader.error_message.generateDownloadUrl"));
        }
        await this.downloadAndVerify();
        const downloadSuccessLabel = l10n.value("jdk.downloader.message.downloadCompleted", {
            jdkType: this.jdkType,
            jdkVersion: this.jdkVersion,
            osType: this.osType
        });
        window.showInformationMessage(downloadSuccessLabel);

        LOGGER.log(`JDK downloaded successfully`);
        LOGGER.log(`JDK installation starting...`);
        await this.rmPreviousMatchingDownloads();

        await this.extractJDK();
    }

    private generateDownloadUrl = (): string => {
        let baseDownloadUrl: string = '';

        if (this.jdkType === JdkDownloaderView.OPEN_JDK_LABEL) {
            baseDownloadUrl = `${jdkDownloaderConstants.OPEN_JDK_VERSION_DOWNLOAD_LINKS[`${this.jdkVersion}`]}_${this.osType!.toLowerCase()}-${this.machineArch}_bin`;
        }
        else if (this.jdkType === JdkDownloaderView.ORACLE_JDK_LABEL) {
            baseDownloadUrl = `${jdkDownloaderConstants.ORACLE_JDK_BASE_DOWNLOAD_URL}/${this.jdkVersion}/latest/jdk-${this.jdkVersion}_${this.osType!.toLowerCase()}-${this.machineArch}_bin`;
        }
        const downloadUrl = this.osType === 'windows' ? `${baseDownloadUrl}.zip` : `${baseDownloadUrl}.tar.gz`;
        LOGGER.log(`Downloading JDK from ${downloadUrl}`);

        return downloadUrl;
    }

    private getDownloadLocation = (): string => {
        const baseFileName = `${this.jdkType}-${this.jdkVersion}_${this.osType}-${this.machineArch}_bin`;
        const newFileName = this.osType === 'windows' ? `${baseFileName}.zip` : `${baseFileName}.tar.gz`;

        if (!fs.existsSync(this.DOWNLOAD_DIR)) {
            fs.mkdirSync(this.DOWNLOAD_DIR);
        }
        const downloadLocation = path.join(this.DOWNLOAD_DIR, newFileName);
        LOGGER.log(`Downloading JDK at ${downloadLocation}`);

        return downloadLocation;
    }

    private downloadAndVerify = async (): Promise<void> => {
        const message = l10n.value("jdk.downloader.message.downloadProgressBar", {
            jdkType: this.jdkType,
            jdkVersion: this.jdkVersion
        });
        await downloadFileWithProgressBar(this.downloadUrl!, this.downloadFilePath!, message);
        LOGGER.log(`JDK downloaded successfully`);

        const doesMatch = await this.checksumMatch();
        if (!doesMatch) {
            const checksumMatchFailedLabel = l10n.value("jdk.downloader.message.downloadFailed", {
                jdkType: this.jdkType,
                jdkVersion: this.jdkVersion,
                osType: this.osType
            });
            throw new Error(checksumMatchFailedLabel);
        }
        LOGGER.log(`Checksum match successful`);
    }

    private checksumMatch = async (): Promise<boolean> => {
        const checkSumObtained = await calculateChecksum(this.downloadFilePath!);
        const checkSumExpected = await httpsGet(`${this.downloadUrl}.sha256`);
        return checkSumExpected === checkSumObtained;
    }

    private rmPreviousMatchingDownloads = async () => {
        const matchingOldDirs = await this.getMatchingDirs(this.jdkVersion!);
        for await (const oldDirName of matchingOldDirs) {
            await fs.promises.rm(path.join(this.DOWNLOAD_DIR, oldDirName), { recursive: true });
        }
    }

    private extractJDK = async (): Promise<void> => {
        LOGGER.log(`Extracting JDK...`);

        const extractCommand = `tar -xzf "${this.downloadFilePath}" -C "${this.DOWNLOAD_DIR}"`;

        const exec = promisify(cp.exec);
        try {
            await exec(extractCommand);
            LOGGER.log(`Extracting JDK successful`);
        } catch (err) {
            LOGGER.error(`Error while extracting JDK: ${(err as Error).message}`);
            throw new Error(l10n.value("jdk.downloader.error_message.extractionError", {
                jdkType: this.jdkType,
                jdkVersion: this.jdkVersion
            }));
        }

        LOGGER.log(`Copying JDK to installation path...`);
        await this.copyJdkAndFinishInstallation();
        LOGGER.log(`Copying JDK to installation path successful`);
    }

    private copyJdkAndFinishInstallation = async () => {
        const matchingJdkDir = await this.getMatchingDirs(this.jdkVersion!);
        if (!matchingJdkDir?.length) {
            throw new Error(l10n.value("jdk.downloader.error_message.findDownloadedJDK", {
                jdkVersion: this.jdkVersion
            }));
        }
        const tempDirectoryPath = path.join(this.DOWNLOAD_DIR, matchingJdkDir[0]);

        // If directory with same name is present in the user selected download location then ask user if they want to delete it or not? 
        const newDirName = `${this.jdkType!.split(' ').join('_')}-${this.jdkVersion}`;
        const newDirectoryPath = await this.handleJdkPaths(newDirName, this.installationPath!, this.osType!);
        if (newDirectoryPath === null) {
            throw new Error(l10n.value('jdk.downloader.error_message.jdkNewDirectoryIssueCannotInstall', {
                jdkType: this.jdkType,
                jdkVersion: this.jdkVersion,
                newDirName
            }));
        }

        // If user agrees for deleting the directory then delete it and move the temp directory to the user selected location
        await fs.promises.rename(tempDirectoryPath, newDirectoryPath);
        LOGGER.log(`Copying extracted JDK at the installation path...`);
        LOGGER.log(`Updating jdk.jdkhome settings...`);

        let binPath = newDirectoryPath;
        if (this.osType === 'macOS') {
            binPath = path.join(newDirectoryPath, 'Contents', 'Home');
        }
        updateConfigurationValue(configKeys.jdkHome, binPath, true);

        LOGGER.log(`Finishing up installation...`);
        this.installationCleanup(tempDirectoryPath, newDirectoryPath);
    }

    private installationCleanup = (tempDirPath: string, newDirPath: string) => {
        fs.unlink(this.downloadFilePath!, async (err) => {
            if (err) {
                LOGGER.error(`Error while installation cleanup: ${err.message}`);
                window.showErrorMessage(l10n.value("jdk.downloader.error_message.installationCleanup"));
            } else {
                if (tempDirPath && fs.existsSync(tempDirPath)) {
                    await fs.promises.rm(tempDirPath, { recursive: true });
                }
                if (newDirPath !== null) {
                    await this.installationCompletion();
                }
            }
        });
    }

    private handleJdkPaths = async (directoryName: string, parentPath: string, osType: string): Promise<string | null> => {
        let name = directoryName;
        if (osType === 'macOS') {
            name = `${directoryName}.jdk`;
        }
        const directoryPath = path.join(parentPath, name);
        if (fs.existsSync(directoryPath)) {
            const CONFIRMATION_MESSAGE = l10n.value("jdk.downloader.message.confirmation.directoryExistsStillWantToDelete", {
                name
            });
            const yesLabel = l10n.value("jdk.downloader.message.confirmation.yes");
            const noLabel = l10n.value("jdk.downloader.message.confirmation.no");
            const selected = await window.showInformationMessage(CONFIRMATION_MESSAGE, yesLabel, noLabel);
            if (selected === yesLabel) {
                await fs.promises.rm(directoryPath, { recursive: true });
            }
            else if (selected === noLabel) {
                return null;
            }
        }

        return directoryPath;
    }

    private getMatchingDirs = async (jdkVersion: string) => {
        const dirs = await fs.promises.readdir(this.DOWNLOAD_DIR);
        const matchingDirs = dirs.filter(file => file.startsWith(`jdk-${jdkVersion}`));

        return matchingDirs;
    }
}