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
import { BaseCacheValue } from "../../../telemetry/impl/cache/BaseCacheValue";
import { removeEntriesOnOverflow } from "../../../telemetry/impl/cache/utils";

class TestCacheValue extends BaseCacheValue<string> {}

describe("removeEntriesOnOverflow", () => {
  let globalCache: any;
  let setKeysForSyncStub: sinon.SinonStub;

  beforeEach(() => {
    let store: Record<string, BaseCacheValue<string>> = {
      "a": new TestCacheValue("test", "foo", 10),
      "b": new TestCacheValue("test", "bar", 20),
      "c": new TestCacheValue("nonTarget", "foo", 30),
      "d": new TestCacheValue("test", "bar", 5),
      "e": new TestCacheValue("test", "foo", 2)
    };
    setKeysForSyncStub = sinon.stub();
    globalCache = {
      keys: () => Object.keys(store),
      get: (k: string) => store[k],
      update: sinon.stub().callsFake((k: string, v: any) => {
        if (v === undefined) {
          delete store[k];
        } else {
          store[k] = v;
        }
        return Promise.resolve();
      }),
      setKeysForSync: sinon.stub()
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should evict half of the matching cache entries by comparator", async () => {
    const comparator = (a: BaseCacheValue<string>, b: BaseCacheValue<string>) =>
      a.lastUsed - b.lastUsed;

    await removeEntriesOnOverflow(globalCache, "test", comparator);

    expect(globalCache.keys()).to.have.members(["a", "b", "c"]);
    expect(globalCache.get("b")).to.be.an.instanceof(BaseCacheValue);
    expect(globalCache.get("c")).to.be.an.instanceof(BaseCacheValue);
  });

  it("should do nothing if there are not enough entries to evict", async () => {
    sinon.stub(globalCache, "keys").returns(["a", "c"]);
    const comparator = (a: BaseCacheValue<string>, b: BaseCacheValue<string>) => b.lastUsed - a.lastUsed;

    await removeEntriesOnOverflow(globalCache, "test", comparator);

    expect(globalCache.keys()).to.include("a");
    expect(globalCache.keys()).to.include("c");
  });

  it("should not attempt to evict entries of a different type", async () => {
    const comparator = (a: BaseCacheValue<string>, b: BaseCacheValue<string>) => a.lastUsed - b.lastUsed;

    await removeEntriesOnOverflow(globalCache, "otherType", comparator);

    expect(globalCache.keys()).to.have.members(["a", "b", "c", "d", "e"]);
  });

  it("should handle when no entries match the type", async () => {
    const comparator = (a: BaseCacheValue<string>, b: BaseCacheValue<string>) => 0;
    await removeEntriesOnOverflow(globalCache, "absentType", comparator);

    expect(globalCache.keys()).to.have.members(["a", "b", "c", "d", "e"]);
  });
});