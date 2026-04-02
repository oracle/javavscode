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
import { extractSettingsInformation } from '../../../configurations/configurationValueResolver/utils';
import { ConfigurationValueResolver } from '../../../configurations/configurationValueResolver/configurationValueResolver';

describe('extractSettingsInformation', () => {
  let resolveIfNeededBatchStub: sinon.SinonStub;
  const configValues: Record<string, unknown> = {};
  const passthroughResolver = (entries: Array<{ rawValue: unknown }>) => entries.map(entry => entry.rawValue);

  beforeEach(() => {
    Object.keys(configValues).forEach(key => delete configValues[key]);
    resolveIfNeededBatchStub = sinon.stub();
    sinon.stub(ConfigurationValueResolver, 'getInstance').returns({
      resolveIfNeededBatch: resolveIfNeededBatchStub
    } as unknown as ConfigurationValueResolver);
    sinon.stub(vscode.workspace, 'getConfiguration').callsFake(() => ({
      get: (key: string) => configValues[key]
    }) as unknown as vscode.WorkspaceConfiguration);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns only extension-prefixed keys and maps them as nested settings object', async () => {
    configValues['runConfig.cwd'] = '${workspaceFolder}';
    configValues['telemetry.enabled'] = true;
    resolveIfNeededBatchStub.resolves(['/workspace/path', true]);

    const result = await extractSettingsInformation([
      'jdk.runConfig.cwd',
      'files.autoSave',
      'jdk.telemetry.enabled'
    ]);

    expect(resolveIfNeededBatchStub.calledOnce).to.equal(true);
    expect(resolveIfNeededBatchStub.firstCall.args[0]).to.deep.equal([
      { configKey: 'jdk.runConfig.cwd', rawValue: '${workspaceFolder}' },
      { configKey: 'jdk.telemetry.enabled', rawValue: true }
    ]);

    expect(result).to.deep.equal({
      jdk: {
        runConfig: {
          cwd: '/workspace/path'
        },
        telemetry: {
          enabled: true
        }
      }
    });
  });

  it('does not drop falsy config values and resolves them', async () => {
    configValues['telemetry.enabled'] = false;
    resolveIfNeededBatchStub.resolves([false]);

    const result = await extractSettingsInformation(['jdk.telemetry.enabled']);

    expect(resolveIfNeededBatchStub.calledOnce).to.equal(true);
    expect(resolveIfNeededBatchStub.firstCall.args[0]).to.deep.equal([
      { configKey: 'jdk.telemetry.enabled', rawValue: false }
    ]);
    expect(result).to.deep.equal({
      jdk: {
        telemetry: {
          enabled: false
        }
      }
    });
  });

  it('returns an empty object when no relevant keys are passed', async () => {
    resolveIfNeededBatchStub.resolves([]);

    const result = await extractSettingsInformation(['files.autoSave', 'editor.formatOnSave']);

    expect(resolveIfNeededBatchStub.calledOnce).to.equal(true);
    expect(resolveIfNeededBatchStub.firstCall.args[0]).to.deep.equal([]);
    expect(result).to.deep.equal({});
  });

  it('builds deeply nested objects for dot-separated extension keys', async () => {
    configValues['java.imports.countForUsingStarImport'] = 99;
    configValues['java.imports.groups'] = ['java', 'javax', 'org'];
    resolveIfNeededBatchStub.callsFake(passthroughResolver);

    const result = await extractSettingsInformation([
      'jdk.java.imports.countForUsingStarImport',
      'jdk.java.imports.groups'
    ]);

    expect(result).to.deep.equal({
      jdk: {
        java: {
          imports: {
            countForUsingStarImport: 99,
            groups: ['java', 'javax', 'org']
          }
        }
      }
    });
  });

  it('supports a mix of values that are resolved and left unchanged', async () => {
    configValues['runConfig.cwd'] = '${workspaceFolder}';
    configValues['telemetry.enabled'] = false;
    configValues['runConfig.env'] = 'A=1';
    resolveIfNeededBatchStub.resolves(['/resolved/workspace', false, 'A=1']);

    const result = await extractSettingsInformation([
      'jdk.runConfig.cwd',
      'jdk.telemetry.enabled',
      'jdk.runConfig.env'
    ]);

    expect(resolveIfNeededBatchStub.firstCall.args[0]).to.deep.equal([
      { configKey: 'jdk.runConfig.cwd', rawValue: '${workspaceFolder}' },
      { configKey: 'jdk.telemetry.enabled', rawValue: false },
      { configKey: 'jdk.runConfig.env', rawValue: 'A=1' }
    ]);
    expect(result).to.deep.equal({
      jdk: {
        runConfig: {
          cwd: '/resolved/workspace',
          env: 'A=1'
        },
        telemetry: {
          enabled: false
        }
      }
    });
  });

  it('ignores undefined values while retaining null and empty-string values', async () => {
    configValues['runConfig.cwd'] = undefined;
    configValues['runConfig.arguments'] = '';
    configValues['project.jdkhome'] = null;
    resolveIfNeededBatchStub.callsFake(passthroughResolver);

    const result = await extractSettingsInformation([
      'jdk.runConfig.cwd',
      'jdk.runConfig.arguments',
      'jdk.project.jdkhome'
    ]);

    expect(resolveIfNeededBatchStub.firstCall.args[0]).to.deep.equal([
      { configKey: 'jdk.runConfig.arguments', rawValue: '' },
      { configKey: 'jdk.project.jdkhome', rawValue: null }
    ]);
    expect(result).to.deep.equal({
      jdk: {
        runConfig: {
          arguments: ''
        },
        project: {
          jdkhome: null
        }
      }
    });
  });
});
