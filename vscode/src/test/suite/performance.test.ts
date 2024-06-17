
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
import { languages, Uri, window, workspace } from 'vscode';
import { assertWorkspace, openFile, runShellCommand, waitCommandsReady } from './testutils';
import { OPENJDK_CHECK_FILES_RESOLVES } from './constants';

let lastFileSize = 0;
let count = 0;
const checkSymbolsResolved = (path: string): boolean => {
    let d = languages.getDiagnostics(Uri.file(path));
    const filterErrorsList = d.filter(el => el.severity == 0);
    console.log("Filtered Errors List Length: " + filterErrorsList.length);
    return filterErrorsList.length == 0;
}

const checkExtensionLoaded = (path: string): boolean => {
    let d = languages.getDiagnostics(Uri.file(path));
    return d.length != 0;
}

const pollLogFile = (logFilePath: string) => {
    fs.stat(logFilePath, async (err, stats) => {
        if (err) {
            console.error(`Error reading file stats: ${err.message}`);
            return;
        }

        if (stats.size > lastFileSize) {
            fs.createReadStream(logFilePath, {
                start: lastFileSize,
                end: stats.size
            }).on('data', chunk => {
                const matches = chunk.toString().match(/INFO \[[^\]]+\]: \d+ projects opened in \d+/g);
                count += matches?.length || 0;
            });
            lastFileSize = stats.size;
        }
    });
}

const checkIfSymbolsResolved = (path: string, isExtensionLoaded: boolean = false) => {
    return new Promise((resolve, reject) => {
        let isTaskCompleted = false;
        const checkInterval = setInterval(() => {
            if (!isExtensionLoaded && checkExtensionLoaded(path)) {
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

        setTimeout(() => {
            if (!isTaskCompleted) {
                isTaskCompleted = true;
                reject(new Error('Symbols did not resolved within the timeout period'));
            }
        }, 10 * 60 * 1000);
    });
}

const checkIfIndexingCompleted = () => {
    return new Promise((resolve, reject) => {
        let isTaskCompleted = false;
        const checkInterval = setInterval(() => {
            console.log("Number of times opened projects appeared in log file: " + count);
            if (count >= 2) {
                clearInterval(checkInterval);
                if (!isTaskCompleted) {
                    isTaskCompleted = true;
                    resolve('Symbols resolved');
                }
            }
        }, 100);

        setTimeout(() => {
            if (!isTaskCompleted) {
                isTaskCompleted = true;
                reject(new Error(`Indexing didn't complete within the timeout period`));
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

    test("Performance test on OpenJDK repository", async () => {
        const args = ["--depth", 1, "--branch", "jdk-23+25"];
        const gitCmd = `cd ${folder} && git clone ${args.join(' ')} https://github.com/openjdk/jdk.git .`;
        await runShellCommand(gitCmd);

        await myExtension.awaitClient();
        await waitCommandsReady();
        console.log("Extension Loaded");

        try {
            assert(myExtension.extensionContext?.storageUri, "extension context is undefined");
            const logPath = path.join(myExtension.extensionContext.storageUri.fsPath, 'userdir', 'var', 'log', 'messages.log');
            setInterval(() => pollLogFile(logPath), 1000);
            const startTime = Date.now();
            for await (const [idx, f] of OPENJDK_CHECK_FILES_RESOLVES.entries()) {
                const p = path.join(...[folder, ...f.split('/')]);
                assert(fs.existsSync(p), "file doesn't exists");
                console.log(f);
                await openFile(p);
                idx == 0 ? await checkIfSymbolsResolved(p) : await checkIfSymbolsResolved(p, true);
            }

            await checkIfIndexingCompleted();
            const endTime = Date.now() - startTime;
            console.log("END_TIME: " + endTime);

        } catch (err: any) {
            throw new Error("Symbols not resolved");
        }


    }).timeout(3600 * 1000);

});