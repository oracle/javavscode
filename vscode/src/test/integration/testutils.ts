/*
 * Copyright (c) 2023-2025, Oracle and/or its affiliates.
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
import { glob } from 'glob';
import * as Mocha from 'mocha';
import * as path from "path";
import { promisify } from "util";
import { Readable } from "stream";
import { spawn, ChildProcessByStdio, exec } from "child_process";
import * as vscode from "vscode";
import { EXAMPLE_POM, MAIN_JAVA, MAIN_TEST_JAVA, SAMPLE_APP_JAVA, SAMPLE_BUILD_GRADLE, SAMPLE_CODE_FORMAT_DOCUMENT, SAMPLE_CODE_REFACTOR, SAMPLE_CODE_SORT_IMPORTS, SAMPLE_CODE_UNUSED_IMPORTS, SAMPLE_SETTINGS_GRADLE } from "./constants";
import { NbLanguageClient } from "../../lsp/nbLanguageClient";
import { extConstants } from "../../constants";
import { l10n } from "../../localiser";
import { nbCommands } from "../../commands/commands";
import { globalState } from "../../globalState";

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
		timeout: '10m'
	});

	const testsRoot = path.resolve(folder);

	return new Promise(async (c, e) => {
		try {
			const testFilePaths = await glob('**/**.test.js', { cwd: testsRoot })
			
			const sortedTestFilePaths = testFilePaths.sort((a, b) => {
				return path.basename(a).localeCompare(path.basename(b));
			});

			sortedTestFilePaths.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));
			mocha.run(failures => {
				if (failures > 0) {
					e(new Error(`${failures} tests failed.`));
				} else {
					c();
				}
			});
		} catch (error) {
			console.error(error);
			e(error);
		}
	});
}

