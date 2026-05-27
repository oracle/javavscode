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
import { describe, it } from 'mocha';
import { applyRunConfigurationOverrides } from '../../../views/runConfigurationUtils';
import { DebugConfiguration } from 'vscode';

describe('runConfigurationUtils', () => {
    it('leaves the configuration unchanged when no overrides are provided', () => {
        const config = createDebugConfiguration({
            args: '--existing',
            vmArgs: '-Xmx512m',
            env: { EXISTING: '1' },
            cwd: '/existing'
        });

        const updated = applyRunConfigurationOverrides(config, {});

        expect(updated).to.deep.equal(config);
    });

    it('appends launch arguments to an existing string value', () => {
        const config = createDebugConfiguration({
            args: '--existing'
        });

        const updated = applyRunConfigurationOverrides(config, {
            args: '--added'
        });

        expect(updated.args).to.equal('--existing --added');
    });

    it('adds parsed vm arguments into an existing array', () => {
        const existingVmArgs = ['-Xmx512m'];
        const config = createDebugConfiguration({
            vmArgs: existingVmArgs
        });

        const updated = applyRunConfigurationOverrides(config, {
            vmArgs: '-Dfoo=bar "-Dquoted=value here"'
        });

        expect(updated.vmArgs).to.deep.equal([
            '-Xmx512m',
            '-Dfoo=bar',
            '"-Dquoted=value here"'
        ]);

        expect(existingVmArgs).to.deep.equal(['-Xmx512m']);
    });

    it('appends vm arguments to an existing string value', () => {
        const config = createDebugConfiguration({
            vmArgs: '-Xmx512m'
        });

        const updated = applyRunConfigurationOverrides(config, {
            vmArgs: '-Dfoo=bar'
        });

        expect(updated.vmArgs).to.equal('-Xmx512m -Dfoo=bar');
    });

    it('uses new vm arguments as-is when the config has none yet', () => {
        const config = createDebugConfiguration();

        const updated = applyRunConfigurationOverrides(config, {
            vmArgs: '-Dfoo=bar'
        });

        expect(updated.vmArgs).to.equal('-Dfoo=bar');
    });

    it('merges environment variables and ignores malformed entries', () => {
        const config = createDebugConfiguration({
            env: { EXISTING: '1' }
        });

        const updated = applyRunConfigurationOverrides(config, {
            env: ' FIRST = one , invalid, =missingName, SECOND=two=2 '
        });

        expect(updated.env).to.deep.equal({
            EXISTING: '1',
            FIRST: 'one',
            SECOND: 'two=2'
        });
    });

    it('parses environment variables through applyRunConfigurationOverrides', () => {
        const config = createDebugConfiguration();

        const updated = applyRunConfigurationOverrides(config, {
            env: 'A=1, B=two'
        });

        expect(updated.env).to.deep.equal({
            A: '1',
            B: 'two'
        });
    });

    it('overrides existing environment variable keys with new values', () => {
        const config = createDebugConfiguration({
            env: { A: '1', B: '2' }
        });

        const updated = applyRunConfigurationOverrides(config, {
            env: 'B=updated, C=3'
        });

        expect(updated.env).to.deep.equal({
            A: '1',
            B: 'updated',
            C: '3'
        });
    });

    it('creates a fresh env record when the current env is not an object', () => {
        const config = createDebugConfiguration({
            env: 'invalid-env-shape'
        });

        const updated = applyRunConfigurationOverrides(config, {
            env: 'A=1'
        });

        expect(updated.env).to.deep.equal({
            A: '1'
        });
    });

    it('overrides cwd when provided', () => {
        const config = createDebugConfiguration();

        const updated = applyRunConfigurationOverrides(config, {
            cwd: '/tmp/workdir'
        });

        expect(updated.cwd).to.equal('/tmp/workdir');
    });

    it('does not replace existing values with empty-string overrides', () => {
        const config = createDebugConfiguration({
            args: '--existing',
            vmArgs: '-Xmx512m',
            env: { EXISTING: '1' },
            cwd: '/existing'
        });

        const updated = applyRunConfigurationOverrides(config, {
            args: '',
            vmArgs: '',
            env: '',
            cwd: ''
        });

        expect(updated).to.deep.equal({
            type: 'java+',
            name: 'Test Config',
            request: 'launch',
            args: '--existing',
            vmArgs: '-Xmx512m',
            env: { EXISTING: '1' },
            cwd: '/existing'
        });
    });

    it('ignores whitespace-only overrides', () => {
        const config = createDebugConfiguration({
            args: '--existing',
            vmArgs: '-Xmx512m',
            env: { EXISTING: '1' },
            cwd: '/existing'
        });

        const updated = applyRunConfigurationOverrides(config, {
            args: '   ',
            vmArgs: '   ',
            env: '   ',
            cwd: '   '
        });

        expect(updated).to.deep.equal(config);
    });

    it('replaces a non-string args value with the new override', () => {
        const config = createDebugConfiguration({
            args: ['unexpected-array']
        });

        const updated = applyRunConfigurationOverrides(config, {
            args: '--added'
        });

        expect(updated.args).to.equal('--added');
    });
});

const createDebugConfiguration = (overrides: Record<string, unknown> = {}): DebugConfiguration => {
    return {
        type: 'java+',
        name: 'Test Config',
        request: 'launch',
        ...overrides
    };
}
