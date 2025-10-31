/*
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

import * as vscode from 'vscode';
import * as https from 'https';
import * as fs from 'fs';
import { promisify } from "util";
import * as crypto from 'crypto';
import { l10n } from './localiser';
import { extConstants } from './constants';
import { LOGGER } from './logger';

class InputFlowAction {
	static back = new InputFlowAction();
	static cancel = new InputFlowAction();
	static resume = new InputFlowAction();
}

export type InputStep = (input: MultiStepInput) => Thenable<InputStep | void>;

interface QuickPickParameters<T extends vscode.QuickPickItem> {
	title: string | undefined;
	step: number;
	totalSteps: number;
	items: T[];
	placeholder: string;
	canSelectMany?: boolean;
	selectedItems?: readonly T[];
	buttons?: vscode.QuickInputButton[];
	shouldResume?: () => Thenable<boolean>;
}

interface InputBoxParameters {
	title: string | undefined;
	step: number;
	totalSteps: number;
	value: string;
	prompt: string;
	validate: (value: string) => Promise<string | undefined>;
	password?: boolean;
	buttons?: vscode.QuickInputButton[];
	shouldResume?: () => Thenable<boolean>;
}

export class MultiStepInput {

	static async run(start: InputStep) {
		const input = new MultiStepInput();
		return input.stepThrough(start);
	}

	private current?: vscode.QuickInput;
	private steps: InputStep[] = [];

	private async stepThrough(start: InputStep) {
		let step: InputStep | void = start;
		while (step) {
			this.steps.push(step);
			if (this.current) {
				this.current.enabled = false;
				this.current.busy = true;
			}
			try {
				step = await step(this);
			} catch (err) {
				if (err === InputFlowAction.back) {
					this.steps.pop();
					step = this.steps.pop();
				} else if (err === InputFlowAction.resume) {
					step = this.steps.pop();
				} else if (err === InputFlowAction.cancel) {
					step = undefined;
				} else {
					throw err;
				}
			}
		}
		if (this.current) {
			this.current.dispose();
		}
	}

	async showQuickPick<T extends vscode.QuickPickItem, P extends QuickPickParameters<T>>({ title, step, totalSteps, items, selectedItems, placeholder, canSelectMany, buttons, shouldResume }: P) {
		const disposables: vscode.Disposable[] = [];
		try {
			return await new Promise<readonly T[] | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
				const input = vscode.window.createQuickPick<T>();
				input.title = title;
				input.step = step;
				input.totalSteps = totalSteps;
				input.placeholder = placeholder;
				input.items = items;
				if (canSelectMany) {
					input.canSelectMany = canSelectMany;
				}
				if (selectedItems) {
					input.selectedItems = selectedItems;
				}
				input.buttons = [
					...(this.steps.length > 1 ? [vscode.QuickInputButtons.Back] : []),
					...(buttons || [])
				];
				input.ignoreFocusOut = true;
				disposables.push(
					input.onDidTriggerButton(item => {
						if (item === vscode.QuickInputButtons.Back) {
							reject(InputFlowAction.back);
						} else {
							resolve(<any>item);
						}
					}),
					input.onDidAccept(() => {
						resolve(input.selectedItems);
					}),
					input.onDidHide(() => {
						(async () => {
							reject(shouldResume && await shouldResume() ? InputFlowAction.resume : InputFlowAction.cancel);
						})()
							.catch(reject);
					})
				);
				if (this.current) {
					this.current.dispose();
				}
				this.current = input;
				this.current.show();
			});
		} finally {
			disposables.forEach(d => d.dispose());
		}
	}

	async showInputBox<P extends InputBoxParameters>({ title, step, totalSteps, value, prompt, validate, password, buttons, shouldResume }: P) {
		const disposables: vscode.Disposable[] = [];
		try {
			return await new Promise<string | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
				const input = vscode.window.createInputBox();
				input.title = title;
				input.step = step;
				input.totalSteps = totalSteps;
				input.value = value || '';
				input.prompt = prompt;
				if (password) {
					input.password = password;
				}
				input.buttons = [
					...(this.steps.length > 1 ? [vscode.QuickInputButtons.Back] : []),
					...(buttons || [])
				];
				input.ignoreFocusOut = true;
				// let validating = validate('');
				disposables.push(
					input.onDidTriggerButton(item => {
						if (item === vscode.QuickInputButtons.Back) {
							reject(InputFlowAction.back);
						} else {
							resolve(<any>item);
						}
					}),
					input.onDidAccept(async () => {
						const value = input.value;
						input.enabled = false;
						input.busy = true;
						const validationMessage = await validate(value);
						if (validationMessage) {
							input.validationMessage = validationMessage;
						} else {
							resolve(value);
						}
						input.enabled = true;
						input.busy = false;
					}),
					input.onDidHide(() => {
						(async () => {
							reject(shouldResume && await shouldResume() ? InputFlowAction.resume : InputFlowAction.cancel);
						})()
							.catch(reject);
					})
				);
				if (this.current) {
					this.current.dispose();
				}
				this.current = input;
				this.current.show();
			});
		} finally {
			disposables.forEach(d => d.dispose());
		}
	}
}

export function httpsGet(url: string) {
	return new Promise((resolve, reject) => {
		https.get(url, (res) => {
			if (res.statusCode !== 200) {
				return reject(new Error(l10n.value("jdk.extension.utils.error_message.failedHttpsRequest", {
					url,
					statusCode: res.statusCode
				})));
			}
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				resolve(data);
			});
		}).on('error', (e) => {
			reject(e);
		});
	});
}

export function downloadFileWithProgressBar(downloadUrl: string, downloadLocation: string, message: string) {
	return vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, cancellable: false }, p => {
		return new Promise<void>((resolve, reject) => {
			const file = fs.createWriteStream(downloadLocation);
			https.get(downloadUrl, (response) => {
				if (response.statusCode !== 200) {
					return reject(new Error(l10n.value("jdk.extension.utils.error_message.failedHttpsRequest", {
						url: downloadUrl,
						statusCode: response.statusCode
					})));
				}

				const totalSize = parseInt(response.headers['content-length'] || '0');
				let downloadedSize = 0;
				response.pipe(file);

				response.on('data', (chunk) => {
					downloadedSize += chunk.length;
					if (totalSize) {
						const increment = parseFloat(((chunk.length / totalSize) * 100).toFixed(2));
						const progress = parseFloat(((downloadedSize / totalSize) * 100).toFixed(2));
						p.report({ increment, message: `${message}: ${progress} %` });
					}
				});

				file.on('finish', () => {
					file.close();
					resolve();
				});
			}).on('error', (err) => {
				fs.unlink(downloadLocation, () => reject(err));
			});
		});
	});
}

export const calculateChecksum = async (filePath: string, algorithm: string = 'sha256'): Promise<string> => {
	const hash = crypto.createHash(algorithm);
	const pipeline = promisify(require('stream').pipeline);
	const readStream = fs.createReadStream(filePath);

	await pipeline(
		readStream,
		hash
	);

	const checksum = hash.digest('hex');
	return checksum;
}

export const appendPrefixToCommand = (command: string) => `${extConstants.COMMAND_PREFIX}.${command}`;

export function isString(obj: unknown): obj is string {
	return typeof obj === 'string';
}
export function isError(obj: unknown): obj is Error {
	return obj instanceof Error;
}

export const isObject = (value: any) => value !== null && typeof value === 'object' && !Array.isArray(value);

export async function initializeRunConfiguration(): Promise<boolean> {
	if (vscode.workspace.name || vscode.workspace.workspaceFile) {
		const java = await vscode.workspace.findFiles('**/*.java', '**/node_modules/**', 1);
		if (java?.length > 0) {
			return true;
		}
	} else {
		for (let doc of vscode.workspace.textDocuments) {
			if (doc.fileName?.endsWith(".java")) {
				return true;
			}
		}
	}
	return false;
}

const isQuotes = (c: string): boolean => {
	return c === "'" || c === '"';
}

export const parseArguments = (input: string): string[] => {
	const result: string[] = [];
	let current = "";
	if (input.search(/['"]/) < 0) return input.split(/\s+/);
	for (let i = 0; i < input.length; i++) {
		const char = input[i];
		if (char === " ") {
			result.push(current);
			current = "";
		} else if (isQuotes(char)) {
			const quoteType = char;
			current += char;
			i++;
			let f = true;
			while (i < input.length && f) {
				current += input[i];
				const isEscapingSomethingElse = (i > 1 && input[i - 1] == "\\" && input[i - 2] == "\\");
				if (input[i] === quoteType && input[i - 1] != "\\" && !isEscapingSomethingElse)
					f = false;
				else
					i++;
			}
		} else {
			current += char;
		}
	}
	if (current) {
		result.push(current);
	}

	return result;
}

export namespace FileUtils {
	const FILE_SCHEME = "file:";

	/**
	 * Converts a given file system path or URI-like string into a {@link vscode.Uri} instance.
	 *
	 * This utility attempts to correctly handle both raw file paths and strings that may
	 * already represent a valid file URI.
	 *
	 * ### Behavior
	 * - If `treatAsUriIfPossible` is **true** and the input starts with the `"file:"` scheme:
	 *   - Attempts to parse the input using `vscode.Uri.parse(path, true)`.
	 *   - If parsing fails, logs the error and throws a generic error.
	 * - Otherwise:
	 *   - Treats the input as a standard file system path and returns `vscode.Uri.file(path)`.
	 *
	 * Any unexpected errors during URI creation are logged through the `LOGGER` and
	 * rethrown as a generic error.
	 *
	 * @param {string} path - The input file system path or URI-like string.
	 * @param {boolean} [treatAsUriIfPossible=false] - When `true`, attempts to parse the input as a URI
	 * if it starts with the `"file:"` scheme before falling back to `vscode.Uri.file`.
	 * @returns {vscode.Uri} The resulting {@link vscode.Uri} object.
	 * @throws {Error} When both URI parsing and file wrapping fail.
	 */
	export const toUri = (path: string, treatAsUriIfPossible: boolean = false): vscode.Uri => {
		try {
			if (treatAsUriIfPossible && path.startsWith(FILE_SCHEME)) {
					return vscode.Uri.parse(path, true);
			}
			return vscode.Uri.file(path);
		} catch (err: any) {
			LOGGER.log(`Error while parsing uri: ${isError(err) ? err.message : err}`);
			throw new Error("Error while parsing URI");
		}
	}
}
