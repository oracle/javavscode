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

import * as assert from "assert";
import * as fs from "fs";
import * as glob from 'glob';
import * as Mocha from 'mocha';
import * as path from "path";
import { promisify } from "util";
import { Readable } from "stream";
import { spawn, ChildProcessByStdio, exec } from "child_process";
import * as vscode from "vscode";
import { EXAMPLE_POM, MAIN_JAVA, MAIN_TEST_JAVA, SAMPLE_APP_JAVA, SAMPLE_BUILD_GRADLE, SAMPLE_CODE_FORMAT_DOCUMENT, SAMPLE_CODE_REFACTOR, SAMPLE_CODE_SORT_IMPORTS, SAMPLE_CODE_UNUSED_IMPORTS, SAMPLE_SETTINGS_GRADLE } from "./constants";
import { NbLanguageClient } from "../lsp/nbLanguageClient";
import { extConstants } from "../constants";
import { l10n } from "../localiser";
import { globalVars } from "../extension";
import { nbCommands } from "../commands/commands";

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
 * File paths of all the files and folders usd for testing
 * @returns Object containing all the file and folder paths
 */
export function getFilePaths(): { [key: string]: string } {
	let folder: string = assertWorkspace();

	const filePaths: { [key: string]: string } = {};
	filePaths["pkg"] = path.join(folder, "src", "main", "java", "pkg");
	filePaths["testPkg"] = path.join(folder, "src", "test", "java", "pkg");
	filePaths["resources"] = path.join(folder, "src", "main", "resources");

	filePaths["mainJava"] = path.join(filePaths["pkg"], "Main.java");
	filePaths["formatDocument"] = path.join(
		filePaths["pkg"],
		"FormatDocument.java"
	);
	filePaths["sortImports"] = path.join(filePaths["pkg"], "SortImports.java");
	filePaths["unusedImports"] = path.join(
		filePaths["pkg"],
		"UnusedImports.java"
	);
	filePaths["refactorActions"] = path.join(
		filePaths["pkg"],
		"RefactorActions.java"
	);
	filePaths["mainTestJava"] = path.join(filePaths["testPkg"], "MainTest.java");

	filePaths["pom"] = path.join(folder, "pom.xml");

	return filePaths;
}

/**
 * Prepares the sample project for testing
 * @param filePaths
 * @returns promise that waits till all the files and folders are created
 */
export async function prepareProject(filePaths: {
	[key: string]: string;
}): Promise<void> {
	await fs.promises.writeFile(filePaths["pom"], EXAMPLE_POM);

	await fs.promises.mkdir(filePaths["pkg"], { recursive: true });
	await fs.promises.mkdir(filePaths["resources"], { recursive: true });
	await fs.promises.mkdir(filePaths["testPkg"], { recursive: true });

	await fs.promises.writeFile(filePaths["mainJava"], MAIN_JAVA);

	await fs.promises.writeFile(filePaths["mainTestJava"], MAIN_TEST_JAVA);
	await vscode.workspace.saveAll();

	await fs.promises.writeFile(
		filePaths["formatDocument"],
		SAMPLE_CODE_FORMAT_DOCUMENT
	);
	await fs.promises.writeFile(
		filePaths["sortImports"],
		SAMPLE_CODE_SORT_IMPORTS
	);
	await fs.promises.writeFile(
		filePaths["unusedImports"],
		SAMPLE_CODE_UNUSED_IMPORTS
	);
	await fs.promises.writeFile(
		filePaths["refactorActions"],
		SAMPLE_CODE_REFACTOR
	);

	await waitProjectRecognized(filePaths.mainJava);
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
				vscode.commands.executeCommand(
					"jdk.java.attachDebugger.configurations"
				);
				console.log("JDK commands ready.");
				resolve();
			} catch (e) {
				if (attempts > 0) {
					console.log(
						"Waiting for JDK commands to be registered, " +
						attempts +
						" attempts to go..."
					);
					setTimeout(() => checkCommands(attempts - 1, cb), 100);
				} else {
					reject(
						new Error("Timeout waiting for JDK commands registration: " + e)
					);
				}
			}
		}
		awaitClient().then(() => checkCommands(5, () => { }));
	});
}

/**
 * Ensures that the project that holds the parameter file was opened in JDK.
 * @param someJavaFile
 * @returns promise that will be fullfilled after the project opens in JDK.
 */
export async function waitProjectRecognized(someJavaFile: string): Promise<void> {
	return waitCommandsReady().then(() => {
		const u: vscode.Uri = vscode.Uri.file(someJavaFile);
		// clear out possible bad or negative caches.
		return vscode.commands
			.executeCommand(nbCommands.clearProjectCaches)
			.then(
				// this should assure opening the root with the created project.
				() =>
					vscode.commands.executeCommand(
						nbCommands.javaProjectPackages,
						u.toString()
					)
			);
	});
}

/**
 * Replaces code in editor with the provided code
 * @param editor
 * @param code
 * @returns promise that will have replaced code in the editor
 */
