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
import { BaseEvent } from "./events/baseEvent";

export interface TelemetryReporter {
    startEvent(): void;

    addEventToQueue(event: BaseEvent<any>): void;

    closeEvent(): void;
}

export interface CacheService {
    get(key: string): string | undefined;

    put(key: string, value: string): boolean;
}

export interface TelemetryEventQueue {
    enqueue(e: BaseEvent<any>): void;

    flush(): BaseEvent<any>[];
}

export interface RetryConfig {
    maxRetries: number;
    baseTimer: number;
    baseCapacity: number;
    maxDelayMs: number;
    backoffFactor: number;
    jitterFactor: number;
}