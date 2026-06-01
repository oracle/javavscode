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

import { TrustType } from "../../../configurations/trustWorkspace/types";
import { BaseCacheValue, CacheValueObj } from "./BaseCacheValue";

export class WorkspaceSettingsTrustCacheValue extends BaseCacheValue<TrustType> {
    public static readonly type = "workspaceSettingsTrustDecision";

    constructor(payload: TrustType, lastUsed?: number){
        super(WorkspaceSettingsTrustCacheValue.type, payload, lastUsed);
    }

    public static fromObject(obj: CacheValueObj<TrustType>): WorkspaceSettingsTrustCacheValue {
        if (obj.type !== WorkspaceSettingsTrustCacheValue.type) {
            throw new Error(`Invalid object type for WorkspaceSettingsTrustCacheEntry: received ${obj.type}`);
        }
        return new WorkspaceSettingsTrustCacheValue(obj.payload, obj.lastUsed);
    }
}