export async function replaceCode(
	editor: vscode.TextEditor | undefined,
	code: string
): Promise<void> {
	const doc = editor?.document;
	assert(doc !== undefined, "editor cannot be initialzed");

	const range = new vscode.Range(
		doc.lineAt(0).range.start,
		doc.lineAt(doc.lineCount - 1).range.end
	);

	await editor?.edit((editBuilder) => {
		editBuilder.replace(range, code);
	});
}

/**
 * Opens a file in VScode workspace
 * @param filePath
 * @returns promise that contains instance of the editor opened
 */
export async function openFile(filePath: string): Promise<vscode.TextEditor> {
	const document: vscode.TextDocument = await vscode.workspace.openTextDocument(
		vscode.Uri.file(filePath)
	);
	await vscode.window.showTextDocument(document);
	const editor = vscode.window.activeTextEditor;
	assert(editor !== undefined, "editor cannot be initialzed");

	return editor;
}

/**
 * If some error is encountered in the tests then it dumps java process
 * @returns promise that dumps the java process
 */
export async function dumpJava(): Promise<void> {
	const cmd = "jps";
	const args = ["-v"];
	console.log(`Running: ${cmd} ${args.join(" ")}`);
	let p: ChildProcessByStdio<null, Readable, Readable> = spawn(cmd, args, {
		stdio: ["ignore", "pipe", "pipe"],
	});
	let n = await new Promise<number>((r, e) => {
		p.stdout.on("data", function (d: any) {
			console.log(d.toString());
		});
		p.stderr.on("data", function (d: any) {
			console.log(d.toString());
		});
		p.on("close", function (code: number) {
			r(code);
		});
	});
	console.log(`${cmd} ${args.join(" ")} finished with code ${n}`);
}

export const runShellCommand = async (command: string, folderPath: string) => {
	console.log(`commaned being executed: ${command}`);
	const shellExec = promisify(exec);
	const { stdout, stderr } = await shellExec(command, { cwd: folderPath });
	console.log(stdout);
	console.error(stderr);
};

export async function gradleInitJavaApplication(folder: string) {
	const basePackage = "org.yourCompany.yourProject";

	const projectPath = path.join(folder);
	const srcMainPath = path.join(
		projectPath,
		"src",
		"main",
		"java",
		...basePackage.split(".")
	);
	const resourcesPath = path.join(projectPath, "src", "main", "resources");
	const testPath = path.join(
		projectPath,
		"src",
		"test",
		"java",
		...basePackage.split(".")
	);

	try {
		// Create directories
		await fs.promises.mkdir(projectPath, { recursive: true });
		await fs.promises.mkdir(srcMainPath, { recursive: true });
		await fs.promises.mkdir(resourcesPath, { recursive: true });
		await fs.promises.mkdir(testPath, { recursive: true });

		// Create build.gradle & settings.gradle files
		await fs.promises.writeFile(
			path.join(projectPath, "build.gradle"),
			SAMPLE_BUILD_GRADLE
		);
		await fs.promises.writeFile(
			path.join(projectPath, "settings.gradle"),
			SAMPLE_SETTINGS_GRADLE
		);
		// Create Java main file
		await fs.promises.writeFile(
			path.join(srcMainPath, "App.java"),
			SAMPLE_APP_JAVA
		);

		await waitProjectRecognized(path.join(srcMainPath, "App.java"));

	} catch (error) {
		throw error;
	}
};

export function runTestSuite(folder: string): Promise<void> {
	// Create the mocha test
	const mocha = new Mocha({
		ui: 'tdd',
		color: true,
		timeout: 10*1000*60
	});

	const testsRoot = path.resolve(folder);

	return new Promise((c, e) => {
		glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
			if (err) {
				return e(err);
			}
			// Add files to the test suite
			files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

			try {
				// Run the mocha test
				mocha.run(failures => {
					if (failures > 0) {
						e(new Error(`${failures} tests failed.`));
					} else {
						c();
					}
				});
			} catch (err) {
				console.error(err);
				e(err);
			}
		});
	});
}

export const awaitClient = async () : Promise<NbLanguageClient> => {
    const extension = vscode.extensions.getExtension(extConstants.ORACLE_VSCODE_EXTENSION_ID);
    if (!extension) {
        return Promise.reject(new Error(l10n.value("jdk.extension.notInstalled.label")));
    }
    if(extension.isActive){
        return globalVars.clientPromise.client;
    }
    const waitForExtenstionActivation : Thenable<NbLanguageClient> = extension.activate().then(async () => {
        return await globalVars.clientPromise.client;
    });
    return Promise.resolve(waitForExtenstionActivation);
}

export function findClusters(myPath : string): string[] {
    let clusters = [];
    for (let e of vscode.extensions.all) {
        if (e.extensionPath === myPath) {
            continue;
        }
        const dir = path.join(e.extensionPath, 'nbcode');
        if (!fs.existsSync(dir)) {
            continue;
        }
        const exists = fs.readdirSync(dir);
        for (let clusterName of exists) {
            let clusterPath = path.join(dir, clusterName);
            let clusterModules = path.join(clusterPath, 'config', 'Modules');
            if (!fs.existsSync(clusterModules)) {
                continue;
            }
            let perm = fs.statSync(clusterModules);
            if (perm.isDirectory()) {
                clusters.push(clusterPath);
            }
        }
    }
    return clusters;
}
