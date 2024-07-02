
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
import * as vscode from 'vscode';
import * as myExtension from '../../../extension';
import * as util from 'util';
import * as cp from 'child_process';

/**
 * Folder path currently opened in VSCode workspace 
 * @returns String containing the folder path of the workspace
 */
export function assertWorkspace(): string {
    assert.ok(vscode.workspace, "workspace is defined");
    const dirs = vscode.workspace.workspaceFolders;
    assert.ok(dirs?.length, "There are some workspace folders: " + dirs);
    assert.strictEqual(dirs.length, 1, "One folder provided");
    let folder: string = dirs[0].uri.fsPath;

    return folder;
}


/**
 * Wait till all the commands of the extension are loaded 
 * @returns promise that timeouts till all the commands are loaded
 */
export async function waitCommandsReady(): Promise<void> {
    return new Promise((resolve, reject) => {
        function checkCommands(attempts: number, cb: () => void) {
            try {
                // this command is parameterless
                vscode.commands.executeCommand("jdk.java.attachDebugger.configurations")
                console.log("JDK commands ready.");
                resolve();
            } catch (e) {
                if (attempts > 0) {
                    console.log("Waiting for JDK commands to be registered, " + attempts + " attempts to go...");
                    setTimeout(() => checkCommands(attempts - 1, cb), 100);
                } else {
                    reject(new Error("Timeout waiting for JDK commands registration: " + e));
                }
            }
        }
        myExtension.awaitClient().then(() => checkCommands(5, () => { }));
    });
}

/**
 * Opens a file in VScode workspace 
 * @param filePath 
 * @returns promise that contains instance of the editor opened
 */
export async function openFile(filePath: string): Promise<vscode.TextEditor> {
    const document: vscode.TextDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    await vscode.window.showTextDocument(document);
    const editor = vscode.window.activeTextEditor;
    assert(editor !== undefined, 'editor cannot be initialzed');

    return editor;
}

export const runShellCommand = async (command: string) => {
    console.log(`commaned being executed: ${command}`);
    const exec = util.promisify(cp.exec);
    const { stdout, stderr } = await exec(command);
    console.log(stdout);
    console.error(stderr);
}
