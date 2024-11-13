/*
  Copyright (c) 2024, Oracle and/or its affiliates.

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
import { CacheService } from "../types";
import { LOGGER } from "../../logger";
import { globalState } from "../../globalState";

class CacheServiceImpl implements CacheService {
    public get = (key: string): string | undefined => {
        try {
            const vscGlobalState = globalState.getExtensionContextInfo().getVscGlobalState();
            return vscGlobalState.get(key);
        } catch (err) {
            LOGGER.error(`Error while retrieving ${key} from cache: ${(err as Error).message}`);
            return undefined;
        }
    }

    public put = (key: string, value: string): boolean => {
        try {
            const vscGlobalState = globalState.getExtensionContextInfo().getVscGlobalState();
            vscGlobalState.update(key, value);
            return true;
        } catch (err) {
            LOGGER.error(`Error while storing ${key} in cache: ${(err as Error).message}`);
            return false;
        }
    }
}

export const cacheService = new CacheServiceImpl();