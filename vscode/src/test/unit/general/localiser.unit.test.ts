/*
  Copyright (c) 2025-2026, Oracle and/or its affiliates.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

   https://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
import { expect } from 'chai';
import { describe, it, beforeEach, before, after } from "mocha";
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as assert from 'assert';
import { Extension } from 'vscode';
import { LOGGER } from '../../../logger';
import { mock, instance, when, reset } from "ts-mockito";

import * as path from 'path';

describe('localiser tests', () => {
    let loggerLogStub: sinon.SinonStub;
    let mockedExtns: typeof vscode.extensions;
    let extMock: Extension<any>;
    let mockedEnv: typeof vscode.env;
    let mockedL10n: typeof vscode.l10n;
    let currentDir = __dirname.replace(path.sep + "out" + path.sep, path.sep + "src" + path.sep);

    before(() => {
        let vscodeObj = (vscode as typeof vscode & { mockedExtns: typeof vscode.extensions, mockedEnv: typeof vscode.env, mockedL10n: typeof vscode.l10n });
        mockedExtns = vscodeObj.mockedExtns;
        mockedEnv = vscodeObj.mockedEnv;
        mockedL10n = vscodeObj.mockedL10n;
        extMock = mock<Extension<any>>();
        loggerLogStub = sinon.stub(LOGGER, "error");
    });
    after(() => {
        sinon.reset();
        reset(mockedExtns);
        reset(extMock);
        reset(mockedEnv);
        reset(mockedL10n);
    });

    beforeEach(() => {
        sinon.reset();
        reset(mockedExtns);
        reset(extMock);
        reset(mockedEnv);
        reset(mockedL10n);
    })



    describe('l10n tests', () => {
        describe('issue while reading bundle', () => {
            it('file not found error', () => {
                let msg: string | null = null;
                when(extMock?.extensionPath).thenReturn(path.join(currentDir, 'doesnt-exist'));
                var mkInst = instance(extMock);
                when(mockedExtns.getExtension("oracle.oracle-java")).thenReturn(mkInst);
                try {
                    require('../../../localiser');
                } catch (e) {
                    msg = (e as any & { message: string }).message
                }
                assert.strictEqual(msg!!.includes("no such file or directory"), true);
                expect(loggerLogStub.called).to.be.true;
            });
            it('file parsing error', () => {
                let msg: string | null = null;
                when(extMock?.extensionPath).thenReturn(path.join(currentDir, 'resources', 'corrupt'));
                var mkInst = instance(extMock);
                when(mockedExtns.getExtension("oracle.oracle-java")).thenReturn(mkInst);
                try {
                    require('../../../localiser');
                } catch (e) {
                    msg = (e as any & { message: string }).message
                }
                assert.strictEqual(msg!!.includes("Bad control character in string literal in JSON"), true);
                expect(loggerLogStub.called).to.be.true;
            });

        });
        describe('l10n initialisation tests', () => {
            it('l10n initialized', () => {
                when(extMock?.extensionPath).thenReturn(path.join(currentDir, 'resources'));
                var mkInst = instance(extMock);
                when(mockedExtns.getExtension("oracle.oracle-java")).thenReturn(mkInst);
                require('../../../localiser');
                expect(loggerLogStub.called).to.be.false;
            });
            it('get nbLocaleCode and get value', () => {
                when(extMock?.extensionPath).thenReturn(path.join(currentDir, 'resources'));
                var mkExtInst = instance(extMock);
                when(mockedEnv.language).thenReturn("en");
                when(mockedExtns.getExtension("oracle.oracle-java")).thenReturn(mkExtInst);
                when(mockedL10n.bundle).thenReturn(undefined);
                let l10n = require('../../../localiser');
                let l10nObj = l10n.l10n as { nbLocaleCode(): string, value(key: string, placeholderMap?: Record<string, any>): string };
                assert.strictEqual(l10nObj.nbLocaleCode(), "en");
                assert.strictEqual(l10nObj.value("label1"), "label1 description");
                assert.strictEqual(l10nObj.value("label2", { "placeholder1": "sample data" }), "lable2 sample data description");
                expect(loggerLogStub.called).to.be.false;
            });
        });
    });
});