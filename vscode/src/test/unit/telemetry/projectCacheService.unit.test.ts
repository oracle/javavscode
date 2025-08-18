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

import { expect } from "chai";
import * as sinon from "sinon";
import { ProjectCacheService } from "../../../telemetry/impl/cache/projectCacheService";
import { ProjectCacheValue } from "../../../telemetry/impl/cache/projectCacheValue";
import { globalState } from "../../../globalState";
import * as utilsModule from "../../../telemetry/impl/cache/utils";
import { describe, it, beforeEach, afterEach } from "mocha";

describe("ProjectCacheService", () => {
    let vscGlobalStateMock: {
        get: sinon.SinonStub;
        update: sinon.SinonStub;
        keys: sinon.SinonStub;
    };
    let getVscGlobalStateStub: sinon.SinonStub;
    let getExtensionContextInfoStub: sinon.SinonStub;

    let projectCacheService: ProjectCacheService;

    beforeEach(() => {
        vscGlobalStateMock = {
            get: sinon.stub(),
            update: sinon.stub().resolves(),
            keys: sinon.stub()
        };

        getVscGlobalStateStub = sinon.stub().returns(vscGlobalStateMock);
        getExtensionContextInfoStub = sinon.stub().returns({ getVscGlobalState: getVscGlobalStateStub });

        sinon.stub(globalState, "getExtensionContextInfo").callsFake(getExtensionContextInfoStub);
        sinon.stub(utilsModule, "removeEntriesOnOverflow").resolves();

        projectCacheService = new ProjectCacheService();
    });

    afterEach(() => {
        sinon.restore();
    });

    describe("get", () => {
        it("should return undefined if key is not present", () => {
            vscGlobalStateMock.get.returns(undefined);
            const result = projectCacheService.get("foo");
            expect(result).to.be.undefined;
        });

        it("should return payload if key is found and update lastUsed", () => {
            const obj = new ProjectCacheValue("payloadTest", Date.now());
            vscGlobalStateMock.get.returns(obj);
            const putSpy = sinon.spy(projectCacheService, "put");

            const result = projectCacheService.get("bar");
            expect(result).to.equal("payloadTest");
            expect(putSpy.calledOnce).to.be.true;
        });

        it("should return undefined if an error is thrown", () => {
            vscGlobalStateMock.get.throws(new Error("Test Error"));
            const result = projectCacheService.get("baz");
            expect(result).to.be.undefined;
        });
    });

    describe("put", () => {
        it("should store value and return true", async () => {
            vscGlobalStateMock.keys.returns([]);
            const val = new ProjectCacheValue("myProject");
            const res = await projectCacheService.put("someKey", val);

            expect(res).to.be.true;
            expect(vscGlobalStateMock.update.calledOnce).to.be.true;
        });

        it("should trigger removeOnOverflow if over MAX_KEYS_SIZE", async () => {
            const val = new ProjectCacheValue("v");
            vscGlobalStateMock.keys.returns(new Array(projectCacheService.MAX_KEYS_SIZE + 1));
            const removeOnOverflowSpy = sinon.spy(projectCacheService, "removeOnOverflow");

            await projectCacheService.put("someKey", val);

            expect(removeOnOverflowSpy.calledOnce).to.be.true;
        });

        it("should return false on exception", async () => {
            vscGlobalStateMock.update.rejects(new Error("Test Put Error"));
            const val = new ProjectCacheValue("v");
            const result = await projectCacheService.put("k", val);
            expect(result).to.be.false;
        });
    });

    describe("removeOnOverflow", () => {
        it("should do nothing if already removing keys", async () => {
            projectCacheService["removingKeys"] = true;
            await projectCacheService.removeOnOverflow();
            expect((utilsModule.removeEntriesOnOverflow as sinon.SinonStub).notCalled).to.be.true;
        });

        it("should call removeEntriesOnOverflow when not already running", async () => {
            projectCacheService["removingKeys"] = false;
            await projectCacheService.removeOnOverflow();

            expect((utilsModule.removeEntriesOnOverflow as sinon.SinonStub).calledOnce).to.be.true;
        });

        it("should recover removingKeys even if error occurs", async () => {
            (utilsModule.removeEntriesOnOverflow as sinon.SinonStub).rejects(new Error("Overflow Error"));
            await projectCacheService.removeOnOverflow();
            expect(projectCacheService["removingKeys"]).to.be.false;
        });
    });

    describe("getUpdatedKey", () => {
        it("should prefix the key with ProjectCacheValue.type", () => {
            const key = "foo";
            const updatedKey = projectCacheService.getUpdatedKey(key);
            expect(updatedKey).to.equal(`${ProjectCacheValue.type}.foo`);
        });
    });
});