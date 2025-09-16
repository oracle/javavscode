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

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.netbeans.api.project.Project;
import org.netbeans.modules.nbcode.java.notebook.NotebookSessionManager;
import org.netbeans.modules.nbcode.java.notebook.NotebookUtils;

/**
 *
 * @author atalati
 */
public class CommandHandler {

    private static final Logger LOG = Logger.getLogger(CommandHandler.class.getName());

    public static CompletableFuture<List<String>> openJshellInProjectContext(List<Object> args) {
        LOG.log(Level.FINER, "Request received for opening Jshell instance with project context {0}", args);

        String context = NotebookUtils.getArgument(args, 0, String.class);
        String additionalContext = NotebookUtils.getArgument(args, 1, String.class);
        CompletableFuture<Project> prjFuture;
        
        if (context != null) {
            prjFuture = CompletableFuture.completedFuture(ProjectContext.getProject(context));
        } else {
            Project editorPrj = additionalContext != null ? ProjectContext.getProject(additionalContext) : null;
            prjFuture = editorPrj != null
                    ? ProjectContext.getProject(false, new ProjectContextInfo(editorPrj))
                    : ProjectContext.getProject();
        }
        
        return prjFuture.thenCompose(prj -> {
            if (prj == null) {
                return CompletableFuture.completedFuture(new ArrayList<>());
            }
            return ProjectConfigurationUtils.buildProject(prj)
                    .thenCompose(isBuildSuccess -> {
                        if (isBuildSuccess) {
                            List<String> vmOptions = ProjectConfigurationUtils.launchVMOptions(prj);
                            LOG.log(Level.INFO, "Opened Jshell instance with project context {0}", context);
                            return CompletableFuture.completedFuture(vmOptions);
                        } else {
                            CompletableFuture<List<String>> failed = new CompletableFuture<>();
                            failed.completeExceptionally(new RuntimeException("Build failed"));
                            return failed;
                        }
                    });
        });
    }

    public static CompletableFuture<String> getNotebookProjectMappingPath(List<Object> args) {
        LOG.log(Level.FINER, "Request received for notebook project mapping with args: {0}", args);
        String notebookUri = NotebookUtils.getArgument(args, 0, String.class);
        ProjectContextInfo prjCxtInfo = NotebookSessionManager.getInstance().getNotebookPrjNameContext(notebookUri);
        return ProjectContext.getProject(true, prjCxtInfo)
                .thenApply(prj -> prj == null ? null : prj.getProjectDirectory().getPath());
    }

}
