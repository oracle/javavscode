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
import { getCurrentUTCDateInSeconds } from "../utils";
import { BaseEvent } from "./baseEvent";

export interface CloseEventData {
    totalSessionTime: number;
}

export class ExtensionCloseEvent extends BaseEvent<CloseEventData> {
    public static readonly NAME = "close";
    public static readonly ENDPOINT = "/close";
        
    constructor(payload: CloseEventData){
        super(ExtensionCloseEvent.NAME, ExtensionCloseEvent.ENDPOINT, payload);
    }

    public static builder = (activationTime: number): ExtensionCloseEvent => {
        const totalActiveSessionTimeInSeconds = getCurrentUTCDateInSeconds() - activationTime;
        const closeEvent: ExtensionCloseEvent = new ExtensionCloseEvent({
            totalSessionTime: totalActiveSessionTimeInSeconds
        });

        return closeEvent;
    }
}