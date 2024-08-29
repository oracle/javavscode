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
import * as path from "path";

import { commands, window } from "vscode";
import { assertWorkspace, dumpJava, gradleInitJavaApplication } from "../../testutils";


suite("Extension gradle tests", function () {
  window.showInformationMessage("Starting Gradle tests");

  // Check if compile workspace command is excuted succesfully
  test("Compile workspace - Gradle ", async () => {
    let folder: string = assertWorkspace();
    try {
      await gradleInitJavaApplication(folder);
      let compile = await commands.executeCommand("jdk.workspace.compile");
      assert.ok(compile, " Compile workspace command not working");
      const mainClass = path.join(
        folder,
        "build",
        "classes",
        "java",
        "main",
        "org",
        "yourCompany",
        "yourProject",
        "App.class"
      );
      assert.ok(
        fs.statSync(mainClass).isFile(),
        "Class created by compilation: " + mainClass
      );
    } catch (error) {
      dumpJava();
      throw error;
    }
  }).timeout(50000);

  // Check if clean workspace command is excuted succesfully
  test("Clean workspace - Gradle", async () => {
    let folder: string = assertWorkspace();
    const clean = await commands.executeCommand("jdk.workspace.clean");
    assert.ok(clean, " Clean workspace command not working");

    const mainClass = path.join(folder, "build");
    assert.ok(
      !fs.existsSync(mainClass),
      "Class created by compilation: " + mainClass
    );
  }).timeout(10000);
});
