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
import { describe, it, beforeEach, afterEach } from "mocha";
import * as globalStateModule from "../../../globalState";
import { SimpleCacheService } from "../../../telemetry/impl/cache/simpleCacheService";

describe("SimpleCacheService", () => {
    let vscGlobalStateMock: {
        get: sinon.SinonStub;
        update: sinon.SinonStub;
    };
    let getVscGlobalStateStub: sinon.SinonStub;
    let getExtensionContextInfoStub: sinon.SinonStub;
    let simpleCacheService: SimpleCacheService;

    beforeEach(() => {
        vscGlobalStateMock = {
            get: sinon.stub(),
            update: sinon.stub().resolves()
        };
        getVscGlobalStateStub = sinon.stub().returns(vscGlobalStateMock);
        getExtensionContextInfoStub = sinon.stub().returns({ getVscGlobalState: getVscGlobalStateStub });

        sinon.stub(globalStateModule.globalState, "getExtensionContextInfo").callsFake(getExtensionContextInfoStub);

        simpleCacheService = new SimpleCacheService();
    });

    afterEach(() => {
        sinon.restore();
    });

    describe("get", () => {
        it("should return the cached value if present", () => {
            vscGlobalStateMock.get.withArgs("foo").returns("bar");
            expect(simpleCacheService.get("foo")).to.equal("bar");
        });

        it("should return undefined if the value is missing", () => {
            vscGlobalStateMock.get.withArgs("foo").returns(undefined);
            expect(simpleCacheService.get("foo")).to.be.undefined;
        });

        it("should return undefined if an error is thrown", () => {
            vscGlobalStateMock.get.throws(new Error("failed"));
            expect(simpleCacheService.get("foo")).to.be.undefined;
        });
    });

    describe("put", () => {
        it("should return true if update succeeds", async () => {
            const res = await simpleCacheService.put("someKey", "someValue");
            expect(res).to.be.true;
            expect(vscGlobalStateMock.update.calledOnceWith("someKey", "someValue")).to.be.true;
        });

        it("should return false if update throws an error", async () => {
            vscGlobalStateMock.update.rejects(new Error("fail"));
            const result = await simpleCacheService.put("a", "b");
            expect(result).to.be.false;
        });
    });
});