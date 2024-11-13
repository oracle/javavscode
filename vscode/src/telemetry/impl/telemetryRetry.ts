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
import { BaseEvent } from "../events/baseEvent";
import { RetryConfig } from "../types";
import { TelemetryPostResponse } from "./postTelemetry";

export class TelemetryRetry {
    private static readonly CONFIG: RetryConfig = {
        maxRetries: 6,
        baseCapacity: 256,
        baseTimer: 5 * 1000, // in milliseconds
        maxDelayMs: 100 * 1000, // in milliseconds
        backoffFactor: 2,
        jitterFactor: 0.25
    };

    private timePeriod: number = TelemetryRetry.CONFIG.baseTimer;
    private timeout?: NodeJS.Timeout | null;
    private numOfAttemptsWhenTimerHits: number = 1;
    private queueCapacity: number = TelemetryRetry.CONFIG.baseCapacity;
    private numOfAttemptsWhenQueueIsFull: number = 1;
    private triggeredDueToQueueOverflow: boolean = false;
    private callbackHandler?: () => {};

    public registerCallbackHandler = (callbackHandler: () => {}): void => {
        this.callbackHandler = callbackHandler;
    }

    public startTimer = (): void => {
        if (!this.callbackHandler) {
            LOGGER.debug("Callback handler is not set for telemetry retry mechanism");
            return;
        }
        if (this.timeout) {
            LOGGER.debug("Overriding current timeout");
        }
        this.timeout = setInterval(this.callbackHandler, this.timePeriod);
    }

    private resetTimerParameters = () => {
        this.numOfAttemptsWhenTimerHits = 1;
        this.timePeriod = TelemetryRetry.CONFIG.baseTimer;
        this.clearTimer();
    }

    private increaseTimePeriod = (): void => {
        if (this.numOfAttemptsWhenTimerHits <= TelemetryRetry.CONFIG.maxRetries) {
            this.timePeriod = this.calculateDelay();
            this.numOfAttemptsWhenTimerHits++;
            return;
        }
        throw new Error("Number of retries exceeded");
    }

    public clearTimer = (): void => {
        if (this.timeout) {
            clearInterval(this.timeout);
            this.timeout = null;
        }
    }

    private calculateDelay = (): number => {
        const baseDelay = TelemetryRetry.CONFIG.baseTimer *
            Math.pow(TelemetryRetry.CONFIG.backoffFactor, this.numOfAttemptsWhenTimerHits);

        const cappedDelay = Math.min(baseDelay, TelemetryRetry.CONFIG.maxDelayMs);

        const jitterMultiplier = 1 + (Math.random() * 2 - 1) * TelemetryRetry.CONFIG.jitterFactor;

        return Math.floor(cappedDelay * jitterMultiplier);
    };

    private increaseQueueCapacity = (): void => {
        if (this.numOfAttemptsWhenQueueIsFull < TelemetryRetry.CONFIG.maxRetries) {
            this.queueCapacity = TelemetryRetry.CONFIG.baseCapacity *
                Math.pow(TelemetryRetry.CONFIG.backoffFactor, this.numOfAttemptsWhenQueueIsFull);
        }
        throw new Error("Number of retries exceeded");
    }

    private resetQueueCapacity = (): void => {
        this.queueCapacity = TelemetryRetry.CONFIG.baseCapacity;
        this.numOfAttemptsWhenQueueIsFull = 1;
        this.triggeredDueToQueueOverflow = false;
    }

    public isQueueOverflow = (queueSize: number): boolean => {
        if (queueSize >= this.queueCapacity) {
            this.triggeredDueToQueueOverflow = true;
            return true;
        }
        return false;
    }

    public eventsToBeEnqueuedAgain = (eventResponses: TelemetryPostResponse): BaseEvent<any>[] => {
        eventResponses.success.forEach(res => {
            res.event.onSuccessPostEventCallback();
        });

        if (eventResponses.failures.length === 0) {
            this.resetQueueCapacity();
            this.resetTimerParameters();
        } else {
            const eventsToBeEnqueuedAgain: BaseEvent<any>[] = [];
            eventResponses.failures.forEach((eventRes) => {
                if (eventRes.statusCode <= 0 || eventRes.statusCode > 500)
                    eventsToBeEnqueuedAgain.push(eventRes.event);
            });

            if (eventsToBeEnqueuedAgain.length) {
                this.triggeredDueToQueueOverflow ?
                    this.increaseQueueCapacity() :
                    this.increaseTimePeriod();
                LOGGER.debug(`Queue max capacity size: ${this.queueCapacity}`);
                LOGGER.debug(`Timer period: ${this.timePeriod}`);
            } else {
                eventResponses.failures.forEach(res => {
                    res.event.onFailPostEventCallback();
                });
            }

            return eventsToBeEnqueuedAgain;
        }

        return [];
    }
}