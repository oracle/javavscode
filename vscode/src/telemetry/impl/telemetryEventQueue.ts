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
import { BaseEvent } from "../events/baseEvent";

export class TelemetryEventQueue { 
  private events: BaseEvent<any>[] = [];

  public enqueue = (e: BaseEvent<any>): void => {
    this.events.push(e);
  }

  public dequeue = (): BaseEvent<any> | undefined => this.events.shift();

  public concatQueue = (queue: BaseEvent<any>[], mergeAtStarting = false): void => {
    this.events = mergeAtStarting ? [...queue, ...this.events] : [...this.events, ...queue];
  }

  public size = (): number => this.events.length;

  public flush = (): BaseEvent<any>[] => {
    const queue = [...this.events];
    this.events = [];
    return queue;
  }
}