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
import { TelemetryConfiguration } from "../config";
import { BaseEvent } from "../events/baseEvent";
import { TelemetryPostResponse } from "./postTelemetry";

export class TelemetryRetry {
    private TELEMETRY_RETRY_CONFIG = TelemetryConfiguration.getInstance().getRetryConfig();
    private timePeriod: number = this.TELEMETRY_RETRY_CONFIG?.baseTimer;
    private timeout?: NodeJS.Timeout | null;
    private numOfAttemptsWhenTimerHits: number = 1;
    private queueCapacity: number = this.TELEMETRY_RETRY_CONFIG?.baseCapacity;
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
        this.timePeriod = this.TELEMETRY_RETRY_CONFIG.baseTimer;
        this.clearTimer();
    }

    private increaseTimePeriod = (): void => {
        if (this.numOfAttemptsWhenTimerHits <= this.TELEMETRY_RETRY_CONFIG.maxRetries) {
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
        const baseDelay = this.TELEMETRY_RETRY_CONFIG.baseTimer *
            Math.pow(this.TELEMETRY_RETRY_CONFIG.backoffFactor, this.numOfAttemptsWhenTimerHits);

        const cappedDelay = Math.min(baseDelay, this.TELEMETRY_RETRY_CONFIG.maxDelayMs);

        const jitterMultiplier = 1 + (Math.random() * 2 - 1) * this.TELEMETRY_RETRY_CONFIG.jitterFactor;

        return Math.floor(cappedDelay * jitterMultiplier);
    };

    private increaseQueueCapacity = (): void => {
        if (this.numOfAttemptsWhenQueueIsFull < this.TELEMETRY_RETRY_CONFIG.maxRetries) {
            this.queueCapacity = this.TELEMETRY_RETRY_CONFIG.baseCapacity *
                Math.pow(this.TELEMETRY_RETRY_CONFIG.backoffFactor, this.numOfAttemptsWhenQueueIsFull);
        }
        throw new Error("Number of retries exceeded");
    }

    private resetQueueCapacity = (): void => {
        this.queueCapacity = this.TELEMETRY_RETRY_CONFIG.baseCapacity;
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