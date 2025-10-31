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

/* This file has been modified for Oracle Java SE extension */

'use strict';

import { commands, debug, tests, workspace, CancellationToken, TestController, TestItem, TestRunProfileKind, TestRunRequest, Uri, TestRun, TestMessage, Location, Position, MarkdownString } from "vscode";
import * as path from 'path';
import { asRange, TestCase, TestSuite } from "../lsp/protocol";
import { extCommands, builtInCommands, nbCommands } from "../commands/commands"
import { extConstants } from "../constants";
import { FileUtils } from "../utils";

export class NbTestAdapter {

    private readonly testController: TestController;
    private disposables: { dispose(): void }[] = [];
    private currentRun: TestRun | undefined;
    private itemsToRun: Set<TestItem> | undefined;
    private started: boolean = false;

    constructor() {
        this.testController = tests.createTestController(extConstants.ORACLE_VSCODE_EXTENSION_ID + '.testController', 'Java');
        const runHandler = (request: TestRunRequest, cancellation: CancellationToken) => this.run(request, cancellation);
        this.testController.createRunProfile('Run Tests', TestRunProfileKind.Run, runHandler);
        this.testController.createRunProfile('Debug Tests', TestRunProfileKind.Debug, runHandler);
        this.disposables.push(this.testController);
        this.load();
    }

    async load(): Promise<void> {
        for (let workspaceFolder of workspace.workspaceFolders || []) {
            const loadedTests: any = await commands.executeCommand(extCommands.loadWorkspaceTests, workspaceFolder.uri.toString());
            if (loadedTests) {
                loadedTests.forEach((suite: TestSuite) => {
                    this.updateTests(suite);
                });
            }
        }
    }

    async run(request: TestRunRequest, cancellation: CancellationToken): Promise<void> {
        if (!this.currentRun) {
            commands.executeCommand(builtInCommands.focusReplDebug);
            cancellation.onCancellationRequested(() => this.cancel());
            this.currentRun = this.testController.createTestRun(request);
            this.itemsToRun = new Set();
            this.started = false;
            if (request.include) {
                const include = [...new Map(request.include.map(item => !item.uri && item.parent?.uri ? [item.parent.id, item.parent] : [item.id, item])).values()];
                for (let item of include) {
                    if (item.uri) {
                        this.set(item, 'enqueued');
                        const idx = item.id.indexOf(':');
                        if (!cancellation.isCancellationRequested) {
                            await commands.executeCommand(request.profile?.kind === TestRunProfileKind.Debug ? extCommands.debugTest : extCommands.runTest, item.uri.toString(), idx < 0 ? undefined : item.id.slice(idx + 1));
                        }
                    }
                }
            } else {
                this.testController.items.forEach(item => this.set(item, 'enqueued'));
                for (let workspaceFolder of workspace.workspaceFolders || []) {
                    if (!cancellation.isCancellationRequested) {
                        await commands.executeCommand(request.profile?.kind === TestRunProfileKind.Debug ? extCommands.projectTestDebug : extCommands.projectTest, workspaceFolder.uri.toString());
                    }
                }
            }
            if (this.started) {
                this.itemsToRun.forEach(item => this.set(item, 'skipped'));
            }
            this.itemsToRun = undefined;
            this.currentRun.end();
            this.currentRun = undefined;
        }
    }

    set(item: TestItem, state: 'enqueued' | 'started' | 'passed' | 'failed' | 'skipped' | 'errored', message?: TestMessage | readonly TestMessage[], noPassDown?: boolean): void {
        if (this.currentRun) {
            switch (state) {
                case 'enqueued':
                    this.itemsToRun?.add(item);
                    this.currentRun.enqueued(item);
                    break;
                case 'started':
                case 'passed':
                case 'skipped':
                    this.itemsToRun?.delete(item);
                    this.currentRun[state](item);
                    break;
                case 'failed':
                case 'errored':
                    this.itemsToRun?.delete(item);
                    this.currentRun[state](item, message || new TestMessage(""));
                    break;
            }
            if (!noPassDown) {
                item.children.forEach(child => this.set(child, state, message, noPassDown));
            }
        }
    }

    cancel(): void {
        debug.stopDebugging();
    }

    dispose(): void {
        this.cancel();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
    }

    testOutput(output: string): void {
        if (this.currentRun && output) {
            this.currentRun.appendOutput(output.replace(/\n/g, '\r\n'));
        }
    }

