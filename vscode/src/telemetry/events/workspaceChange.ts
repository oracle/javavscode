/*
  Copyright (c) 2024-2025, Oracle and/or its affiliates.

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
import { randomUUID } from "crypto";
import { LOGGER } from "../../logger";
import { Telemetry } from "../telemetry";
import { BaseEvent } from "./baseEvent";
import { cacheServiceIndex } from "../impl/cache";
import { ProjectCacheValue } from "../impl/cache/projectCacheValue";

interface ProjectInfo {
    id: string;
    buildTool: string;
    javaVersion: string;
    isOpenedWithProblems: boolean;
    isPreviewEnabled: boolean;
}

export interface WorkspaceChangeData {
    projectInfo: ProjectInfo[];
    numProjects: number;
    lspInitTimeTaken: number;
    projInitTimeTaken: number;
}

let workspaceChangeEventTimeout: NodeJS.Timeout | null = null;

export class WorkspaceChangeEvent extends BaseEvent<WorkspaceChangeData> {
    public static readonly NAME = "workspaceChange";
    public static readonly ENDPOINT = "/workspaceChange";
    private static readonly propertiesToTransform = ['javaVersion'];

    constructor(payload: WorkspaceChangeData) {
        const updatedPayload: WorkspaceChangeData = WorkspaceChangeEvent.transformPayload(payload);
        super(WorkspaceChangeEvent.NAME, WorkspaceChangeEvent.ENDPOINT, updatedPayload);
    }
    
    private static transformPayload = (payload: WorkspaceChangeData) => {
        const transformedPayload: WorkspaceChangeData = BaseEvent.transformEvent(WorkspaceChangeEvent.propertiesToTransform, payload);
        return WorkspaceChangeEvent.updateProjectId(transformedPayload)
    }

    private static updateProjectId = (payload: WorkspaceChangeData) => {
        const updatedProjectInfo = payload.projectInfo.map(project => {
            const existingId = cacheServiceIndex.projectCache.get(project.id);
            const uniqueId = existingId ?? randomUUID();

            if (!existingId) {
                // Cannot be awaited because the caller is constructor and it cannot be a async call
                cacheServiceIndex.projectCache.put(project.id, new ProjectCacheValue(uniqueId));
            }

            return { ...project, id: uniqueId };
        });

        return { ...payload, projectInfo: updatedProjectInfo };
    }

    public onSuccessPostEventCallback = async (): Promise<void> => {
        LOGGER.debug(`WorkspaceChange event sent successfully`);
        if (workspaceChangeEventTimeout != null) {
            clearTimeout(workspaceChangeEventTimeout);
            workspaceChangeEventTimeout = null;
        }
        workspaceChangeEventTimeout = setTimeout(() => Telemetry.sendTelemetry(this), 60 * 60 * 24 * 1000);
    };
}