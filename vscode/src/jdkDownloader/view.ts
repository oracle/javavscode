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

import { OPEN_JDK_VERSION_DOWNLOAD_LINKS, ORACLE_JDK_DOWNLOAD_VERSIONS } from '../constants';
import { OutputChannel, Uri, ViewColumn, WebviewPanel, window } from 'vscode';
import * as os from 'os';
import { JdkDownloaderAction } from './action';
import { downloaderCss } from './styles';
import { l10n } from '../localiser';

export class JdkDownloaderView {
    public static readonly OPEN_JDK_LABEL = "OpenJDK";
    public static readonly ORACLE_JDK_LABEL = "Oracle JDK";
    public static readonly DOWNLOAD_CMD_LABEL = 'downloadJDK';
    private readonly jdkDownloaderTitle = l10n.value("jdk.downloader.heading");

    private jdkDownloaderWebView?: WebviewPanel;
    private osType?: string;
    private machineArch?: string;

    constructor(
        private readonly logger: OutputChannel
    ) { }

    public createView = () => {
        try {
            this.logger.appendLine("Creating JDK downloader webview");
            this.jdkDownloaderWebView = window.createWebviewPanel(
                'jdkDownloader',
                this.jdkDownloaderTitle,
                ViewColumn.One,
                {
                    enableScripts: true
                }
            );
            this.setDropdownOptions();
            this.jdkDownloaderWebView.webview.html = this.fetchJdkDownloadViewHtml();
            this.jdkDownloaderWebView.webview.onDidReceiveMessage(message => {
                const jdkDownloader = new JdkDownloaderAction(this.logger, this);
                jdkDownloader.attachListener(message);
            });
            this.logger.appendLine("JDK downloader webview created successfully");
        } catch (err: any) {
            this.logger.appendLine("Error creating JDK downloader webview:")
            this.logger.appendLine(err?.message || "No Error message received");
            window.showErrorMessage(l10n.value("jdk.downloader.error_message.errorLoadingPage"));
        }
    }

    public disposeView = async () => {
        await this.jdkDownloaderWebView?.dispose();
    }

    private setDropdownOptions = async () => {
        const osTypeNode = os.type();
        switch (osTypeNode) {
            case "Linux":
                this.osType = "linux";
                break;
            case "Darwin":
                this.osType = "macOS";
                break;
            default:
                this.osType = "windows";
                break;
        }
        this.logger.appendLine(`OS identified: ${this.osType}`);

        const machineArchNode = os.arch();
        if (machineArchNode === "arm64") {
            this.machineArch = "aarch64";
        }
        else {
            this.machineArch = "x64";
        }
        this.logger.appendLine(`Machine architecture identified: ${this.machineArch}`);
    }

    private fetchJdkDownloadViewHtml = (): string => {
        return `<!DOCTYPE html>
        <head>
            <title>${this.jdkDownloaderTitle}</title>
            <style>
            ${downloaderCss}
            </style>
        </head>
        <body>
            <h1>${this.jdkDownloaderTitle}</h1>
            ${l10n.value("jdk.downloader.html.details")}
            <br>
            <button id="oracleJDK" class="select-jdk">${l10n.value("jdk.downloader.button.label.oracleJdk")}</button>
            ${l10n.value("jdk.downloader.label.or")}
            <button id="openJDK" class="select-jdk">${l10n.value("jdk.downloader.button.label.openJdk")}</button> 
            ${l10n.value("jdk.downloader.label.or")}
            <button id="addJDKPathManually" class="select-jdk">${l10n.value("jdk.downloader.button.label.selectJdkFromSystem")}</button>
            <br>
            <br>
            <div class="jdk-version-container" id="oracleJDKDiv">
            <div class="jdk-flex-basis">
                <label class="jdk-version-label">${l10n.value("jdk.downloader.label.selectOracleJdkVersion")}</label>
                <br />
                <div class="jdk-version-dropdown">
                <select id="oracleJDKVersionDropdown">
                    ${this.getJdkVersionsHtml(ORACLE_JDK_DOWNLOAD_VERSIONS)}
                </select>
                </div>
            </div>
            <div class="jdk-flex-basis">
                <label class="jdk-version-label">${l10n.value("jdk.downloader.label.detectedOs")}</label>
                <br />
                <div class="jdk-version-dropdown">
                <select id="oracleJDKOsTypeDropdown">
                    ${this.getOsTypeHtml()}
                </select>
                </div>
            </div>
            <div class="jdk-flex-basis">
                <label class="jdk-version-label">${l10n.value("jdk.downloader.label.detectedMachineArchitecture")}</label>
                <br />
                <div class="jdk-version-dropdown">
                <select id="oracleJDKMachineArchDropdown">
                    ${this.getMachineArchHtml()}
                </select>
                </div>
            </div>
            <div class="jdk-confirm-button">
                <button id="oracleJDKDownloadButton" class="select-jdk">${l10n.value("jdk.downloader.button.label.downloadAndInstall")}</button>
            </div>
            </div>
            <div class="jdk-version-container" id="openJDKDiv">
            <div class="jdk-flex-basis">
                <label class="jdk-version-label">${l10n.value("jdk.downloader.label.selectOpenJdkVersion")}</label>
                <br />
                <div class="jdk-version-dropdown">
                <select id="openJDKVersionDropdown">
                    ${this.getJdkVersionsHtml(Object.keys(OPEN_JDK_VERSION_DOWNLOAD_LINKS))}
                </select>
                </div>
            </div>
            <div class="jdk-flex-basis">
                <label class="jdk-version-label">${l10n.value("jdk.downloader.label.detectedOs")}</label>
                <br />
                <div class="jdk-version-dropdown">
                <select id="openJDKOsTypeDropdown">
                    ${this.getOsTypeHtml()}
                </select>
                </div>
            </div>
            <div class="jdk-flex-basis">
                <label class="jdk-version-label">${l10n.value("jdk.downloader.label.detectedMachineArchitecture")}</label>
                <br />
                <div class="jdk-version-dropdown">
                <select id="openJDKMachineArchDropdown">
                    ${this.getMachineArchHtml()}
                </select>
                </div>
            </div>
            <div class="jdk-confirm-button">
                <button id="openJDKDownloadButton" class="select-jdk">${l10n.value("jdk.downloader.button.label.downloadAndInstall")}</button>
            </div>
            </div>
        </body>
        <script>
        ${this.getScriptJs()}
        </script>
      </html>
    `
    }

