/*
  Copyright (c) 2023-2026, Oracle and/or its affiliates.

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

import { jdkDownloaderConstants } from '../../constants';
import { ViewColumn, WebviewPanel, window } from 'vscode';
import * as os from 'os';
import { JdkDownloaderAction } from './action';
import { downloaderCss } from './styles';
import { l10n } from '../../localiser';
import { LOGGER } from '../../logger';
import { httpsGet, isError, isString } from '../../utils';

export class JdkDownloaderView {
    public static readonly DOWNLOAD_CMD = 'downloadJDK';
    public static readonly JDK_TYPE = {
        oracleJdk: "oracleJdk",
        openJdk: "openJdk"
    }

    public static getJdkLabel = (id: string): string => {
        const key = "jdk.downloader.label." + id;
        const label = l10n.value(key);
        return label !== key ? label : id;
    }

    private readonly jdkDownloaderTitle = l10n.value("jdk.downloader.heading");

    private jdkDownloaderWebView?: WebviewPanel;
    private osType?: string;
    private machineArch?: string;
    private oracleJdkVersions: string[] = [];

    public createView = async () => {
        try {
            LOGGER.log("Creating JDK downloader webview");
            this.jdkDownloaderWebView = window.createWebviewPanel(
                'jdkDownloader',
                this.jdkDownloaderTitle,
                ViewColumn.One,
                {
                    enableScripts: true,
                    enableCommandUris: true
                }
            );
            this.oracleJdkVersions = await this.getOracleJdkVersions();
            this.setDropdownOptions();
            this.jdkDownloaderWebView.webview.html = this.fetchJdkDownloadViewHtml();
            this.jdkDownloaderWebView.webview.onDidReceiveMessage(message => {
                const jdkDownloader = new JdkDownloaderAction();
                jdkDownloader.invokeListener(message);
            });
            LOGGER.log("JDK downloader webview created successfully");
        } catch (err: any) {
            LOGGER.error("Error creating JDK downloader webview:");
            LOGGER.error(err?.message || "No Error message received");
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
        LOGGER.log(`OS identified: ${this.osType}`);

        const machineArchNode = os.arch();
        if (machineArchNode === "arm64") {
            this.machineArch = "aarch64";
        }
        else {
            this.machineArch = "x64";
        }
        LOGGER.log(`Machine architecture identified: ${this.machineArch}`);
    }

    private fetchJdkDownloadViewHtml = (): string => {
        return `<!DOCTYPE html>
        <head>
            <meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1"/>
            <title>${this.jdkDownloaderTitle}</title>
            <style>
            ${downloaderCss}
            </style>
        </head>
        <body>
            <main class="page">
                <h1>${this.jdkDownloaderTitle}</h1>
                <p class="sub">
                    ${l10n.value("jdk.downloader.html.summary")}
                </p>
                <br>
                <section class="panel" aria-label="Download panel">
                    <div class="lead">
                        ${l10n.value("jdk.downloader.html.details")}
                    </div>
                    <button id="latestDownloadButton" class="jdk-confirm-button" type="button" aria-label="Download Latest Oracle JDK">
                        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M5 20h14v-2H5v2zm7-18c-.6 0-1 .4-1 1v8.6l-2.3-2.3-1.4 1.4 4.7 4.7 4.7-4.7-1.4-1.4-2.3 2.3V3c0-.6-.4-1-1-1z"/>
                        </svg>
                        ${l10n.value("jdk.downloader.button.label.latestOracleJdk")}
                    </button>

                    <!-- Other options: DETAILS accordion -->
                    <details class="other-options">
                        <summary class="other-options__summary">
                            <h3>${l10n.value("jdk.downloader.label.otherOptions")}</h3>
                        </summary>

                        <div class="other-options__body">
                            <div class="detected">
                                <span>${l10n.value("jdk.downloader.label.selectedOsArch")}: <span id="selectedOs">${this.getDefaultOsLabel()}</span> + <span id="selectedArch">${this.getDefaultMachineArchLabel()}</span></span>

                                <!-- Change: nested DETAILS -->
                                <details class="change">
                                <summary class="change__summary">(${l10n.value("jdk.downloader.label.changeOsArch")})</summary>

                                <div class="change__body">
                                    <div class="row">
                                    <div>
                                        <div class="jdk-version-label">${l10n.value("jdk.downloader.label.selectOs")}</div>
                                        <div class="jdk-version-dropdown">
                                        <select id="osTypeDropdown" class="select" aria-label="Select OS">
                                            ${this.getOsTypeHtml()}
                                        </select>
                                        </div>
                                    </div>

                                    <div>
                                        <div class="jdk-version-label">${l10n.value("jdk.downloader.label.selectMachineArchitecture")}</div>
                                        <div class="jdk-version-dropdown">
                                        <select id="machineArchDropdown" class="select" aria-label="Select machine architecture">
                                            ${this.getMachineArchHtml()}
                                        </select>
                                        </div>
                                    </div>
                                    </div>
                                </div>
                                </details>
                            </div>

                            <fieldset aria-label="JDK type">
                                <div class="choices">
                                <label class="choice">
                                    <input id="oracleJdk" type="radio" name="jdkType" value="${JdkDownloaderView.JDK_TYPE.oracleJdk}" checked/>
                                    ${l10n.value("jdk.downloader.label.oracleJdk")}
                                </label>

                                <label class="choice">
                                    <input id="openJdk" type="radio" name="jdkType" value="${JdkDownloaderView.JDK_TYPE.openJdk}"/>
                                    ${l10n.value("jdk.downloader.label.openJdk")}
                                </label>
                                </div>
                                <p class="license openJdk-license">
                                    ${l10n.value("jdk.downloader.html.license.openJdk")}
                                </p>

                                <div class="bottom-row">
                                    <div class="oracleJdk-control" id="oracleJdkDiv">
                                        <div class="jdk-version-container">
                                            <label for="oracleJdkVersionDropdown" class="jdk-version-label">${l10n.value("jdk.downloader.label.selectOracleJdkVersion")}</label>
                                            <div class="jdk-version-dropdown">
                                            <select class="select" id="oracleJdkVersionDropdown" name="oracleJdkVersionDropdown">
                                                ${this.getJdkVersionsHtml(this.oracleJdkVersions)}
                                            </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="openJdk-control" id="openJdkDiv">
                                        <div class="jdk-version-container">
                                            <label for="openJdkVersionDropdown" class="jdk-version-label">${l10n.value("jdk.downloader.label.selectOpenJdkVersion")}</label>
                                            <div class="jdk-version-dropdown">
                                            <select class="select" id="openJdkVersionDropdown" name="openJdkVersionDropdown">
                                                ${this.getJdkVersionsHtml(Object.keys(jdkDownloaderConstants.OPEN_JDK_VERSION_DOWNLOAD_LINKS))}
                                            </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </fieldset>

                            <button id="otherOptionsDownloadButton" class="jdk-confirm-button" type="button" aria-label="Download selected JDK">
                                <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M5 20h14v-2H5v2zm7-18c-.6 0-1 .4-1 1v8.6l-2.3-2.3-1.4 1.4 4.7 4.7 4.7-4.7-1.4-1.4-2.3 2.3V3c0-.6-.4-1-1-1z"/>
                                </svg>
                                ${l10n.value("jdk.downloader.button.label.selectedJdk")}
                            </button>
                        </div>
                    </details>
                </section>
                <div class="spacer" aria-hidden="true"></div>
                <p class="footer">
                    ${l10n.value("jdk.downloader.html.footnote")}
                </p>
            </main>
        </body>
        <script>
        ${this.getScriptJs()}
        </script>
      </html>
    `
    }

    private getOracleJdkVersions = async (): Promise<string[]> => {
        try {
            LOGGER.log("Fetching Oracle JDK versions...");
            const availableVersions = await httpsGet(`${jdkDownloaderConstants.ORACLE_JDK_RELEASES_BASE_URL}?licenseType=NFTC&sortBy=jdkVersion&sortOrder=DESC`);
            if (isString(availableVersions)) {
                const availableVersionsObj = JSON.parse(availableVersions);
                if (availableVersionsObj?.items) {
                    const jdkVersions = availableVersionsObj?.items?.
                        map((version: any) => String(version.jdkDetails.jdkVersion).
                        replace(/[^a-zA-Z0-9_.+-]/g,"")).
                        sort((a: string, b: string) => Number(parseInt(b, 10)) - Number(parseInt(a, 10)));
                    LOGGER.log(`Fetched Oracle JDK versions: ${jdkVersions}`);

                    return jdkVersions;
                }
            }
            LOGGER.warn(`Response of Oracle JDK versions is not as expected`);
        } catch (error) {
            const msg = `Some error occurred while fetching Oracle JDK versions: ${isError(error) ? error.message : null}`;
            LOGGER.warn(msg);
        }
        
        return jdkDownloaderConstants.ORACLE_JDK_FALLBACK_VESIONS;
    }

    private getJdkVersionsHtml = (jdkVersions: string[]) => {
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

    private getDefaultOs = () => {
        return this.osType;
    }

    private getDefaultMachineArch = () => {
        return this.osType === 'windows' ? 'x64' : this.machineArch;
    }

    private getDefaultOsLabel = () => {
        return this.osType === 'windows' ? l10n.value("jdk.downloader.label.windows") :
            this.osType === 'macOS' ? l10n.value("jdk.downloader.label.mac") :
            this.osType === 'linux' ? l10n.value("jdk.downloader.label.linux") :
            this.osType;
    }

    private getDefaultMachineArchLabel = () => {
        return this.osType === 'windows' ? "x64" :
            this.machineArch === 'aarch64' ? "arm64" :
            this.machineArch === 'x64' ? "x64" :
            this.machineArch;
    }

    private getOsTypeHtml = () => {
        return `<option value="windows" ${this.osType === 'windows' ? 'selected' : null}>${l10n.value("jdk.downloader.label.windows")}</option>
                <option value="macOS" ${this.osType === 'macOS' ? 'selected' : null}>${l10n.value("jdk.downloader.label.mac")}</option>
                <option value="linux" ${this.osType === 'linux' ? 'selected' : null}>${l10n.value("jdk.downloader.label.linux")}</option>`
    }

    private getMachineArchHtml = () => {
        if (this.osType === 'windows') {
            return `<option value="x64" selected>x64</option>`;
        } else {
            return `<option value="aarch64" ${this.machineArch === 'aarch64' ? 'selected' : null}>arm64</option>
                    <option value="x64" ${this.machineArch === 'x64' ? 'selected' : null}>x64</option>`;
        }
    }

    private getScriptJs = () => {
        return `const vscode = acquireVsCodeApi();
                document.getElementById("latestDownloadButton")?.addEventListener('click', event => {
                    triggerJDKDownload(event);
                });

                document.getElementById("otherOptionsDownloadButton")?.addEventListener('click', event => {
                    triggerJDKDownload(event);
                });

                document.getElementById("osTypeDropdown")?.addEventListener('change', (event) => {
                    syncSelectedOs(event.target);
                    updateMachineArchOptions(event.target);
                });

                document.getElementById("machineArchDropdown")?.addEventListener('change', (event) => {
                    syncSelectedArch(event.target);
                });

                function syncSelectedOs(osDropdown) {
                    const selectedOs = document.getElementById("selectedOs");
                    selectedOs.textContent = osDropdown.selectedOptions[0].textContent;
                }

                function syncSelectedArch(archDropdown) {
                    const selectedArch = document.getElementById("selectedArch");
                    selectedArch.textContent = archDropdown.selectedOptions[0].textContent;
                }

                const updateMachineArchOptions = (osDropdown) => {
                    const machineArchDropdown = document.getElementById("machineArchDropdown");

                    if (osDropdown.value === 'windows') {
                        machineArchDropdown.innerHTML = '<option value="x64" selected>x64</option>';
                    } else {
                        machineArchDropdown.innerHTML = \`
                            <option value="aarch64" \${machineArchDropdown.value === 'aarch64' ? 'selected' : null}>arm64</option>
                            <option value="x64" \${machineArchDropdown.value === 'x64' ? 'selected' : null}>x64</option>
                        \`;
                    }
                    syncSelectedArch(machineArchDropdown);
                };

                const triggerJDKDownload = (e) => {
                    const downloadLatest = e.target.id === 'latestDownloadButton';
                    const jdkTypeSelected = document.querySelector('input[name="jdkType"]:checked')?.value;
                    const jdkType = downloadLatest || !jdkTypeSelected ? "${JdkDownloaderView.JDK_TYPE.oracleJdk}" : jdkTypeSelected;
                    const os = downloadLatest ? "${this.getDefaultOs()}" : document.getElementById('osTypeDropdown').value;
                    const arch = downloadLatest ? "${this.getDefaultMachineArch()}" : document.getElementById('machineArchDropdown').value;
                    const version = downloadLatest ? "${this.oracleJdkVersions.at(0)}" : document.getElementById(jdkType + 'VersionDropdown').value;
                    vscode.postMessage({
                        command: "${JdkDownloaderView.DOWNLOAD_CMD}",
                        id: jdkType,
                        installType: "${JdkDownloaderAction.AUTO_INSTALLATION_TYPE}",
                        jdkVersion: version,
                        jdkOS: os,
                        jdkArch: arch
                    });
                }
                `
    }

}