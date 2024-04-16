/*
  Copyright (c) 2023, Oracle and/or its affiliates.

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

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import axios from 'axios';
import * as https from 'https';
import * as child_process from 'child_process';
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { OPEN_JDK_VERSION_DOWNLOAD_LINKS, ORACLE_JDK_BASE_DOWNLOAD_URL, ORACLE_JDK_DOWNLOAD_VERSIONS } from './constants';
import { handleLog } from './extension';
import { promisify } from 'util';

let customView: vscode.WebviewPanel;
let logger: vscode.OutputChannel;

export const calculateChecksum = async (filePath: string): Promise<string> => {
  const ALGORITHM = 'sha256';
  const hash = crypto.createHash(ALGORITHM);
  const pipeline = promisify(require('stream').pipeline);
  const readStream = fs.createReadStream(filePath);

  await pipeline(
    readStream,
    hash
  );

  const checksum = hash.digest('hex');
  return checksum;
}

export const fetchDropdownOptions = async () => {

  // Detect OS of the machine
  const osTypeNode = os.type();
  let osType: string;

  if (osTypeNode === "Linux") {
    osType = "linux";
  }
  else if (osTypeNode === "Darwin") {
    osType = "macOS";
  }
  else {
    osType = "windows";
  }

  // Detect architecture of the machine
  const machineArchNode = os.arch();
  let machineArch: string;
  if (machineArchNode === "arm64") {
    machineArch = "aarch64";
  }
  else {
    machineArch = "x64";
  }

  // Fetch version of the JDK available
  const versions = ORACLE_JDK_DOWNLOAD_VERSIONS;

  return { machineArch, osType, versions };
}

export async function openJDKSelectionView(log: vscode.OutputChannel) {

  // Create JDK Downloader view
  customView = vscode.window.createWebviewPanel(
    'jdkDownloader',
    'JDK Downloader',
    vscode.ViewColumn.One,
    {
      enableScripts: true
    }
  );
  logger = log;
  const { machineArch, osType, versions } = await fetchDropdownOptions();
  customView.webview.html = fetchJDKDownloadView(machineArch, osType, versions);

  customView.webview.onDidReceiveMessage(async message => {
    const { command, id: jdkType, jdkVersion, jdkOS, jdkArch, installType } = message;

    if (command === 'downloadJDK') {
      const installationPath = await selectPath(installType);
      if (installationPath) {
        if (installType === 'manual') {
          vscode.workspace.getConfiguration('jdk').update('jdkhome', installationPath, true);
          await installationCompletion(installType);
          return;
        }

        vscode.window.showInformationMessage(`Downloading and completing setup of ${jdkType} ${jdkVersion}...`);
        JDKDownloader(jdkType, jdkOS, jdkArch, jdkVersion, installationPath);
      }
    }
  });
}

export function JDKDownloader(JDKType: string, osType: string, osArchitecture: string, JDKVersion: string, installationPath: string): void {
  let downloadUrl: string = '';

  // Generate download url on the basis of the jdk type chosen
  if (JDKType === 'OpenJDK') {
    if (osType === 'windows') {
      downloadUrl = `${OPEN_JDK_VERSION_DOWNLOAD_LINKS[`${JDKVersion}`]}_${osType.toLowerCase()}-${osArchitecture}_bin.zip`;
    }
    else {
      downloadUrl = `${OPEN_JDK_VERSION_DOWNLOAD_LINKS[`${JDKVersion}`]}_${osType.toLowerCase()}-${osArchitecture}_bin.tar.gz`;
    }
  }
  else if (JDKType === 'Oracle JDK') {
    if (osType === 'windows') {
      downloadUrl = `${ORACLE_JDK_BASE_DOWNLOAD_URL}/${JDKVersion}/latest/jdk-${JDKVersion}_${osType.toLowerCase()}-${osArchitecture}_bin.zip`;
    }
    else {
      downloadUrl = `${ORACLE_JDK_BASE_DOWNLOAD_URL}/${JDKVersion}/latest/jdk-${JDKVersion}_${osType.toLowerCase()}-${osArchitecture}_bin.tar.gz`;
    }
  }

  // Define the target directory and file name
  const targetDirectory = path.join(__dirname, 'jdk_downloads');
  let fileName = '';
  if (osType === 'windows') {
    fileName = `${JDKType}-${JDKVersion}_${osType}-${osArchitecture}_bin.zip`;
  }
  else {
    fileName = `${JDKType}-${JDKVersion}_${osType}-${osArchitecture}_bin.tar.gz`;
  }

  // Create the target directory if it doesn't exist
  if (!fs.existsSync(targetDirectory)) {
    fs.mkdirSync(targetDirectory);
  }

  // Define the target file path
  const filePath = path.join(targetDirectory, fileName);

  // Downloading the file using https modules
  const request = https.get(downloadUrl, response => {
    if (response.statusCode !== 200) {
      vscode.window.showErrorMessage(`HTTP Error ${response.statusCode} - ${response.statusMessage}`);
      return;
    }

    const writeStream = fs.createWriteStream(filePath);
    response.pipe(writeStream);

    writeStream.on('finish', async () => {
      const checkSumObtained = await calculateChecksum(filePath);
      const checkSumExpected = (await axios.get(`${downloadUrl}.sha256`)).data;
      if (checkSumExpected === checkSumObtained) {
        vscode.window.showInformationMessage(`${JDKType} ${JDKVersion} for ${osType} download completed!`);
        await extractJDK(filePath, installationPath, JDKVersion, osType, JDKType);
      }
      else {
        handleLog(logger, `Checksums don't match! \n Expected: ${checkSumExpected} \n Obtained: ${checkSumObtained}`);
        vscode.window.showErrorMessage(`"${JDKType} ${JDKVersion} for ${osType} download failed, wrong checksum."`);
      }
    });

    writeStream.on('error', error => {
      vscode.window.showErrorMessage('Error while saving the file:' + error);
    });
  });

  request.on('error', error => {
    vscode.window.showErrorMessage('Error while downloading the : ' + JDKType + ' ' + error);
  });

  request.end();
}

export async function extractJDK(jdkTarballPath: string, extractionTarget: string, jdkVersion: string, osType: string, jdkType: string): Promise<void> {
  const downloadedDir = path.join(__dirname, 'jdk_downloads');

  // Remove already present version of a particular JDK from temp dir
  const oldDirs = await fs.promises.readdir(downloadedDir);
  const matchingOldDirs = oldDirs.filter(file => file.startsWith(`jdk-${jdkVersion}`));
  for await (const oldDirName of matchingOldDirs) {
    await fs.promises.rmdir(path.join(downloadedDir, oldDirName), { recursive: true });
  }

  // Extract jdk binaries in a temp folder
  const extractCommand = `tar -xzf "${jdkTarballPath}" -C ${downloadedDir}`;
  let tempDirectoryPath: string | null = null;
  let newDirectoryPath: string | null = null;

  child_process.exec(extractCommand, async (error) => {
    if (error) {
      vscode.window.showErrorMessage('Error: ' + error);
    } else {
      const dirsPresent = await fs.promises.readdir(downloadedDir);
      const matchingJdkDir = dirsPresent.filter(file => file.startsWith(`jdk-${jdkVersion}`));
      const tempDirName = matchingJdkDir[0] || "";
      tempDirectoryPath = path.join(downloadedDir, tempDirName);
      // If directory with same name is present in the user selected download location then ask user if they want to delete it or not? 
      const newDirName = `${jdkType.split(' ').join('_')}-${jdkVersion}`;
      newDirectoryPath = await handleJdkPaths(newDirName, extractionTarget, osType);
      if (newDirectoryPath === null) {
        vscode.window.showInformationMessage(`Cannot install ${jdkType} ${jdkVersion}. Cannot delete ${newDirName}`);
      } else {
        // If user agrees for deleting the directory then delete it and move the temp directory to the user selected location
        await fs.promises.rename(tempDirectoryPath, newDirectoryPath);

        let binPath = newDirectoryPath;
        if (osType === 'macOS') {
          binPath = path.join(newDirectoryPath, 'Contents', 'Home');
        }
        vscode.workspace.getConfiguration('jdk').update('jdkhome', binPath, true);
      }
    }

    fs.unlink(jdkTarballPath, async (err) => {
      if (err) {
        vscode.window.showErrorMessage("Error: " + err);
      } else {
        if (tempDirectoryPath && fs.existsSync(tempDirectoryPath)) {
          await fs.promises.rmdir(tempDirectoryPath, { recursive: true });
        }
        if (newDirectoryPath !== null) {
          await installationCompletion("automatic");
        }
      }
    });
  });
}

const handleJdkPaths = async (directoryName: string, parentPath: string, osType: string): Promise<string | null> => {
  let name = directoryName;
  if (osType === 'macOS') {
    name = `${directoryName}.jdk`;
  }
  const directoryPath = path.join(parentPath, name);
  if (fs.existsSync(directoryPath)) {
    const CONFIRMATION_MESSAGE = `${name} is already present. Do you want to delete it and create with new contents?`;
    const selected = await vscode.window.showInformationMessage(CONFIRMATION_MESSAGE, "Yes", "No");
    if (selected === "Yes") {
      await fs.promises.rmdir(directoryPath, { recursive: true });
    }
    else if (selected === "No") {
      return null;
    }
  }

  return directoryPath;
}

const selectPath = async (installType: string): Promise<string | null> => {
  const options: vscode.OpenDialogOptions = {
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: installType === 'manual' ? 'Select installed JDK' : 'Install in selected location'
  };

  const selectedFolders = await vscode.window.showOpenDialog(options);

  if (selectedFolders && selectedFolders.length > 0) {
    const selectedFolder = selectedFolders[0];
    return selectedFolder.fsPath;
  } else {
    vscode.window.showInformationMessage('No location selected.');
    return null;
  }
}

const installationCompletion = async (installType: string) => {
  let dialogBoxMessage: string;
  if (installType === "automatic") {
    dialogBoxMessage = `Completed installing JDK. Please reload Visual Studio Code to enable it.`;
  } else {
    dialogBoxMessage = `Added JDK Path to the configuration settings. Please reload Visual Studio Code to enable it.`;
  }
  const selected = await vscode.window.showInformationMessage(dialogBoxMessage, "Reload now");
  if (selected === "Reload now") {
    await customView.dispose();
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}

export const fetchJDKDownloadView = (machineArch: string, osType: string, versions: Array<String>): string => {
  return `<!DOCTYPE html>
  <head>
    <title>JDK Downloader</title>
  </head>
  <style>
    .select-jdk {
      background-color: #007ACC;
      border: none;
      color: white;
      padding: 0.9em 1.8em;
      text-align: center;
      text-decoration: none;
      display: inline-block;
      font-size: 0.9em;
      cursor: pointer;
      margin: 0px 1em;
    }
  
    .active {
      background-color: #3399FF;
    }
  
    .select-jdk:hover {
      background-color: #3399FF;
    }
  
    select {
      appearance: none;
      border: 0;
      box-shadow: none;
      flex: 1;
      padding: 0 1em;
      color: #fff;
      background-color: #333337;
      cursor: pointer;
    }
  
    select::-ms-expand {
      display: none;
    }
  
    select:focus {
      outline: none;
    }
  
    .jdk-version-dropdown {
      position: relative;
      display: flex;
      width: 15em;
      height: 3em;
      border-radius: 0.25em;
      overflow: hidden;
      margin-top: 0.75em;
    }
  
    .jdk-version-dropdown::after {
      content: '\u25BC';
      position: absolute;
      top: 0;
      right: 0;
      padding: 1em;
      background-color: #333337;
      color: #999999;
      transition: 0.25s all ease;
      pointer-events: none;
    }
  
    .jdk-version-dropdown:hover::after {
      color: #656565;
    }
  
    .jdk-version-container {
      display: none;
      justify-content: space-around;
      flex-wrap: wrap;
      margin: 2em 1em;
    }
  
    .jdk-version-label {
      font-size: 1em;
    }
  
    .jdk-confirm-button {
      margin: 2em auto 0 33%;
    }
  
    .jdk-flex-basis {
      flex-basis: 33%;
    }

    .margin-one {
      margin: 1em;
    }

    .display-flex {
      display: flex;
    }

    .button-height {
      height: 100%;
    }

    .margin-or {
      margin-top: 0.6em;
      margin-right: 0.5em;  
    }
  </style>
  <body>
    <h1>JDK Downloader</h1>
    <p>This tool enables you to download either the latest Oracle Java SE JDK with <a href="https://www.java.com/freeuselicense"> Oracle No-Fee Terms and Conditions</a> or the Oracle OpenJDK builds under the <a href="https://openjdk.org/legal/gplv2+ce.html">GNU Public License with ClassPath Exception</a>.
    It will then handle the installation and configuration on your behalf.</p>
    <p>This enables you to take full advantage of all the features offered by this extension.</p>
    <br>
    <button id="oracleJDK" class="select-jdk">Download Oracle Java SE JDK</button>
    OR 
    <button id="openJDK" class="select-jdk">Download Oracle OpenJDK</button> 
    OR 
    <button id="addJDKPathManually" class="select-jdk">Select installed JDK from my system</button>
    <br>
    <br>
    <div class="jdk-version-container" id="oracleJDKDiv">
      <div class="jdk-flex-basis">
        <label class="jdk-version-label">Select Oracle Java SE Version</label>
        <br />
        <div class="jdk-version-dropdown">
          <select id="oracleJDKVersionDropdown">
          ${versions.map((el, index) => {
    if (index === 0) {
      return `<option value=${el} default>JDK ${el}</option>`
    }
    return `<option value=${el}>JDK ${el}</option>`
  })}
          </select>
        </div>
      </div>
      <div class="jdk-flex-basis">
        <label class="jdk-version-label">Detected OS</label>
        <br />
        <div class="jdk-version-dropdown">
          <select id="oracleJDKOsTypeDropdown">
            <option value="windows" ${osType === 'windows' ? 'selected' : null}>Microsoft Windows</option>
            <option value="macOS" ${osType === 'macOS' ? 'selected' : null}>macOS</option>
            <option value="linux" ${osType === 'linux' ? 'selected' : null}>Linux</option>
          </select>
        </div>
      </div>
      <div class="jdk-flex-basis">
        <label class="jdk-version-label">Detected Machine Architecture</label>
        <br />
        <div class="jdk-version-dropdown">
          <select id="oracleJDKMachineArchDropdown">
            <option value="aarch64" ${machineArch === 'aarch64' ? 'selected' : null}>arm64</option>
            <option value="x64" ${machineArch === 'x64' ? 'selected' : null}>x64</option>
          </select>
        </div>
      </div>
      <div class="jdk-confirm-button">
        <button id="oracleJDKDownloadButton" class="select-jdk">Install and start setup</button>
      </div>
    </div>
    <div class="jdk-version-container" id="openJDKDiv">
      <div class="jdk-flex-basis">
        <label class="jdk-version-label">Select Oracle OpenJDK Version</label>
        <br />
        <div class="jdk-version-dropdown">
          <select id="openJDKVersionDropdown">
            ${Object.keys(OPEN_JDK_VERSION_DOWNLOAD_LINKS).map((el, index) => {
    if (index === 0) {
      return `<option value=${el} default>JDK ${el}</option>`
    }
    return `<option value=${el}>JDK ${el}</option>`
  })}
          </select>
        </div>
      </div>
      <div class="jdk-flex-basis">
        <label class="jdk-version-label">Detected OS</label>
        <br />
        <div class="jdk-version-dropdown">
          <select id="openJDKOsTypeDropdown">
            <option value="windows" ${osType === 'windows' ? 'selected' : null}>Microsoft Windows</option>
            <option value="macOS" ${osType === 'macOS' ? 'selected' : null}>macOS</option>
            <option value="linux" ${osType === 'linux' ? 'selected' : null}>Linux</option>
          </select>
        </div>
      </div>
      <div class="jdk-flex-basis">
        <label class="jdk-version-label">Detected Machine Architecture</label>
        <br />
        <div class="jdk-version-dropdown">
          <select id="openJDKMachineArchDropdown">
            <option value="aarch64" ${machineArch === 'aarch64' ? 'selected' : null}>arm64</option>
            <option value="x64" ${machineArch === 'x64' ? 'selected' : null}>x64</option>
          </select>
        </div>
      </div>
      <div class="jdk-confirm-button">
        <button id="openJDKDownloadButton" class="select-jdk">Install and start setup</button>
      </div>
    </div>
  </body>
  <script>
    const vscode = acquireVsCodeApi();
    const openJDKButton = document.getElementById("openJDK");
    const oracleJDKButton = document.getElementById("oracleJDK");
    const addJDKPathManuallyButton = document.getElementById("addJDKPathManually");
    const openJDKDownloadButton = document.getElementById("openJDKDownloadButton");
    const oracleJDKDownloadButton = document.getElementById("oracleJDKDownloadButton");
    openJDKButton?.addEventListener('click', event => {
      hideOrDisplayDivs(event);
    });
    oracleJDKButton?.addEventListener('click', event => {
      hideOrDisplayDivs(event);
    });
    addJDKPathManually?.addEventListener('click', event => {
      vscode.postMessage({
        command: 'downloadJDK',
        installType: 'manual',
      });
    });
    openJDKDownloadButton?.addEventListener('click', event => {
      triggerJDKDownload(event);
    });
    oracleJDKDownloadButton?.addEventListener('click', event => {
      triggerJDKDownload(event);
    });
    const hideOrDisplayDivs = (e) => {
      const {
        id
      } = e.target;
      const openJdkDiv = document.getElementById('openJDKDiv');
      const oracleJdkDiv = document.getElementById('oracleJDKDiv');
      if (id === 'openJDK') {
        openJdkDiv.style.display = openJdkDiv.style.display === 'flex' ? 'none' : 'flex';
        oracleJdkDiv.style.display = 'none';
        if (openJdkDiv.style.display === 'flex') {
          openJDKButton.classList.add("active");
          oracleJDKButton.classList.remove("active");
        } else {
          openJDKButton.classList.remove("active");
        }
      } else if (id === 'oracleJDK') {
        oracleJdkDiv.style.display = oracleJdkDiv.style.display === 'flex' ? 'none' : 'flex';
        openJdkDiv.style.display = 'none';
        if (oracleJdkDiv.style.display === 'flex') {
          oracleJDKButton.classList.add("active");
          openJDKButton.classList.remove("active");
        } else {
          oracleJDKButton.classList.remove("active");
        }
      }
    };
    const triggerJDKDownload = (e) => {
      const {
        id
      } = e.target;
      const openJdkVersionDropdown = document.getElementById('openJDKVersionDropdown');
      const oracleJdkVersionDropdown = document.getElementById('oracleJDKVersionDropdown');
      const openJdkOsTypeDropdown = document.getElementById('openJDKOsTypeDropdown');
      const oracleJdkOsTypeDropdown = document.getElementById('oracleJDKOsTypeDropdown');
      const openJdkMachineArchDropdown = document.getElementById('openJDKMachineArchDropdown');
      const oracleJdkMachineArchDropdown = document.getElementById('oracleJDKMachineArchDropdown');
      const jdkVersion = id === "openJDKDownloadButton" ? openJdkVersionDropdown.value : oracleJdkVersionDropdown.value;
      const jdkOS = id === "openJDKDownloadButton" ? openJdkOsTypeDropdown.value : oracleJdkOsTypeDropdown.value;
      const jdkArch = id === "openJDKDownloadButton" ? openJdkMachineArchDropdown.value : oracleJdkMachineArchDropdown.value;
      const jdkType = id === "openJDKDownloadButton" ? "OpenJDK" : "Oracle JDK";
      vscode.postMessage({
        command: 'downloadJDK',
        id: jdkType,
        jdkVersion,
        jdkOS,
        jdkArch
      });
    }`
}
