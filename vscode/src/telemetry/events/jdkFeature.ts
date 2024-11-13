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
import { BaseEvent } from "./baseEvent";

export interface JdkFeatureEventData {
    jeps: number[];
    names: string[];
    javaVersion: string;
    isPreviewEnabled: boolean;
}

export class JdkFeatureEvent extends BaseEvent<JdkFeatureEventData> {
    public static readonly NAME = "jdkFeature";
    public static readonly ENDPOINT = "/jdkFeature";

    constructor(payload: JdkFeatureEventData) {
        super(JdkFeatureEvent.NAME, JdkFeatureEvent.ENDPOINT, payload);
    }

    public static concatEvents(events:JdkFeatureEvent[]): JdkFeatureEvent[] {
        const jdkFeatureEvents = events.filter(event => event.NAME === this.NAME);
        const { previewEnabledMap, previewDisabledMap } = this.groupEvents(jdkFeatureEvents);
        
        return [
            ...this.createEventsFromMap(previewEnabledMap, true),
            ...this.createEventsFromMap(previewDisabledMap, false)
        ];
    }

    private static createEventsFromMap(
        map: Map<string, JdkFeatureEvent[]>, 
        isPreviewEnabled: boolean
    ): JdkFeatureEvent[] {
        return Array.from(map.entries()).map(([javaVersion, events]) => {
            const jeps: number[] = [];
            const names: string[] = [];
            
            events.forEach(event => {
                jeps.push(...event.getPayload.jeps);
                names.push(...event.getPayload.names);
            });

            return new JdkFeatureEvent({
                jeps,
                names,
                javaVersion,
                isPreviewEnabled
            });
        });
    }

    private static groupEvents(jdkFeatureEvents: JdkFeatureEvent[]) {
        return jdkFeatureEvents.reduce((acc, event) => {
            const { isPreviewEnabled, javaVersion } = event.getPayload;
            const targetMap = isPreviewEnabled ? acc.previewEnabledMap : acc.previewDisabledMap;
            
            if (!targetMap.has(javaVersion)) {
                targetMap.set(javaVersion, []);
            }
            targetMap.get(javaVersion)!.push(event);
            
            return acc;
        }, {
            previewEnabledMap: new Map<string, JdkFeatureEvent[]>(),
            previewDisabledMap: new Map<string, JdkFeatureEvent[]>()
        });
    }
}