export const awaitClient = async () : Promise<NbLanguageClient> => {
    const extension = vscode.extensions.getExtension(extConstants.ORACLE_VSCODE_EXTENSION_ID);
    if (!extension) {
        return Promise.reject(new Error(l10n.value("jdk.extension.notInstalled.label")));
    }
    if(extension.isActive){
        return globalState.getClientPromise().client;
    }
    const waitForExtenstionActivation : Thenable<NbLanguageClient> = extension.activate().then(async () => {
        return await globalState.getClientPromise().client;
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

export function getKeysFromJSON(filePath: string): Set<string> {
    return new Set(Object.keys(JSON.parse(fs.readFileSync(filePath, 'utf8'))));
}

export function matchValuesTemplate(jsonFileBase: string, jsonFileTarget: string): boolean {

    if (!matchKeys(jsonFileBase, jsonFileTarget)) {
        console.log("Keys don't match");
        return false;
    }

    var obj1 = JSON.parse(fs.readFileSync(jsonFileBase, 'utf8'));
    var obj2 = JSON.parse(fs.readFileSync(jsonFileTarget, 'utf8'));
    var keys = new Set(Object.keys(obj1));
    var matched: boolean = true;
    for (const key of keys) {

        if (matchTemplate(obj1[key], obj2[key])) {
            continue;
        }
        console.log("Templates of the key " + key + " don't match .'" + obj1[key] + "' and '" + obj2[key] + "' don't match");
        matched = false;
    }
    return matched;
}



export function matchKeys(jsonFilePath1: string, jsonFilePath2: string): boolean {
    return setEqual(getKeysFromJSON(jsonFilePath1), getKeysFromJSON(jsonFilePath2));
}

/**
 * 
 * @param dirPath 
 * @param ignoredDirEntriesNames 
 * @param validKeyValues 
 * @returns number of js files in the directory specified which invoke l10n.value with incorrect key or placeholder map 
 */
export function checkL10nUsageInFiles(dirPath: string, ignoredDirEntriesNames: Set<string>, validKeyValues: any): number {

    let result: number = 0;
    fs.readdirSync(dirPath).forEach(DirEntryName => {
        if (ignoredDirEntriesNames.has(DirEntryName)) return;
        const absPath = path.join(dirPath, DirEntryName);
        const stats = fs.lstatSync(absPath);
        if (stats.isFile() && path.extname(DirEntryName) === ".js") {
            if (
                !(checkL10nUsageInFile(absPath, /l10n.value\("([^"]*)"\)/g, validKeyValues) &&
                    checkL10nUsageInFile(absPath, /l10n.value\('([^']*)'\)/g, validKeyValues) &&
                    checkL10nUsageInFile(absPath, /l10n.value\('([^']*)',\s*\{([^\}]*)\}\s*\)/g, validKeyValues) &&
                    checkL10nUsageInFile(absPath, /l10n.value\("([^"]*)",\s*\{([^\}]*)\}\s*\)/g, validKeyValues)
                )
            ) result++;
        } else if (stats.isDirectory()) {
            result += checkL10nUsageInFiles(absPath, ignoredDirEntriesNames, validKeyValues);
        }
    });
    return result;
}


export function checkConfigurationLocalisation(configuration: any, validKeys: Set<string>): boolean {
    let localized: boolean = true;
    const configPropertiesIds = Object.keys(configuration.properties);
    const propertiesLocalisableFields = ["description", "enumDescriptions"];
    let property: any;
    for (const propertyId of configPropertiesIds) {
        property = configuration.properties[propertyId];
        if (!isLocalizedObj(property, propertiesLocalisableFields, propertyId, "Configuration Property", validKeys)) localized = false;
    }
    return localized;
}

export function checkDebuggersLocalisation(debuggers: any, validKeys: Set<string>): boolean {
    let localized = true;
    const propertiesLocalisableFields = ['description'];
    const configLocalisableFields = ['name'];
    const snippetLocalisableFields = ['label', 'description'];
    for (const debug of debuggers) {
        // check configurationAttributes
        for (const [propName, prop] of Object.entries(debug.configurationAttributes.launch.properties)) {
            if (!isLocalizedObj(prop, propertiesLocalisableFields, propName, "Configuration Attributes : Launch properties ", validKeys)) localized = false;
        }
        // check initialConfigurations
        for (const initConfig of debug.initialConfigurations) {
            if (!isLocalizedObj(initConfig, configLocalisableFields, "", "Initial Configuration", validKeys)) localized = false;
        }
        // check configurationSnippets
        for (const snippet of debug.configurationSnippets) {
            if (!isLocalizedObj(snippet, snippetLocalisableFields, "", "configuration Snippet", validKeys)) localized = false;
        }
    }
    return localized;
}


export function checkViewsLocalisation(views: any, validKeys: Set<string>): boolean {
    let localized: boolean = true;
    const explorer: any = views.explorer;
    const explorerLocalisableFields = ["name", "contextualTitle"];
    for (const obj of explorer) {
        if (!isLocalizedObj(obj, explorerLocalisableFields, obj.id, "explorer", validKeys)) localized = false;
    }
    return localized;
}


export function checkCommandsLocalisation(commands: any, validKeys: Set<string>): boolean {
    const localisableFields = ['title'];
    let localized: boolean = true;
    for (const command of commands) {
        if (!isLocalizedObj(command, localisableFields, command.command, "Command", validKeys)) localized = false;
    }
    return localized;
}


/**
 * 
 * @param str1 
 * @param str2 
 * @returns Checks if the placeholders specified as {placeholder} match for str1 and str2
 */
function matchTemplate(str1: string, str2: string): boolean {
    const regexp = /\{[^\{\}]*\}/g;
    const params1 = new Set([...str1.matchAll(regexp)].map((value) => value[0]));
    const params2 = new Set([...str2.matchAll(regexp)].map((value) => value[0]));
    return setEqual(params1, params2);
}

function setEqual(setA: Set<string>, setB: Set<string>): boolean {
    for (const elem of setA) {
        if (!setB.has(elem)) return false;
    }
    return setA.size === setB.size;
}

/**
 * 
 * @param targetString String containing placeholder in form of {placeholder}
 * @param placeholders Set of required placeholders in the target string 
 * @returns Whether the placeholders present in the targetString and in the placeholders set are same 
 */
function placeholderMatch(targetString: string, placeholders: Set<string>): boolean {
    const regexp = /\{([^\{\}]*)\}/g;
    const params1 = new Set([...targetString.matchAll(regexp)].map((value) => value[1]));
    return setEqual(params1, placeholders);
}



/**
 * 
 * @param dictString String having key value pairs {key1:value1,key2:value2...}
 * @returns Set of keys used in the dictString
 */
function getPlaceholders(dictString: string): Set<string> {
    const placeholders = new Set<string>();
    const cleanedDictString = dictString.replace(/"[^"]*"/g, "SOME_STRING_VALUE").replace(/'[^']*'/g, "SOME_STRING_VALUE");
    for (const keyVal of cleanedDictString.split(',')) {
        // improve this so that if value has key:"," that doesn't get picked up 
        placeholders.add(keyVal.split(':')[0].trim());
    }
    return placeholders;
}

/**
 * 
 * @param filePath 
 * @param pattern To extract the keys and the placeholder map used when calling l10n.value
 * @param validKeyValues From the bundle.en.json filee 
 * @returns All usage of l10n.value according to the pattern is having valid keys and placeholder map
 */
function checkL10nUsageInFile(filePath: string, pattern: RegExp, validKeyValues: any): boolean {
    const fileContent: string = fs.readFileSync(filePath, 'utf8');
    const matches = fileContent.matchAll(pattern);
    const keys = new Set(Object.keys(validKeyValues));
    let result = true;
    for (const matchArr of matches) {
        const context: string = matchArr[0];
        const key: string = matchArr[1];

        const placeholders: undefined | Set<string> = matchArr.length === 3 ? getPlaceholders(matchArr[2]) : undefined;
        if (!keys.has(key)) {
            console.log(`Found invalid localisation key in file:'${filePath.replace(".js", ".ts")}'.Here is the expression used in file with invalid key '${context}'`);
            result = false;
            continue;
        }
        if (placeholders != undefined) {
            if (!placeholderMatch(validKeyValues[key], placeholders)) {
                console.log(placeholders);
                result = false;
                console.log(`Wrong placeholder map for a localisation key  in file:'${filePath.replace(".js", ".ts")}'.Here is the expression used in file with wrong placeholder map '${context}'. Here is the bundle value '${validKeyValues[key]}'`);
            }
        } else {
            if (!matchTemplate("", validKeyValues[key])) {
                result = false;
                console.log(`Placeholder map not provided for a localisation key in file:'${filePath.replace(".js", ".ts")}'.Here is the expression used in file without the placeholder '${context}'. Here is the bundle value '${validKeyValues[key]}'`);
            }
        }
    }
    return result;
}

/**
 * 
 * @param value string to be checked
 * @returns value of the form %key% where key is some string containing alphanumeric characters 
 */
function isLocalizedVal(value: string): boolean {
    return value.length > 2 && value[0] === '%' && value[0] === value[value.length - 1];
}


/**
 * 
 * @param str localised value of the form %key%
 * @returns key 
 */
function getlocalizingKey(str: string): string {
    const length = str.length;
    return str.substring(1, length - 1);
}

/**
 * 
 * @param obj 
 * @param localisableFields Array or Scalar fields which are to be tested for localisation 
 * @param id 
 * @param category 
 * @param validKeys Keys present in the package.nls.json
 * @returns Whether the object given has the required fields localised by some valid key 
 */
function isLocalizedObj(obj: any, localisableFields: any, id: string, category: string, validKeys: Set<string>): boolean {
    let localized: boolean = true;
    let fieldVals: any;
    let localizingKey: string;
    for (const field of localisableFields) {
        fieldVals = obj[field];
        if (fieldVals === undefined) continue;
        if (!Array.isArray(fieldVals)) fieldVals = [fieldVals];
        for (const fieldVal of fieldVals) {
            localizingKey = getlocalizingKey(fieldVal);
            if (!isLocalizedVal(fieldVal)) {
                console.log(`${category} object with id ${id} has a unlocalized field field:'${field}'`);
                localized = false;
            } else if (!validKeys.has(localizingKey)) {
                console.log(`${category} object of id '${id}' has a invalid  localizing key for the field:'${field}' key:'${localizingKey}'`);
                localized = false;
            }
        }
    }
    return localized;
}