    private getJdkVersionsHtml = (jdkVersions: String[]) => {
        let htmlStr = "";
        jdkVersions.forEach((el: String, index: number) => {
            if (index === 0) {
                htmlStr += `<option value=${el} default>JDK ${el}</option>\n`;
            }
            else {
                htmlStr += `<option value=${el}>JDK ${el}</option>\n`;
            }
        });

        return htmlStr;
    }

    private getOsTypeHtml = () => {
        return `<option value="windows" ${this.osType === 'windows' ? 'selected' : null}>${l10n.value("jdk.downloader.label.windows")}</option>
                <option value="macOS" ${this.osType === 'macOS' ? 'selected' : null}>${l10n.value("jdk.downloader.label.mac")}</option>
                <option value="linux" ${this.osType === 'linux' ? 'selected' : null}>${l10n.value("jdk.downloader.label.linux")}</option>`
    }

    private getMachineArchHtml = () => {
        return `<option value="aarch64" ${this.machineArch === 'aarch64' ? 'selected' : null}>arm64</option>
                <option value="x64" ${this.machineArch === 'x64' ? 'selected' : null}>x64</option>`
    }

    private getScriptJs = () => {
        return `const vscode = acquireVsCodeApi();
                let activeButton = null;
                const oracleJdkButtonId = 'oracleJDK';
                const openJdkButtonId = 'openJDK';

                document.getElementById("openJDK")?.addEventListener('click', event => {
                    hideOrDisplayDivs(event);
                });

                document.getElementById("oracleJDK")?.addEventListener('click', event => {
                    hideOrDisplayDivs(event);
                });

                document.getElementById("addJDKPathManually")?.addEventListener('click', event => {
                    vscode.postMessage({
                        command: "${JdkDownloaderView.DOWNLOAD_CMD_LABEL}",
                        installType: "${JdkDownloaderAction.MANUAL_INSTALLATION_TYPE}",
                    });
                });

                document.getElementById("openJDKDownloadButton")?.addEventListener('click', event => {
                    triggerJDKDownload(event);
                });

                document.getElementById("oracleJDKDownloadButton")?.addEventListener('click', event => {
                    triggerJDKDownload(event);
                });

                const hideOrDisplayDivs = (e) => {
                    const { id } = e.target;
                    if(activeButton){
                        activeButton.classList.remove("active");
                        const activeButtonDiv = document.getElementById(activeButton.id+'Div'); 
                        activeButtonDiv.style.display ='none';
                    }

                    if(activeButton?.id !== id){
                        activeButton = e.target;
                        activeButton.classList.add("active");
                        document.getElementById(id+'Div').style.display ='flex';
                    } else{
                        activeButton = null;
                    }
                };

                const triggerJDKDownload = (e) => {
                    const { id } = e.target;
                    const jdkType = id === openJdkButtonId+'DownloadButton' ? "${JdkDownloaderView.OPEN_JDK_LABEL}" : "${JdkDownloaderView.ORACLE_JDK_LABEL}";
                    vscode.postMessage({
                        command: "${JdkDownloaderView.DOWNLOAD_CMD_LABEL}",
                        id: jdkType,
                        installType: "${JdkDownloaderAction.AUTO_INSTALLATION_TYPE}",
                        jdkVersion: document.getElementById(activeButton.id+'VersionDropdown').value,
                        jdkOS: document.getElementById(activeButton.id+'OsTypeDropdown').value,
                        jdkArch: document.getElementById(activeButton.id+'MachineArchDropdown').value
                    });
                }
                `
    }

}