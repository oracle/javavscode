/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.netbeans.modules.nbcode.java.project;

import org.netbeans.api.project.Project;
import org.netbeans.api.project.ProjectUtils;

/**
 *
 * @author atalati
 */
public class ProjectContextInfo {

    private final String name;
    private final String path;

    public ProjectContextInfo(Project prj) {
        this.name = ProjectUtils.getInformation(prj).getDisplayName();
        this.path = prj.getProjectDirectory().getPath();
    }

    public String getName() {
        return name;
    }

    public String getPath() {
        return path;
    }
}
