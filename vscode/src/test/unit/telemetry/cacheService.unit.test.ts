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
import { globalState } from "../../../globalState";
import { LOGGER } from "../../../logger";
import { describe, it, beforeEach, afterEach } from "mocha";
import { cacheService } from "../../../telemetry/impl/cacheServiceImpl";

describe("CacheServiceImpl", () => {
    let getStub: sinon.SinonStub;
    let updateStub: sinon.SinonStub;
    let loggerErrorStub: sinon.SinonStub;
    let loggerDebugStub: sinon.SinonStub;

    const fakeState = {
        get: (key: string) => `value-${key}`,
        update: async (key: string, value: string) => {},
    };

    beforeEach(() => {
        getStub = sinon.stub(fakeState, "get").callThrough();
        updateStub = sinon.stub(fakeState, "update").resolves();

        sinon.stub(globalState, "getExtensionContextInfo").returns({
            getVscGlobalState: () => fakeState,
        } as any);

        loggerErrorStub = sinon.stub(LOGGER, "error");
        loggerDebugStub = sinon.stub(LOGGER, "debug");
    });

    afterEach(() => {
        sinon.restore();
    });

    describe("get", () => {
        it("should return the cached value for a key", () => {
            const key = "example";
            const value = cacheService.get(key);
            expect(value).to.equal(`value-${key}`);
            expect(getStub.calledOnceWith(key)).to.be.true;
        });

        it("should log and return undefined on error", () => {
            getStub.throws(new Error("key not found error"));

            const result = cacheService.get("notPresent");
            expect(result).to.be.undefined;
            expect(loggerErrorStub.calledOnce).to.be.true;
        });
    });

    describe("put", () => {
        it("should store the value and return true", async () => {
            const key = "example";
            const value = "example-value"
            const result = await cacheService.put(key, value);
            expect(result).to.be.true;
            expect(updateStub.calledOnceWith(key, value)).to.be.true;
            expect(loggerDebugStub.calledOnce).to.be.true;
        });

        it("should log and return false on error", async () => {
            updateStub.rejects(new Error("Error while storing key"));

            const result = await cacheService.put("badKey", "value");
            expect(result).to.be.false;
            expect(loggerErrorStub.calledOnce).to.be.true;
        });
    });
});
