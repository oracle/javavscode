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
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { globalVars, LOGGER } from '../extension';
import { TextDocumentFilter } from 'vscode-languageclient';
import { extensions } from 'vscode';
import { extConstants } from '../constants';

export const enableDisableModules = (
    extensionPath: string,
    userDir: string,
    modules: string[],
    enable: boolean) => {
    for (var i = 0; i < modules.length; i++) {
        const module = modules[i];
        const moduleXml: string = module.replace(/\./g, "-") + ".xml";
        var xmlContent: string = "";
        const clusters: string[] = fs.readdirSync(path.join(extensionPath, "nbcode"));
        for (var c = 0; c < clusters.length; c++) {
            const sourceXmlPath: string = path.join(extensionPath, "nbcode", clusters[c], "config", "Modules", moduleXml);
            if (fs.existsSync(sourceXmlPath)) {
                xmlContent = fs.readFileSync(sourceXmlPath).toString();
            }
        }
        xmlContent = xmlContent.replace(`<param name="enabled">${!enable}</param>`, `<param name="enabled">${enable}</param>`);
        fs.mkdirSync(path.join(userDir, "config", "Modules"), { recursive: true });
        fs.writeFileSync(path.join(userDir, "config", "Modules", moduleXml), xmlContent);
    }
}

export const findNbcode = (extensionPath: string): string => {
    let nbcode = os.platform() === 'win32' ?
        os.arch() === 'x64' ? 'nbcode64.exe' : 'nbcode.exe'
        : 'nbcode.sh';
    let nbcodePath = path.join(extensionPath, "nbcode", "bin", nbcode);

    let nbcodePerm = fs.statSync(nbcodePath);
    if (!nbcodePerm.isFile()) {
        throw `Cannot execute ${nbcodePath}`;
    }
    if (os.platform() !== 'win32') {
        fs.chmodSync(path.join(extensionPath, "nbcode", "bin", nbcode), "744");
        fs.chmodSync(path.join(extensionPath, "nbcode", "platform", "lib", "nbexec.sh"), "744");
        fs.chmodSync(path.join(extensionPath, "nbcode", "java", "maven", "bin", "mvn.sh"), "744");
    }
    return nbcodePath;
}

export const restartWithJDKLater = (time: number, notifyKill: boolean): void => {
    LOGGER.log(`Restart of ${extConstants.SERVER_NAME} requested in ${time / 1000} s.`);
    const nbProcessManager = globalVars.nbProcessManager;
    
    setTimeout(() =>  globalVars.clientPromise.restartExtension(nbProcessManager, notifyKill), time);
};