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
import { LOGGER } from "../../logger";
import { AnonymousIdManager } from "../impl/AnonymousIdManager";
import { cacheService } from "../impl/cacheServiceImpl";
import { getHashCode } from "../utils";

export interface BaseEventPayload {
    vsCodeId: string;
    vscSessionId: string;
}

export abstract class BaseEvent<T> {
    protected _payload: T & BaseEventPayload;
    protected _data: T

    constructor(public readonly NAME: string,
        public readonly ENDPOINT: string,
        data: T
    ) {
        this._data = data;
        this._payload = {
            vsCodeId: AnonymousIdManager.machineId,
            vscSessionId: AnonymousIdManager.sessionId,
            ...data
        };
    }

    get getPayload(): T & BaseEventPayload {
        return this._payload;
    }
    
    get getData(): T {
        return this._data;
    }

    public onSuccessPostEventCallback = async (): Promise<void> => {
        LOGGER.debug(`${this.NAME} sent successfully`);
    }

    public onFailPostEventCallback = async (): Promise<void> => {
        LOGGER.debug(`${this.NAME} send failed`);
    }

    protected addEventToCache = (): void => {
        const dataString = JSON.stringify(this.getData);
        const calculatedHashVal = getHashCode(dataString);
        const isAdded = cacheService.put(this.NAME, calculatedHashVal);
 
        LOGGER.debug(`${this.NAME} added in cache ${isAdded ? "Successfully" : "Unsucessfully"}`);
    }
}