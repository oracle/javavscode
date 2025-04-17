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

import { extensions, window } from 'vscode';
import { DEFAULT_BUNDLE_FILE_NAME, DEFAULT_PACKAGE_FILE_NAME, EXTENSION_NAME, SUPPORTED_LANGUAGES } from '../../constants';
import { checkCommandsLocalisation, checkConfigurationLocalisation, checkDebuggersLocalisation, checkL10nUsageInFiles, checkViewsLocalisation, getKeysFromJSON, matchKeys, matchValuesTemplate } from '../../testutils';


suite("Extension localisation tests", function () {
    window.showInformationMessage("Starting Localisation tests");
    // Check the consistency of the keys and value templates across the bundle files for the supported languages 
    test("Consistency of keys across bundle.l10n.lang.json files for supported languages", async () => {
        const extension = extensions.getExtension(EXTENSION_NAME);
        assert(extension);
        const enBundlePath = path.join(extension.extensionPath, "l10n", DEFAULT_BUNDLE_FILE_NAME);
        assert.ok(fs.existsSync(enBundlePath), `${DEFAULT_BUNDLE_FILE_NAME} doesn't exists`);
        for (const lang of SUPPORTED_LANGUAGES) {
            const langBundlePath = path.join(extension.extensionPath, "l10n", `bundle.l10n.${lang}.json`);
            assert.ok(fs.existsSync(langBundlePath), `bundle.l10n.${lang}.json doesn't exists`);
            assert.ok(matchKeys(enBundlePath, langBundlePath), `Keys of ${DEFAULT_BUNDLE_FILE_NAME} and  bundle.l10n.${lang}.json don't match`);
            assert.ok(matchValuesTemplate(enBundlePath, langBundlePath), `Value templates don't match for of the keys of ${DEFAULT_BUNDLE_FILE_NAME} and  bundle.l10n.${lang}.json `);
        }
    });

    test("Consistency of keys across package.nls.lang.json files for supported languages", async () => {
        const extension = extensions.getExtension(EXTENSION_NAME);
        assert(extension);
        const enPackagePath = path.join(extension.extensionPath, DEFAULT_PACKAGE_FILE_NAME);
        assert.ok(fs.existsSync(enPackagePath), `${DEFAULT_PACKAGE_FILE_NAME} doesn't exists`);
        for (const lang of SUPPORTED_LANGUAGES) {
            const langPackagePath = path.join(extension.extensionPath, `package.nls.${lang}.json`);
            assert.ok(fs.existsSync(langPackagePath), `package.nls.${lang}.json doesn't exists`);
            assert.ok(matchKeys(enPackagePath, langPackagePath), `Keys of ${DEFAULT_PACKAGE_FILE_NAME} and  package.nls.${lang}.json don't match`);
        }
    });

    // Check localisable fields being appropriately localised for the contributes defined in package.json
    test("Localisable fields in package.json localised properly ", async () => {
        const extension = extensions.getExtension(EXTENSION_NAME);
        assert(extension);
        const packagePath = path.join(extension.extensionPath, "package.json");
        assert.ok(fs.existsSync(packagePath), "package.json doesn't exists");
        const enPackagePath = path.join(extension.extensionPath, DEFAULT_PACKAGE_FILE_NAME);
        assert.ok(fs.existsSync(enPackagePath), `${DEFAULT_PACKAGE_FILE_NAME} doesn't exists`);
        const validKeys: Set<string> = getKeysFromJSON(enPackagePath);
        const packageObj = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const contributes = packageObj.contributes
        assert.ok(checkCommandsLocalisation(contributes.commands, validKeys), "Error some commands not localized");
        assert.ok(checkViewsLocalisation(contributes.views, validKeys), "Error some views is not localized");
        assert.ok(checkDebuggersLocalisation(contributes.debuggers, validKeys), "Error some debugger labels not localized");
        assert.ok(checkConfigurationLocalisation(contributes.configuration, validKeys), "Error some configuration labels not localized");
    });


    // Check if l10n.value is called with a valid key and the placeholder map has all the keys as required in the string template 
    test("Proper usage of l10n.value for localisation in the ts/js code files", async () => {
        const ignoredDirEntriesNames = new Set(["test"]); // Names of folders,files( .js only),subfolders within the out directory which are not to be checked 
        const extension = vscode.extensions.getExtension(EXTENSION_NAME);
        assert(extension, "extension not found");
        const enBundlePath = path.join(extension.extensionPath, "l10n", DEFAULT_BUNDLE_FILE_NAME);
        assert(enBundlePath, `${DEFAULT_BUNDLE_FILE_NAME} not found`);
        const validKeyValues = JSON.parse(fs.readFileSync(enBundlePath, 'utf8'));
        assert(checkL10nUsageInFiles(path.join(extension.extensionPath, "out"), ignoredDirEntriesNames, validKeyValues) === 0, "Some files have invalid localisation keys used. Check the logs or error messages");
    });

});
