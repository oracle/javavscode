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
import { InternalDebugResolutionBackend } from '../../../configurations/configurationValueResolver/internalDebugResolutionBackend';

describe('InternalDebugResolutionBackend', () => {
  let sandbox: sinon.SinonSandbox;
  let registerDebugConfigurationProviderStub: sinon.SinonStub;
  let startDebuggingStub: sinon.SinonStub;
  let providerDisposeStub: sinon.SinonStub;

  const installDebugMocks = () => {
    providerDisposeStub = sandbox.stub();
    registerDebugConfigurationProviderStub = sandbox.stub().returns({ dispose: providerDisposeStub });
    startDebuggingStub = sandbox.stub();

    (vscode as any).debug = {
      registerDebugConfigurationProvider: registerDebugConfigurationProviderStub,
      startDebugging: startDebuggingStub
    };
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    installDebugMocks();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('returns resolved values from internal resolver response', async () => {
    const backend = new InternalDebugResolutionBackend();

    startDebuggingStub.callsFake(async (_folder: unknown, debugConfiguration: any) => {
      backend.completePendingInternalResolver(debugConfiguration.__resolverRequestId, {
        ...debugConfiguration.__resolverValues,
        'jdk.runConfig.cwd': '/resolved/path'
      });
      return true;
    });

    const values = await backend.resolveBatch([
      { configKey: 'jdk.runConfig.cwd', rawValue: '${workspaceFolder}' },
      { configKey: 'jdk.telemetry.enabled', rawValue: false }
    ]);

    expect(registerDebugConfigurationProviderStub.calledOnce).to.equal(true);
    expect(startDebuggingStub.calledOnce).to.equal(true);
    expect(values).to.deep.equal(['/resolved/path', false]);
  });

  it('falls back to raw values when debug launch fails', async () => {
    const backend = new InternalDebugResolutionBackend();
    startDebuggingStub.rejects(new Error('startDebugging failed'));

    const values = await backend.resolveBatch([
      { configKey: 'jdk.runConfig.cwd', rawValue: '${workspaceFolder}' }
    ]);

    expect(values).to.deep.equal(['${workspaceFolder}']);
  });

  it('falls back to raw values when debug launch does not start', async () => {
    const backend = new InternalDebugResolutionBackend();
    startDebuggingStub.resolves(false);

    const values = await backend.resolveBatch([
      { configKey: 'jdk.runConfig.cwd', rawValue: '${workspaceFolder}' }
    ]);

    expect(values).to.deep.equal(['${workspaceFolder}']);
  });

  it('does not override resolved values when debug launch returns false after completion', async () => {
    const backend = new InternalDebugResolutionBackend();
    startDebuggingStub.callsFake(async (_folder: unknown, debugConfiguration: any) => {
      backend.completePendingInternalResolver(debugConfiguration.__resolverRequestId, {
        ...debugConfiguration.__resolverValues,
        'jdk.runConfig.cwd': '/resolved/path'
      });
      return false;
    });

    const values = await backend.resolveBatch([
      { configKey: 'jdk.runConfig.cwd', rawValue: '${workspaceFolder}' }
    ]);

    expect(values).to.deep.equal(['/resolved/path']);
  });

  it('resolves pending requests with fallback values on dispose', async () => {
    const backend = new InternalDebugResolutionBackend();
    startDebuggingStub.callsFake(async () => {
      return true;
    });

    const pending = backend.resolveBatch([
      { configKey: 'jdk.runConfig.cwd', rawValue: '${workspaceFolder}' }
    ]);

    backend.dispose();

    const values = await pending;
    expect(values).to.deep.equal(['${workspaceFolder}']);
  });

  it('disposes the registered debug configuration provider', () => {
    const backend = new InternalDebugResolutionBackend();
    backend.dispose();

    expect(providerDisposeStub.calledOnce).to.equal(true);
  });
});
