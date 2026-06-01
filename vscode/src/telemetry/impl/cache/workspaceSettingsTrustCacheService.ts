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
import { CacheService } from "../../types";
import { LOGGER } from "../../../logger";
import { globalState } from "../../../globalState";
import { WorkspaceSettingsTrustCacheValue } from "./workspaceSettingsTrustCacheValue";
import { TrustType } from "../../../configurations/trustWorkspace/types";

export class WorkspaceSettingsTrustCacheService implements CacheService<WorkspaceSettingsTrustCacheValue, TrustType> {
    public get = (key: string) => {
        try {
            const updatedKey = this.getUpdatedKey(key);
            const vscGlobalState = globalState.getExtensionContextInfo().getVscGlobalState();

            const value = vscGlobalState.get<WorkspaceSettingsTrustCacheValue>(updatedKey);
            if (value) {
                this.put(updatedKey, WorkspaceSettingsTrustCacheValue.fromObject({ ...value, lastUsed: Date.now() }));
            }

            return value?.payload;
        } catch (err) {
            LOGGER.error(`Error while retrieving ${key} from cache: ${(err as Error).message}`);
            return undefined;
        }
    }

    public put = async (key: string, value: WorkspaceSettingsTrustCacheValue) => {
        try {
            const updatedKey = this.getUpdatedKey(key);
            const vscGlobalState = globalState.getExtensionContextInfo().getVscGlobalState();

            await vscGlobalState.update(updatedKey, value);
            LOGGER.debug(`Updating key: ${key} to ${value}`);

            return true;
        } catch (err) {
            LOGGER.error(`Error while storing ${key} in cache: ${(err as Error).message}`);
            return false;
        }
    }

    // for unit tests needs to be public
    public getUpdatedKey = (key: string) => `${WorkspaceSettingsTrustCacheValue.type}.${key}`;
}