    testProgress(suite: TestSuite): void {
        const currentSuite = this.testController.items.get(suite.name);
        switch (suite.state) {
            case 'loaded':
                this.updateTests(suite);
                break;
            case 'started':
                this.started = true;
                if (currentSuite) {
                    this.set(currentSuite, 'started');
                }
                break;
            case 'passed':
            case "failed":
            case 'errored':
            case 'skipped':
                if (suite.tests) {
                    this.updateTests(suite, true);
                    if (currentSuite) {
                        const suiteMessages: TestMessage[] = [];
                        suite.tests?.forEach(test => {
                            if (this.currentRun) {
                                let currentTest = currentSuite.children.get(test.id);
                                if (!currentTest) {
                                    currentSuite.children.forEach(item => {
                                        if (!currentTest) {
                                            const subName = this.subTestName(item, test);
                                            if (subName) {
                                                currentTest = subName === '()' ? item : item.children.get(test.id);
                                            }
                                        }
                                    });
                                }
                                let message: TestMessage | undefined;
                                if (test.stackTrace) {
                                    message = new TestMessage(this.stacktrace2Message(currentTest?.uri?.toString(), test.stackTrace));
                                    if (currentTest) {
                                        const testUri = currentTest.uri || currentTest.parent?.uri;
                                        if (testUri) {
                                            const fileName = path.basename(testUri.path);
                                            const line = test.stackTrace.map(frame => {
                                                const info = frame.match(/^\s*at[^\(]*\((\S*):(\d*)\)$/);
                                                if (info && info.length >= 3 && info[1] === fileName) {
                                                    return parseInt(info[2]);
                                                }
                                                return null;
                                            }).find(l => l);
                                            const pos = line ? new Position(line - 1, 0) : currentTest.range?.start;
                                            if (pos) {
                                                message.location = new Location(testUri, pos);
                                            }
                                        }
                                    } else {
                                        message.location = new Location(currentSuite.uri!, currentSuite.range!.start);
                                    }
                                }
                                if (currentTest && test.state !== 'loaded') {
                                    this.set(currentTest, test.state, message, true);
                                } else if (test.state !== 'passed' && message) {
                                    suiteMessages.push(message);
                                }
                            }
                        });
                        if (suiteMessages.length > 0) {
                            this.set(currentSuite, 'errored', suiteMessages, true);
                            currentSuite.children.forEach(item => this.set(item, 'skipped'));
                        } else {
                            this.set(currentSuite, suite.state, undefined, true);
                        }
                    }
                }
                break;
        }
    }

    updateTests(suite: TestSuite, testExecution?: boolean): void {
        let currentSuite = this.testController.items.get(suite.name);
        const suiteUri = suite.file ?  FileUtils.toUri(suite.file, true) : undefined;
        if (!currentSuite || suiteUri && currentSuite.uri?.toString() !== suiteUri.toString()) {
            currentSuite = this.testController.createTestItem(suite.name, suite.name, suiteUri);
            this.testController.items.add(currentSuite);
        }
        const suiteRange = asRange(suite.range);
        if (!testExecution && suiteRange && suiteRange !== currentSuite.range) {
            currentSuite.range = suiteRange;
        }
        const children: TestItem[] = []
        suite.tests?.forEach(testCase => {
            let currentTest = currentSuite?.children.get(testCase.id);
            const testUri = testCase.file ? FileUtils.toUri(testCase.file, true) : undefined;
            if (currentTest) {
                if (testUri && currentTest.uri?.toString() !== testUri?.toString()) {
                    currentTest = this.testController.createTestItem(testCase.id, testCase.name, testUri);
                    currentSuite?.children.add(currentTest);
                }
                const testRange = asRange(testCase.range);
                if (!testExecution && testRange && testRange !== currentTest.range) {
                    currentTest.range = testRange;
                }
                children.push(currentTest);
            } else {
                if (!testExecution) {
                    currentTest = this.testController.createTestItem(testCase.id, testCase.name, testUri);
                    currentTest.range = asRange(testCase.range);
                    children.push(currentTest);
                    currentSuite?.children.add(currentTest);
                }
            }
        });
        if (!testExecution) {
            currentSuite.children.replace(children);
        }
    }

    subTestName(item: TestItem, test: TestCase): string | undefined {
        if (test.id.startsWith(item.id)) {
            let label = test.name;
            if (label.startsWith(item.label)) {
                label = label.slice(item.label.length).trim();
            }
            return label;
        } else {
            const regexp = new RegExp(item.id.replace(/[-[\]{}()*+?.,\\^$|\s]/g, '\\$&').replace(/#\w*/g, '\\S*'));
            if (regexp.test(test.id)) {
                return test.name;
            }
        }
        return undefined;
    }

    selectParent(parents: Map<TestItem, string>): { test: TestItem, label: string } | undefined {
        let ret: { test: TestItem, label: string } | undefined = undefined;
        parents.forEach((label, parentTest) => {
            if (ret) {
                if (parentTest.id.replace(/#\w*/g, '').length > ret.test.id.replace(/#\w*/g, '').length) {
                    ret = { test: parentTest, label };
                }
            } else {
                ret = { test: parentTest, label };
            }
        });
        return ret;
    }

    stacktrace2Message(currentTestUri: string | undefined, stacktrace: string[]): MarkdownString {
        const regExp: RegExp = /(\s*at\s+(?:[\w$\\.]+\/)?((?:[\w$]+\.)+[\w\s$<>]+))\(((.*):(\d+))\)/;
        const message = new MarkdownString();
        message.isTrusted = true;
        message.supportHtml = true;
        for (const line of stacktrace) {
            if (message.value.length) {
                message.appendMarkdown('<br/>');
            }
            const result = regExp.exec(line);
            if (result) {
                message.appendText(result[1]).appendText('(').appendMarkdown(`[${result[3]}](command:${nbCommands.openStackTrace}?${encodeURIComponent(JSON.stringify([currentTestUri, result[2], result[4], +result[5]]))})`).appendText(')');
            } else {
                message.appendText(line);
            }
        }
        return message;
    }
}
