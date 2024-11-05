/*
  Copyright (c) 2023-2024, Oracle and/or its affiliates.

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

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { WebviewPanel, window } from 'vscode';
import { JdkDownloaderView } from '../../../../webviews/jdkDownloader/view';
import { checkTagContentNotEmpty, enableMockedLoggers, getMachineArch, getOsType } from '../../testUtils';

describe('JDK Downloader view tests', () => {
  let jdkDownloaderView: JdkDownloaderView;
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    jdkDownloaderView = new JdkDownloaderView();
    if (process.env.ENABLE_LOGGER) {
      enableMockedLoggers(sandbox);
    }
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('JDK Downloader createView tests', () => {
    let onDidReceiveMessageStub: sinon.SinonStub;
    let createWebviewPanelStub: sinon.SinonStub;
    let webviewPanel: WebviewPanel;

    beforeEach(() => {
      createWebviewPanelStub = sandbox.stub(window, 'createWebviewPanel');
      onDidReceiveMessageStub = sandbox.stub();

      webviewPanel = {
        webview: {
          html: '',
          onDidReceiveMessage: onDidReceiveMessageStub
        },
        dispose: sandbox.stub()
      } as unknown as WebviewPanel;

      createWebviewPanelStub.returns(webviewPanel);

      jdkDownloaderView.createView();
    });

    afterEach(() => {
      sandbox.restore();
    });

    describe("Webview creation tests", () => {
      it("should create a webview panel", () => {
        expect(createWebviewPanelStub.calledOnce).to.be.true;
      });

      it("should check arguments while creating webview panel", () => {
        const [, title, , options] = createWebviewPanelStub.firstCall.args;
        expect(title).to.be.a('string').and.not.to.be.empty;
        expect(options).to.deep.include({ enableScripts: true });
      });
    });

    describe("Default dropdown options tests", () => {
      it("should detect correct OS type", () => {
        const actualOsType = (jdkDownloaderView as any).osType;
        const expectedOs = getOsType();

        expect(actualOsType).equals(expectedOs);
      });

      it("should detect correct machine architecture type", () => {
        const actualMachineArch = (jdkDownloaderView as any).machineArch;
        const expectedMachineArch = getMachineArch();

        expect(actualMachineArch).equals(expectedMachineArch);
      });
    });

    describe("Webview HTML tests", () => {
      let jdkDownloaderHtml: string;
      beforeEach(() => {
        jdkDownloaderHtml = webviewPanel.webview.html;
      });

      it("should set the webview HTML", () => {
        expect(jdkDownloaderHtml).to.be.a('string').and.not.to.be.empty;
      });

      it("should check HTML has all the high level tags", () => {
        expect(jdkDownloaderHtml).to.include('<!DOCTYPE html>');
        expect(jdkDownloaderHtml).to.include('<head>');
        expect(jdkDownloaderHtml).to.include('<body>');
        expect(jdkDownloaderHtml).to.include('<script>');
        expect(jdkDownloaderHtml).to.include('<style>');
      });

      it("should check important html tags are not empty", () => {
        expect(checkTagContentNotEmpty(jdkDownloaderHtml, 'body')).to.be.true;
        expect(checkTagContentNotEmpty(jdkDownloaderHtml, 'head')).to.be.true;
        expect(checkTagContentNotEmpty(jdkDownloaderHtml, 'script')).to.be.true;
        expect(checkTagContentNotEmpty(jdkDownloaderHtml, 'style')).to.be.true;
        expect(checkTagContentNotEmpty(jdkDownloaderHtml, 'title')).to.be.true;
      });

      it("should check if correct default OS type is chosen on the options", () => {
        const expectedOs = getOsType();
        const osOptionRegex = new RegExp(`<option value="${expectedOs}"[^>]*selected[^>]*>`);
        expect(jdkDownloaderHtml).to.match(osOptionRegex);
      });

      it("should check if correct default machine architecture is chosen on the options", () => {
        const expectedArch = getMachineArch();
        const platform = getOsType();
        let archOptionRegex = new RegExp(`<option value="${expectedArch}"[^>]*selected[^>]*>`);
        if (platform === "windows") {
          archOptionRegex = new RegExp(`<option value="x64"[^>]*selected[^>]*>`);
        }
        expect(jdkDownloaderHtml).to.match(archOptionRegex);
      });
    });

    it("should attach a message listener to the webview", () => {
      expect(onDidReceiveMessageStub.calledOnce).to.be.true;
      const listener = onDidReceiveMessageStub.firstCall.args[0];
      expect(listener).to.be.a('function');
    });

  });

  it("should dispose the webview", () => {
    const disposeStub = sandbox.stub();
    (jdkDownloaderView as any).jdkDownloaderWebView = { dispose: disposeStub };

    jdkDownloaderView.disposeView();

    expect(disposeStub.calledOnce).to.be.true;
  });

  it("should handle errors when creating view", () => {
    const errorMessage = "Test error";
    sandbox.stub(window, 'createWebviewPanel').throws(new Error(errorMessage));
    const showErrorMessageStub = sandbox.stub(window, 'showErrorMessage');
    jdkDownloaderView.createView();

    expect(showErrorMessageStub.calledOnce).to.be.true;
  });
});