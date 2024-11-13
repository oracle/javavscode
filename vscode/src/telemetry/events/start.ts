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
import { globalState } from "../../globalState";
import { LOGGER } from "../../logger";
import { cacheService } from "../impl/cacheServiceImpl";
import { getEnvironmentInfo } from "../impl/enviromentDetails";
import { getHashCode } from "../utils";
import { BaseEvent } from "./baseEvent";

interface ExtensionInfo {
    id: string;
    name: string;
    version: string;
}

interface VscodeInfo {
    version: string;
    hostType: string;
    locale: string;
}

interface PlatformInfo {
    os: string;
    arch: string;
    osVersion: string;
}

interface LocationInfo {
    timeZone: string;
    locale: string;
}

export interface StartEventData {
    extension: ExtensionInfo;
    vsCode: VscodeInfo;
    platform: PlatformInfo;
    location: LocationInfo;
}

export class ExtensionStartEvent extends BaseEvent<StartEventData> {
    public static readonly NAME = "startup";
    public static readonly ENDPOINT = "/start";

    constructor(payload: StartEventData) {
        super(ExtensionStartEvent.NAME, ExtensionStartEvent.ENDPOINT, payload);
    }

    onSuccessPostEventCallback = async (): Promise<void> => {
        this.addEventToCache();
    }

    public static builder = async (): Promise<ExtensionStartEvent | null> => {
        const startEventData = getEnvironmentInfo(globalState.getExtensionContextInfo());
        const cachedValue: string | undefined = await cacheService.get(this.NAME);
        const envString = JSON.stringify(startEventData);
        const newValue = getHashCode(envString);

        if (cachedValue != newValue) {
            const startEvent: ExtensionStartEvent = new ExtensionStartEvent(startEventData);
            return startEvent;
        }

        LOGGER.debug(`No change in start event`);
        
        return null;
    }
}
