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

import { Memento } from "vscode";
import { LOGGER } from "../../../logger";
import { BaseCacheValue } from "./BaseCacheValue";

export const removeEntriesOnOverflow = async <T>(globalCache: Memento & {
    setKeysForSync(keys: readonly string[]): void;
},
    type: string,
    comparator: (a: BaseCacheValue<T>, b: BaseCacheValue<T>) => number
) => {
    const allKeys = globalCache.keys();

    const entries: (BaseCacheValue<T> & { key: string })[] = [];

    for (const key of allKeys) {
        const value = globalCache.get<BaseCacheValue<T>>(key);
        if (value?.type === type) {
            entries.push({ key, ...value });
        }
    }

    const half = Math.floor(entries.length / 2);
    entries.sort(comparator);
    const toEvict = entries.slice(0, half);
    LOGGER.debug(toEvict.toString());
    const toEvictPromises: Promise<void>[] = [];
    for (const entry of toEvict) {
        toEvictPromises.push(Promise.resolve(globalCache.update(entry.key, undefined)));
    }
    await Promise.allSettled(toEvictPromises);

    LOGGER.debug(`Evicted ${toEvict.length} least-used cache keys due to overflow.`);
}