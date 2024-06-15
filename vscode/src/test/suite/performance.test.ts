
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

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as myExtension from '../../extension';


import { languages, Uri, window } from 'vscode';
import { assertWorkspace, openFile, runShellCommand, waitCommandsReady } from './testutils';

const checkSymbolsResolved = (path: string): boolean => {
    let d = languages.getDiagnostics(Uri.file(path));
    const filterErrorsList = d.filter(el => el.severity == 0);
    console.log("Filtered Errors List Length: " + filterErrorsList.length);
    return filterErrorsList.length == 0;
}

const checkExtensionLoaded = (path: string): boolean => {
    let d = languages.getDiagnostics(Uri.file(path));
    console.log("Diagnostics Length: " + d.length);
    return d.length != 0;
}

const checkIfSymbolsResolved = (path: string) => {
    return new Promise((resolve, reject) => {
        let isTaskCompleted = false;
        let isExtensionLoaded = false;
        const checkInterval = setInterval(() => {
            if(!isExtensionLoaded && checkExtensionLoaded(path)){
                isExtensionLoaded = true;
            }
            if (isExtensionLoaded && checkSymbolsResolved(path)) {
                clearInterval(checkInterval);
                if (!isTaskCompleted) {
                    isTaskCompleted = true;
                    resolve('Symbols resolved');
                }
            }
        }, 100);

        // Set the timeout
        setTimeout(() => {
            if (!isTaskCompleted) {
                isTaskCompleted = true;
                reject(new Error('Symbols did not resolved within the timeout period'));
            }
        }, 10 * 60 * 1000);
    });
}

suite('Perfomance Test Suite', function () {
    window.showInformationMessage('Start performance tests.');
    let folder: string = '';

    this.beforeAll(async () => {
        window.showInformationMessage('Cleaning up workspace.');
        folder = assertWorkspace();
        await fs.promises.rmdir(folder, { recursive: true });
        await fs.promises.mkdir(folder, { recursive: true });
    }).timeout(10000);

    test("OpenJDK perfomance test", async () => {
        const args = ["--depth", 1, "--branch", "jdk-23+25"];
        const gitCmd = `cd ${folder} && git clone ${args.join(' ')} https://github.com/openjdk/jdk.git .`;
        await runShellCommand(gitCmd);

        await waitCommandsReady();
        await myExtension.awaitClient();
        console.log("Extension Loaded");
        
        const p = path.join(folder, "src/jdk.javadoc/share/classes/jdk/javadoc/doclet/StandardDoclet.java");
        assert(fs.existsSync(p), "file doesn't exists");
        await openFile(p);
        
        try {
            const startTime = Date.now();
            await checkIfSymbolsResolved(p);
            const endTime = Date.now() - startTime;
            console.log("END_TIME: " + endTime);
        } catch (err: any) {
            throw new Error("Symbols not resolved");
        }

    }).timeout(3600 * 1000);

});