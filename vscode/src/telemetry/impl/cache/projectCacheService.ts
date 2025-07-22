/*
  Copyright (c) 2024-2025, Oracle and/or its affiliates.

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
import { isError } from "../../../utils";
import { removeEntriesOnOverflow } from "./utils";
import { ProjectCacheValue } from "./projectCacheValue";

export class ProjectCacheService implements CacheService<ProjectCacheValue, String> {
    readonly MAX_KEYS_SIZE: number = 5000;
    private removingKeys: boolean = false;

    public get = (key: string) => {
        try {
            const updatedKey = this.getUpdatedKey(key);
            const vscGlobalState = globalState.getExtensionContextInfo().getVscGlobalState();

            const value = vscGlobalState.get<ProjectCacheValue>(updatedKey);
            if (value) {
                this.put(updatedKey, ProjectCacheValue.fromObject({ ...value, lastUsed: Date.now() }));
            }

            return value?.payload;
        } catch (err) {
            LOGGER.error(`Error while retrieving ${key} from cache: ${(err as Error).message}`);
            return undefined;
        }
    }

    public put = async (key: string, value: ProjectCacheValue) => {
        try {
            const updatedKey = this.getUpdatedKey(key);
            const vscGlobalState = globalState.getExtensionContextInfo().getVscGlobalState();

            await vscGlobalState.update(updatedKey, value);
            if (vscGlobalState.keys().length > this.MAX_KEYS_SIZE) {
                this.removeOnOverflow();
            }
            LOGGER.debug(`Updating key: ${key} to ${value}`);

            return true;
        } catch (err) {
            LOGGER.error(`Error while storing ${key} in cache: ${(err as Error).message}`);
            return false;
        }
    }

    public removeOnOverflow = async () => {
        try {
            if (this.removingKeys) {
                LOGGER.log("Ignoring removing keys request, since it is already in progress");
                return;
            }
            this.removingKeys = true;

            const vscGlobalState = globalState.getExtensionContextInfo().getVscGlobalState();
            const comparator = (a: ProjectCacheValue, b: ProjectCacheValue) => (a.lastUsed - b.lastUsed);

            await removeEntriesOnOverflow(vscGlobalState, ProjectCacheValue.type, comparator);
        } catch (error) {
            LOGGER.error("Some error occurred while removing keys " + (isError(error) ? error.message : error));
        } finally {
            this.removingKeys = false;
        }
    }

    // for unit tests needs to be public
    public getUpdatedKey = (key: string) => `${ProjectCacheValue.type}.${key}`;
}