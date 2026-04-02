/*
  Copyright (c) 2026, Oracle and/or its affiliates.

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
import { afterEach, beforeEach, describe, it } from 'mocha';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ConfigurationValueResolver } from '../../../configurations/configurationValueResolver/configurationValueResolver';

describe('ConfigurationValueResolver', () => {
  let sandbox: sinon.SinonSandbox;

  const installDebugMocks = () => {
    (vscode as any).Disposable = class {
      private readonly onDispose?: () => void;
      constructor(onDispose?: () => void) {
        this.onDispose = onDispose;
      }
      dispose(): void {
        this.onDispose?.();
      }
    };
    (vscode as any).debug = {
      registerDebugConfigurationProvider: sandbox.stub().returns({ dispose: () => undefined }),
      startDebugging: sandbox.stub().resolves(true)
    };
  };

  const createResolver = () => {
    const extensionContext = { subscriptions: [] as vscode.Disposable[] } as unknown as vscode.ExtensionContext;
    return new (ConfigurationValueResolver as any)(extensionContext) as ConfigurationValueResolver;
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    (ConfigurationValueResolver as any).instance = undefined;
    installDebugMocks();
  });

  afterEach(() => {
    sandbox.restore();
    (ConfigurationValueResolver as any).instance = undefined;
  });

  it('resolves only supported keys and preserves order', async () => {
    const resolver = createResolver();
    const resolveBatchStub = sandbox.stub().resolves(['/resolved/cwd']);
    (resolver as any).internalResolver = { resolveBatch: resolveBatchStub };
    sandbox.stub(resolver, 'isSupported').callsFake((key: string) => key === 'jdk.runConfig.cwd');

    const output = await resolver.resolveIfNeededBatch([
      { configKey: 'jdk.telemetry.enabled', rawValue: false },
      { configKey: 'jdk.runConfig.cwd', rawValue: '${workspaceFolder}' },
      { configKey: 'files.autoSave', rawValue: 'onFocusChange' }
    ]);

    expect(resolveBatchStub.calledOnce).to.equal(true);
    expect(resolveBatchStub.firstCall.args[0]).to.deep.equal([
      { index: 1, configKey: 'jdk.runConfig.cwd', rawValue: '${workspaceFolder}' }
    ]);
    expect(output).to.deep.equal([false, '/resolved/cwd', 'onFocusChange']);
  });

  it('returns raw values when there are no supported keys', async () => {
    const resolver = createResolver();
    const resolveBatchStub = sandbox.stub().resolves([]);
    (resolver as any).internalResolver = { resolveBatch: resolveBatchStub };
    sandbox.stub(resolver, 'isSupported').returns(false);

    const output = await resolver.resolveIfNeededBatch([
      { configKey: 'files.autoSave', rawValue: 'onFocusChange' },
      { configKey: 'editor.formatOnSave', rawValue: true }
    ]);

    expect(resolveBatchStub.notCalled).to.equal(true);
    expect(output).to.deep.equal(['onFocusChange', true]);
  });

  it('falls back to raw values when internal resolver throws', async () => {
    const resolver = createResolver();
    const resolveBatchStub = sandbox.stub().rejects(new Error('resolution failed'));
    (resolver as any).internalResolver = { resolveBatch: resolveBatchStub };
    sandbox.stub(resolver, 'isSupported').returns(true);

    const output = await resolver.resolveIfNeededBatch([
      { configKey: 'jdk.runConfig.cwd', rawValue: '${workspaceFolder}' }
    ]);

    expect(output).to.deep.equal(['${workspaceFolder}']);
  });
});
