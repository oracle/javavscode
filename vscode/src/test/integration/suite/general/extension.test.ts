
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
import * as vscode from 'vscode';
import * as myExplorer from '../../../../views/projects';
import { CodeAction, commands, extensions, Selection, Uri, window, workspace, TreeItem } from 'vscode';
import { assertWorkspace, awaitClient, dumpJava, findClusters, getFilePaths, openFile, prepareProject, replaceCode } from '../../testutils';
import { FORMATTED_POM_XML, SAMPLE_CODE_FORMAT_DOCUMENT, SAMPLE_CODE_SORT_IMPORTS, SAMPLE_CODE_UNUSED_IMPORTS } from '../../constants';
import { extCommands } from '../../../../commands/commands';

suite('Extension Test Suite', function () {
  window.showInformationMessage('Start all tests.');

  const filePaths = getFilePaths();

  // Create project which used be used for testing
  this.beforeAll(async () => {
    await prepareProject(filePaths);
  });

  // This test must be run first, in order to activate the extension and wait for the activation to complete
  test("Extension loaded and activated", async () => {
    const extension = extensions.getExtension('oracle.oracle-java');
    assert(extension, "No Java extension found!");

    const api = await extension.activate();
    assert(extension?.isActive, "true");
    assert.ok(api.version, "Some version is specified");

    let cannotReassignVersion = false;
    try {
      api.version = "different";
    } catch (e) {
      cannotReassignVersion = true;
    }
    assert.ok(cannotReassignVersion, "Cannot reassign value of version");

  });

  // Test if clusters are loaded or not
  test('Find clusters', async () => {
    const nbcode = extensions.getExtension('oracle.oracle-java');
    assert(nbcode);

    const extraCluster = path.join(nbcode.extensionPath, "nbcode", "extra");
    let clusters = findClusters('non-existent').
      // ignore 'extra' cluster in the extension path, since nbjavac is there during development:
      filter(s => !s.startsWith(extraCluster));

    let found: string[] = [];
    function assertCluster(name: string) {
      for (let c of clusters) {
        if (c.endsWith('/' + name) || c.endsWith('\\' + name)) {
          found.push(c);
          return;
        }
      }
      assert.fail(`Cannot find ${name} among ${clusters}`);
    }

    assertCluster('extide');
    assertCluster('ide');
    assertCluster('java');
    assertCluster('nbcode');
    assertCluster('platform');
    assertCluster('webcommon');
    assertCluster('harness');

    for (let c of found) {
      assert.ok(c.startsWith(nbcode.extensionPath), `All extensions are below ${nbcode.extensionPath}, but: ${c}`);
    }
  });

  // Check if Jdk commands have been loaded
  test("Jdk commands loaded", async () => {
    let commandsList = await commands.getCommands(true);

    let containsJdkCommands: Boolean = false;
    for (const command of commandsList) {
      if (command.indexOf("jdk.") === 0) {
        containsJdkCommands = true;
      }
    }

    assert.ok(containsJdkCommands, "No Jdk command has been loaded");
  });

  // Check if format document command is executed successfully
  test("Format document", async () => {
    const editor = await openFile(filePaths.formatDocument);
    await commands.executeCommand('editor.action.formatDocument');

    const formattedCode = editor.document.getText().split('\n').length;
    const unformattedCode = SAMPLE_CODE_FORMAT_DOCUMENT.split('\n').length;
    const isDocumentFormatted = formattedCode > unformattedCode;
    assert.ok(isDocumentFormatted, "document is not formatted");
  });

  // Check if imports are getting sorted on saving document
  test("Sort imports", async () => {
    const editor = await openFile(filePaths.sortImports);
    await replaceCode(editor, SAMPLE_CODE_SORT_IMPORTS);

    const isSaved = await editor.document.save();
    assert.ok(isSaved, "document cannot be saved");

    const savedCode = editor.document.getText();
    const isImportsSorted = savedCode.indexOf('import java.util.Date;') >
      savedCode.indexOf('import java.util.ArrayList;');
    assert.ok(isImportsSorted, "Imports are not sorted");

  });

  // Check if unused imports are getting removed on saving document
  test("Remove unused imports", async () => {
    const editor = await openFile(filePaths.unusedImports);
    await replaceCode(editor, SAMPLE_CODE_UNUSED_IMPORTS);

    const isSaved = await editor.document.save();
    assert.ok(isSaved, "document cannot be saved");

    const savedCode = editor.document.getText();
    const areUnusedImportsRemoved = savedCode.indexOf('import java.lang.Float;') === -1 &&
      savedCode.indexOf('import java.lang.Integer;') === -1;
    assert.ok(areUnusedImportsRemoved, "Unused imports are not removed");

  });

  // Check if refactor actions are getting showing on UI and if they are working
  test("Refactor actions executing", async () => {
    const editor = await openFile(filePaths.refactorActions);
    const doc = editor.document;
    const sel = new Selection(doc.lineAt(12).range.start, doc.lineAt(12).range.end);
    editor.selections = [sel];

    const refactorActions = await commands.executeCommand<CodeAction[]>(
      'vscode.executeCodeActionProvider',
      doc.uri,
      sel
    );

    if (refactorActions && refactorActions.length > 0) {
      for await (const action of refactorActions) {
        if (action.command && action.command.arguments) {
          if (action.command.command === extCommands.surroundWith) {
            //this action has a popup where the user needs to
            //select a template that should be used for the surround:
            continue;
          }
          await commands.executeCommand(action.command.command, ...action.command.arguments);
          await commands.executeCommand('undo');
        }
      }
    }
  });

  // Tests explorer is loading properly
  test("Test Explorer tests", async () => {
    let folder: string = assertWorkspace();

    try {
      console.log("Test: load workspace tests");
      const workspaceFolder = (workspace.workspaceFolders!)[0];
      let tests: any = await commands.executeCommand("jdk.load.workspace.tests", workspaceFolder.uri.toString());
      console.log(`Test: load workspace tests finished with ${tests}`);
      assert.ok(tests, "No tests returned for workspace");
      assert.strictEqual(tests.length, 2, `Invalid number of test suites returned`);
      assert.strictEqual(tests[0].name, 'pkg.MainTest', `Invalid test suite name returned`);
      assert.strictEqual(tests[0].tests.length, 1, `Invalid number of tests in suite returned`);
      assert.strictEqual(tests[0].tests[0].name, 'testGetName', `Invalid test name returned`);
      assert.strictEqual(tests[1].name, 'pkg.MainTest$NestedTest', `Invalid test suite name returned`);
      assert.strictEqual(tests[1].tests.length, 1, `Invalid number of tests in suite returned`);
      assert.strictEqual(tests[1].tests[0].name, 'testTrue', `Invalid test name returned`);

      console.log("Test: run all workspace tests");
      await vscode.commands.executeCommand(extCommands.runTest, workspaceFolder.uri.toString());
      console.log(`Test: run all workspace tests finished`);
    } catch (error) {
      dumpJava();
      throw error;
    }
  });

  // Check if compile workspace command is excuted succesfully
  test("Compile workspace", async () => {
    let folder: string = assertWorkspace();
    const compile = await commands.executeCommand('jdk.workspace.compile');
    assert.ok(compile, " Compile workspace command not working");


    const mainClass = path.join(folder, 'target', 'classes', 'pkg', 'Main.class');
    assert.ok(fs.statSync(mainClass).isFile(), "Class created by compilation: " + mainClass);

    myExplorer.createViewProvider(await awaitClient(), "foundProjects").then(async (lvp) => {
      const firstLevelChildren = await (lvp.getChildren() as Thenable<any[]>);
      assert.strictEqual(firstLevelChildren.length, 1, "One child under the root");
      const item = await (lvp.getTreeItem(firstLevelChildren[0]) as Thenable<TreeItem>);
      assert.strictEqual(item?.label, "basicapp", "Element is named as the Maven project");
    });
  });

  // Get Project info
  test("Get project sources, classpath, and packages", async () => {
    let folder: string = assertWorkspace();
    try {
      console.log("Test: get project java source roots");
      let res: any = await commands.executeCommand("jdk.java.get.project.source.roots", Uri.file(folder).toString());
      console.log(`Test: get project java source roots finished with ${res}`);
      assert.ok(res, "No java source root returned");
      assert.strictEqual(res.length, 2, `Invalid number of java roots returned`);
      assert.strictEqual(path.join(res[0]).toLowerCase(), (path.join('file:', folder, 'src', 'main', 'java') + path.sep).toLowerCase(), `Invalid java main source root returned`);
      assert.strictEqual(path.join(res[1]).toLowerCase(), (path.join('file:', folder, 'src', 'test', 'java') + path.sep).toLowerCase(), `Invalid java test source root returned`);

      console.log("Test: get project resource roots");
      res = await commands.executeCommand("jdk.java.get.project.source.roots", Uri.file(folder).toString(), 'resources');
      console.log(`Test: get project resource roots finished with ${res}`);
      assert.ok(res, "No resource root returned");
      assert.strictEqual(res.length, 1, `Invalid number of resource roots returned`);
      assert.strictEqual(path.join(res[0]).toLowerCase(), (path.join('file:', folder, 'src', 'main', 'resources') + path.sep).toLowerCase(), `Invalid resource root returned`);

      console.log("Test: get project compile classpath");
      res = await commands.executeCommand("jdk.java.get.project.classpath", Uri.file(folder).toString());
      console.log(`Test: get project compile classpath finished with ${res}`);
      assert.ok(res, "No compile classpath returned");
      assert.strictEqual(res.length, 9, `Invalid number of compile classpath roots returned`);
      assert.ok(res.find((item: string) => path.join(item).toLowerCase() === (path.join('file:', folder, 'target', 'classes') + path.sep).toLowerCase(), `Invalid compile classpath root returned`));

      console.log("Test: get project source classpath");
      res = await commands.executeCommand("jdk.java.get.project.classpath", Uri.file(folder).toString(), 'SOURCE');
      console.log(`Test: get project source classpath finished with ${res}`);
      assert.ok(res, "No source classpath returned");
      assert.strictEqual(res.length, 3, `Invalid number of source classpath roots returned`);
      assert.ok(res.find((item: string) => path.join(item).toLowerCase() === (path.join('file:', folder, 'src', 'main', 'java') + path.sep).toLowerCase(), `Invalid source classpath root returned`));
      assert.ok(res.find((item: string) => path.join(item).toLowerCase() === (path.join('file:', folder, 'src', 'main', 'resources') + path.sep).toLowerCase(), `Invalid source classpath root returned`));
      assert.ok(res.find((item: string) => path.join(item).toLowerCase() === (path.join('file:', folder, 'src', 'test', 'java') + path.sep).toLowerCase(), `Invalid source classpath root returned`));

      console.log("Test: get project boot classpath");
      res = await commands.executeCommand("jdk.java.get.project.classpath", Uri.file(folder).toString(), 'BOOT');
      console.log(`Test: get project boot classpath finished with ${res}`);
      assert.ok(res, "No boot classpath returned");
      assert.ok(res.length > 0, `Invalid number of boot classpath roots returned`);

      console.log("Test: get project boot source classpath");
      res = await commands.executeCommand("jdk.java.get.project.classpath", Uri.file(folder).toString(), 'BOOT', true);
      console.log(`Test: get project boot source classpath finished with ${res}`);
      assert.ok(res, "No boot source classpath returned");
      assert.ok(res.length > 0, `Invalid number of boot source classpath roots returned`);

      console.log("Test: get all project packages");
      res = await commands.executeCommand("jdk.java.get.project.packages", Uri.file(folder).toString());
      console.log(`Test: get all project packages finished with ${res}`);
      assert.ok(res, "No packages returned");
      assert.ok(res.length > 0, `Invalid number of packages returned`);

      console.log("Test: get project source packages");
      res = await commands.executeCommand("jdk.java.get.project.packages", Uri.file(folder).toString(), true);
      console.log(`Test: get project source packages finished with ${res}`);
      assert.ok(res, "No packages returned");
      assert.strictEqual(res.length, 1, `Invalid number of packages returned`);
      assert.strictEqual(res[0], 'pkg', `Invalid package returned`);
    } catch (error) {
      dumpJava();
      throw error;
    }
  });

  // Check if clean workspace command is excuted succesfully
  test("Clean workspace", async () => {
    let folder: string = assertWorkspace();
    const clean = await commands.executeCommand('jdk.workspace.clean');
    assert.ok(clean, " Clean workspace command not working");

    const mainClass = path.join(folder, 'target');
    assert.ok(!fs.existsSync(mainClass), "Class created by compilation: " + mainClass);
  });

  // Check if xml document formatting is executed successfully
  test("XML Format document", async () => {
    const editor = await openFile(filePaths.pom);
    await commands.executeCommand('editor.action.formatDocument');

    const formattedContents = editor.document.getText().trim();
    assert.ok(formattedContents == FORMATTED_POM_XML.trim(), "pom.xml is not formatted");
  });

});