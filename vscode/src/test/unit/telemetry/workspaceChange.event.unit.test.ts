/*
  Copyright (c) 2025, Oracle and/or its affiliates.

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
import * as crypto from 'crypto';
import { WorkspaceChangeData, WorkspaceChangeEvent } from '../../../telemetry/events/workspaceChange';
import { cacheServiceIndex } from '../../../telemetry/impl/cache';
import { ProjectCacheValue } from '../../../telemetry/impl/cache/projectCacheValue';

describe('WorkspaceChangeEvent', () => {
    let cacheServiceGetStub: sinon.SinonStub;
    let cacheServicePutStub: sinon.SinonStub;
    let randomUUIDStub: sinon.SinonStub;

    beforeEach(() => {
        cacheServiceGetStub = sinon.stub(cacheServiceIndex.projectCache, 'get');
        cacheServicePutStub = sinon.stub(cacheServiceIndex.projectCache, 'put');
        randomUUIDStub = sinon.stub(crypto, 'randomUUID');
    });

    afterEach(() => {
        sinon.restore();
    });

    const buildProject = (id: string, overrides: Partial<WorkspaceChangeData['projectInfo'][0]> = {}) => ({
        id,
        buildTool: 'maven',
        javaVersion: '11',
        isOpenedWithProblems: false,
        isPreviewEnabled: true,
        ...overrides,
    });

    const buildEvent = (project: any): WorkspaceChangeData => ({
        projectInfo: project,
        numProjects: 1,
        lspInitTimeTaken: 100,
        projInitTimeTaken: 200,
    });

    const assertProject = (actual: any, expected: any) => {
        expect(actual.id).to.equal(expected.id);
        expect(actual.buildTool).to.equal(expected.buildTool);
        expect(actual.javaVersion).to.equal(expected.javaVersion);
        expect(actual.isOpenedWithProblems).to.equal(expected.isOpenedWithProblems);
        expect(actual.isPreviewEnabled).to.equal(expected.isPreviewEnabled);
    };

    describe('updateProjectId', () => {
        it('uses cached ID when present', () => {
            const cachedId = 'cached-uuid';
            const oldId = 'old-id';
            const project = buildProject(oldId);
            const payload = buildEvent([project]);

            cacheServiceGetStub.withArgs(oldId).returns(cachedId);

            const event = new WorkspaceChangeEvent(payload);
            const result = event.getPayload;

            expect(result.projectInfo[0].id).to.equal(cachedId);
            sinon.assert.notCalled(cacheServicePutStub);
            sinon.assert.notCalled(randomUUIDStub);
        });

        it('generates UUID and caches it when not in cache', () => {
            const uuid = 'new-uuid';
            const oldId = 'old-id';
            const project = buildProject(oldId);
            const payload = buildEvent([project]);

            cacheServiceGetStub.withArgs(oldId).returns(undefined);
            randomUUIDStub.returns(uuid);
            const event = new WorkspaceChangeEvent(payload);
            const expectedCacheValue = new ProjectCacheValue(uuid);
            const result = event.getPayload;

            expect(result.projectInfo[0].id).to.equal(uuid);
            sinon.assert.calledWith(cacheServicePutStub, oldId, expectedCacheValue);
            assertProject(result.projectInfo[0], { ...project, id: uuid });
        });

        it('handles multiple projects with mixed cache states', () => {
            const projects = [
                buildProject('project-1'),
                buildProject('project-2'),
                buildProject('project-3'),
            ];
            const originalProjects = JSON.parse(JSON.stringify(projects));
            const payload = buildEvent(projects);

            const cached = 'cached-uuid-1';
            const uuid2 = 'new-uuid-2';
            const uuid3 = 'new-uuid-3';

            cacheServiceGetStub.withArgs('project-1').returns(cached);
            cacheServiceGetStub.withArgs('project-2').returns(undefined);
            cacheServiceGetStub.withArgs('project-3').returns(undefined);
            randomUUIDStub.onFirstCall().returns(uuid2).onSecondCall().returns(uuid3);

            const event = new WorkspaceChangeEvent(payload);
            const result = event.getPayload;

            const expected = [
                { ...originalProjects[0], id: cached },
                { ...originalProjects[1], id: uuid2 },
                { ...originalProjects[2], id: uuid3 },
            ];

            expected.forEach((exp, i) => assertProject(result.projectInfo[i], exp));
        });

        it('handles empty projectInfo array', () => {
            const payload: WorkspaceChangeData = {
                projectInfo: [],
                numProjects: 0,
                lspInitTimeTaken: 50,
                projInitTimeTaken: 75,
            };

            const event = new WorkspaceChangeEvent(payload);
            const result = event.getPayload;

            expect(result.projectInfo).to.be.empty;
        });

        it('preserves all other payload properties', () => {
            const uuid = 'preserve-uuid';
            const project = buildProject('preserve-id');
            const payload: WorkspaceChangeData = {
                projectInfo: [project],
                numProjects: 1,
                lspInitTimeTaken: 123,
                projInitTimeTaken: 456,
            };

            cacheServiceGetStub.withArgs('preserve-id').returns(undefined);
            randomUUIDStub.returns(uuid);

            const event = new WorkspaceChangeEvent(payload);
            const result = event.getPayload;

            expect(result.numProjects).to.equal(1);
            expect(result.lspInitTimeTaken).to.equal(123);
            expect(result.projInitTimeTaken).to.equal(456);
            assertProject(result.projectInfo[0], { ...project, id: uuid });
        });

        it('handles null/undefined cache responses gracefully', () => {
            const uuid = 'null-fallback';
            const project = buildProject('null-id');
            const payload = buildEvent([project]);

            cacheServiceGetStub.withArgs('null-id').returns(null);
            randomUUIDStub.returns(uuid);

            const event = new WorkspaceChangeEvent(payload);
            const result = event.getPayload;

            expect(result.projectInfo[0].id).to.equal(uuid);
        });
    });
});
