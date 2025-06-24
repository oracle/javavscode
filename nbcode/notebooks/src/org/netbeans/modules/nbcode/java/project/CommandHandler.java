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

import com.google.gson.JsonPrimitive;
import java.net.MalformedURLException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.netbeans.api.project.FileOwnerQuery;
import org.netbeans.api.project.Project;
import org.netbeans.modules.java.lsp.server.Utils;
import org.openide.filesystems.FileObject;
import org.openide.util.Exceptions;

/**
 *
 * @author atalati
 */
public class CommandHandler {

    private static final Logger LOG = Logger.getLogger(CommandHandler.class.getName());

    public static CompletableFuture<List<String>> openJshellInProjectContext(List<Object> args) {
        CompletableFuture<List<String>> future = new CompletableFuture<>();

        LOG.log(Level.FINER, "Request received for opening Jshell instance with project context {0}", args);

        final String uri = args != null && args.get(0) != null && args.get(0) instanceof JsonPrimitive
                ? ((JsonPrimitive) args.get(0)).getAsString()
                : null;
        
        if (uri == null) {
            future.completeExceptionally(new IllegalArgumentException("uri is required. It cannot be null"));
            return future;
        }
        
        Project prj = getProject(uri);
        if (prj != null) {
            return ProjectConfigurationUtils.buildProject(prj)
                    .thenCompose(isBuildSuccess -> {
                        if (Boolean.TRUE.equals(isBuildSuccess)) {
                            List<String> vmOptions = ProjectConfigurationUtils.launchVMOptions(prj);
                            LOG.log(Level.INFO, "Opened Jshell instance with project context {0}", uri);
                            return CompletableFuture.completedFuture(vmOptions);
                        } else {
                            CompletableFuture<List<String>> failed = new CompletableFuture<>();
                            failed.completeExceptionally(new RuntimeException("Build failed"));
                            return failed;
                        }
                    });
        }

        LOG.log(Level.WARNING, "Cannot open Jshell instance as project is null");
        future.completeExceptionally(new IllegalArgumentException("Project is null for uri: " + uri));
        return future;
    }

    public static boolean openNotebookInProjectContext(List<Object> args) {
        LOG.log(Level.FINER, "Request received for opening Jshell instance with project context {0}", args);

        String uri = null, notebookUri = null;
        if (args != null && !args.isEmpty() && args.get(0) != null && args.get(0) instanceof JsonPrimitive) {
            uri = ((JsonPrimitive) args.get(0)).getAsString();
        }
        if (args != null && args.size() > 1 && args.get(1) != null && args.get(1) instanceof JsonPrimitive) {
            notebookUri = ((JsonPrimitive) args.get(1)).getAsString();
        }
        Project prj = getProject(uri);
        if (prj != null) {
            List<String> remoteVmOptions = ProjectConfigurationUtils.launchVMOptions(prj);
            List<String> compileOptions = ProjectConfigurationUtils.compileOptions(prj);

            LOG.log(Level.INFO, "Opened Notebook instance with project context {0}", uri);
            return true;
        }
        LOG.log(Level.WARNING, "Cannot open Jshell instance as project is null");
        return false;
    }

    public static Project getProject(String uri) {
        try {
            if (uri == null) {
                return null;
            }
            FileObject file = Utils.fromUri(uri);
            Project prj = FileOwnerQuery.getOwner(file);

            return prj;
        } catch (MalformedURLException ex) {
            Exceptions.printStackTrace(ex);
        }
        return null;
    }
}
