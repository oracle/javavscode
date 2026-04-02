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

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { CancellationToken } from 'vscode';
import { ConfigurationParams, ConfigurationRequest, DidChangeConfigurationSignature } from 'vscode-languageclient';
import { extConstants } from '../../../../constants';
import { NbLanguageClient } from '../../../../lsp/nbLanguageClient';
import { assertWorkspace, awaitClient } from '../../testutils';
import { configKeys } from '../../../../configurations/configuration';
import { appendPrefixToCommand } from '../../../../utils';

type WorkspaceMiddleware = {
  configuration: (params: ConfigurationParams, token: CancellationToken, next: ConfigurationRequest.HandlerSignature) => Promise<unknown[]>;
  didChangeConfiguration: (sections: string[] | undefined, next: DidChangeConfigurationSignature) => Promise<void>;
};

suite('Middleware Integration Test Suite', function () {
  let client: NbLanguageClient;
  const runConfigCwdSection = appendPrefixToCommand(configKeys.runConfigCwd);

  this.beforeAll(async () => {
    client = await awaitClient();
  });

  this.afterAll(async () => {
    vscode.workspace.getConfiguration().update(runConfigCwdSection, undefined);
  })

  const getWorkspaceMiddleware = (): WorkspaceMiddleware => {
    const middleware = client.clientOptions?.middleware?.workspace as WorkspaceMiddleware;

    assert.ok(middleware, 'Workspace middleware should be registered on NbLanguageClient');
    return middleware!;
  };

  const updateRunConfigCwd = async (value: string): Promise<void> => {
    await vscode.workspace
      .getConfiguration(extConstants.COMMAND_PREFIX)
      .update(configKeys.runConfigCwd, value, vscode.ConfigurationTarget.Workspace);
  };

  const callConfigurationMiddleware = async (
    items: ConfigurationParams['items'],
    next: ConfigurationRequest.HandlerSignature
  ): Promise<unknown[]> => {
    const workspaceMiddleware = getWorkspaceMiddleware();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    try {
      return await workspaceMiddleware.configuration(
        { items },
        cancellationTokenSource.token,
        next
      );
    } finally {
      cancellationTokenSource.dispose();
    }
  };

  const captureDidChangeNotification = async (
    sections: string[] | undefined,
    next: DidChangeConfigurationSignature
  ): Promise<{ calls: number; payload: any | undefined }> => {
    const workspaceMiddleware = getWorkspaceMiddleware();
    const originalSendNotification = client.sendNotification as any;
    let settingsPayload: any | undefined;
    let calls = 0;
    (client.sendNotification as any) = async (method: string, params?: any): Promise<void> => {
      if (method === 'workspace/didChangeConfiguration') {
        settingsPayload = params;
        calls++;
      }

      return originalSendNotification.call(client, method, params);
    };

    try {
      await workspaceMiddleware.didChangeConfiguration(sections, next);
      return { calls, payload: settingsPayload };
    } finally {
      client.sendNotification = originalSendNotification;
    }
  };

  test('Configuration middleware resolves supported config values', async () => {
    await updateRunConfigCwd('${workspaceFolder}');

    const values = await callConfigurationMiddleware(
      [
        { section: runConfigCwdSection },
        { section: 'files.trimTrailingWhitespace' }
      ],
      async (requestedParams) => requestedParams.items.map(item => {
        if (!item.section) {
          return null;
        }

        return vscode.workspace.getConfiguration().get(item.section);
      })
    );

    assert.strictEqual(values[0], assertWorkspace(), 'runConfig.cwd should resolve ${workspaceFolder} before being returned to server');
    assert.strictEqual(values[1], vscode.workspace.getConfiguration().get('files.trimTrailingWhitespace'));
  });

  test('DidChangeConfiguration middleware notifies server with resolved settings', async () => {
    await updateRunConfigCwd('${workspaceFolderBasename}');

    const result = await captureDidChangeNotification(
      [runConfigCwdSection],
      async (_sections: string[] | undefined): Promise<void> => {
        assert.fail('Middleware should directly notify server when sections are provided.');
      }
    );

    assert.strictEqual(result.calls, 1, 'Expected exactly one workspace/didChangeConfiguration notification');
    assert.ok(result.payload, 'Expected workspace/didChangeConfiguration notification payload');
    assert.strictEqual(
      result.payload.settings?.[extConstants.COMMAND_PREFIX]?.runConfig?.cwd,
      path.basename(assertWorkspace()),
      'notification payload should include resolved runConfig.cwd'
    );
  });

  test('Configuration middleware skips entries without usable section', async () => {
    await updateRunConfigCwd('${workspaceFolderBasename}');

    const values = await callConfigurationMiddleware(
      [
        { section: '   ' },
        {},
        { section: runConfigCwdSection }
      ],
      async () => ['ignored-blank', 'ignored-missing', '${workspaceFolderBasename}']
    );

    assert.deepStrictEqual(values, [path.basename(assertWorkspace())]);
  });

  test('DidChangeConfiguration middleware delegates to next when sections are undefined', async () => {
    let nextCalled = false;

    const result = await captureDidChangeNotification(
      undefined,
      async (sections: string[] | undefined): Promise<void> => {
        nextCalled = true;
        assert.strictEqual(sections, undefined, 'Undefined sections should be forwarded to next');
      }
    );

    assert.ok(nextCalled, 'Expected next middleware handler to be called');
    assert.strictEqual(result.calls, 0, 'No server notification should be sent when sections are undefined');
  });
});
