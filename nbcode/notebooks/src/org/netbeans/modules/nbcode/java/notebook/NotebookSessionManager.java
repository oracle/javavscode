/*
 * Copyright (c) 2025-2026, Oracle and/or its affiliates.
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
package org.netbeans.modules.nbcode.java.notebook;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.net.URI;
import java.nio.file.FileSystemNotFoundException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.function.BiConsumer;
import java.util.logging.Level;
import java.util.logging.Logger;
import jdk.jshell.JShell;
import org.eclipse.lsp4j.NotebookDocument;
import org.netbeans.api.project.Project;
import static org.netbeans.modules.nbcode.java.notebook.NotebookUtils.checkEmptyString;
import org.netbeans.modules.nbcode.java.project.ProjectConfigurationUtils;
import org.netbeans.modules.nbcode.java.project.ProjectContext;
import org.netbeans.modules.nbcode.java.project.ProjectContextInfo;
import org.openide.util.NbBundle;

/**
 *
 * @author atalati
 */
@NbBundle.Messages({
    "MSG_JshellResetError=Some internal error occurred while trying to reset notebook session"
})
public class NotebookSessionManager {

    private static final Logger LOG = Logger.getLogger(NotebookSessionManager.class.getName());
    private static final String SOURCE_FLAG = "--source";
    private static final String ENABLE_PREVIEW = "--enable-preview";
    private static final String CLASS_PATH = "--class-path";
    private static final String MODULE_PATH = "--module-path";
    private static final String ADD_MODULES = "--add-modules";
    private static final String USER_DIR_PROP = "-Duser.dir=";

    private final Map<String, CompletableFuture<JShell>> sessions = new ConcurrentHashMap<>();
    private final Map<String, JshellStreamsHandler> jshellStreamsMap = new ConcurrentHashMap<>();
    private final Map<String, ProjectContextInfo> notebookPrjMap = new ConcurrentHashMap<>();

    private NotebookSessionManager() {
    }

    public static NotebookSessionManager getInstance() {
        return Singleton.instance;
    }

    private static class Singleton {

        private static final NotebookSessionManager instance = new NotebookSessionManager();
    }

    private CompletableFuture<JShell> jshellBuilder(String notebookUri, JshellStreamsHandler streamsHandler) {
        return NotebookConfigs.getInstance().getInitialized()
                .thenCompose(v -> getProjectContextForNotebook(notebookUri)
                .thenApply(prj -> {
                    if (prj != null) {
                        notebookPrjMap.put(notebookUri, new ProjectContextInfo(prj));
                    }
                    return jshellBuildWithProject(notebookUri, prj, streamsHandler);
                })).exceptionally(throwable -> {
            LOG.log(Level.WARNING, "Failed to get project context, using default JShell configuration", throwable);
            return jshellBuildWithProject(notebookUri, null, streamsHandler);
        });
    }

    private JShell jshellBuildWithProject(String notebookUri, Project prj, JshellStreamsHandler streamsHandler) {
        List<String> compilerOptions = getCompilerOptions(prj);
        List<String> remoteOptions = getRemoteVmOptions(prj);
        setSystemPropertiesForRemoteVm(remoteOptions, notebookUri);

        JShell.Builder builder = JShell.builder()
                .out(streamsHandler.getPrintOutStream())
                .err(streamsHandler.getPrintErrStream())
                .in(streamsHandler.getInputStream());

        LOG.log(Level.FINE, "Initializing Notebook kernel for {0}", notebookUri);
        LOG.log(Level.FINE, "Compiler options being passed: {0}", compilerOptions);
        LOG.log(Level.FINE, "VM Options being passed to notebook kernel: {0}", remoteOptions);
        if (!compilerOptions.isEmpty()) {
            builder.compilerOptions(compilerOptions.toArray(new String[0]))
                    .remoteVMOptions(remoteOptions.toArray(new String[0]));
        } else if (!remoteOptions.isEmpty()) {
            builder.remoteVMOptions(remoteOptions.toArray(new String[0]));
        }

        return builder.build();
    }

    private void setSystemPropertiesForRemoteVm(List<String> remoteOptions, String notebookUri) {
        try {
            URI uri = URI.create(notebookUri);
            Path parentPath = Path.of(uri).getParent();
            if (parentPath != null && Files.isDirectory(parentPath)) {
                remoteOptions.add(USER_DIR_PROP + parentPath.toString());
                LOG.log(Level.FINE, "Setting user.dir for JShell: {0}", parentPath);
            }
        } catch (IllegalArgumentException | FileSystemNotFoundException e) {
            LOG.log(Level.WARNING, "Could not parse notebook URI to set user.dir: " + notebookUri, e);
        }
    }

    public CompletableFuture<JShell> createSession(NotebookDocument notebookDoc) {
        String notebookId = notebookDoc.getUri();
        return createSession(notebookId);
    }

    public CompletableFuture<JShell> createSession(String notebookId) {
        return sessions.computeIfAbsent(notebookId, id -> {
            JshellStreamsHandler handler = new JshellStreamsHandler(id, CodeEval.getInstance().outStreamFlushCb, CodeEval.getInstance().errStreamFlushCb);
            jshellStreamsMap.put(id, handler);

            CompletableFuture<JShell> future = jshellBuilder(notebookId, handler);

            future.thenAccept(jshell -> onJshellInit(notebookId, jshell))
                    .exceptionally(ex -> {
                        LOG.log(Level.SEVERE, "Error creating notebook session: {0}", ex.getMessage());
                        throw new IllegalStateException("Error while creating notebook session");
                    });

            return future;
        });
    }

    private List<String> getCompilerOptions(Project prj) {
        List<String> compilerOptions = new ArrayList<>();
        NotebookConfigs configs = NotebookConfigs.getInstance();

        BiConsumer<String, String> addOption = (flag, value) -> {
            if (!checkEmptyString(value)) {
                compilerOptions.add(flag);
                compilerOptions.add(value);
            }
        };

        addOption.accept(CLASS_PATH, configs.getClassPath());
        addOption.accept(MODULE_PATH, configs.getModulePath());
        addOption.accept(ADD_MODULES, configs.getAddModules());
        boolean enablePreview = configs.isEnablePreview();

        if (prj != null) {
            List<String> projOptions = ProjectConfigurationUtils.compilerOptions(prj);
            Map<String, String> prjConfigMap = new HashMap<>();
            for (int i = 0; i < projOptions.size() - 1; i += 2) {
                prjConfigMap.put(projOptions.get(i), projOptions.get(i + 1));
            }

            if (checkEmptyString(configs.getClassPath()) && prjConfigMap.containsKey(CLASS_PATH)) {
                addOption.accept(CLASS_PATH, prjConfigMap.get(CLASS_PATH));
            }
            if (checkEmptyString(configs.getModulePath()) && prjConfigMap.containsKey(MODULE_PATH)) {
                addOption.accept(MODULE_PATH, prjConfigMap.get(MODULE_PATH));
            }
            if (checkEmptyString(configs.getAddModules()) && prjConfigMap.containsKey(ADD_MODULES)) {
                addOption.accept(ADD_MODULES, prjConfigMap.get(ADD_MODULES));
            }
            enablePreview = enablePreview || projOptions.contains(ENABLE_PREVIEW);
        }

        if (enablePreview) {
            compilerOptions.add(ENABLE_PREVIEW);
            compilerOptions.add(SOURCE_FLAG);
            compilerOptions.add(configs.getJdkVersion());
        }

        return compilerOptions;
    }

    private List<String> getRemoteVmOptions(Project prj) {
        List<String> remoteOptions = new ArrayList<>();
        NotebookConfigs configs = NotebookConfigs.getInstance();
        boolean enablePreview = configs.isEnablePreview();

        BiConsumer<String, String> addOption = (flag, value) -> {
            if (!checkEmptyString(value)) {
                remoteOptions.add(flag);
                remoteOptions.add(value);
            }
        };

        addOption.accept(CLASS_PATH, configs.getClassPath());
        addOption.accept(MODULE_PATH, configs.getModulePath());
        addOption.accept(ADD_MODULES, configs.getAddModules());

        if (prj != null) {
            List<String> projOptions = ProjectConfigurationUtils.launchVMOptions(prj);
            Map<String, String> prjConfigMap = new HashMap<>();
            for (int i = 0; i < projOptions.size() - 1; i += 2) {
                prjConfigMap.put(projOptions.get(i), projOptions.get(i + 1));
            }

            if (checkEmptyString(configs.getClassPath()) && prjConfigMap.containsKey(CLASS_PATH)) {
                addOption.accept(CLASS_PATH, prjConfigMap.get(CLASS_PATH));
            }
            if (checkEmptyString(configs.getModulePath()) && prjConfigMap.containsKey(MODULE_PATH)) {
                addOption.accept(MODULE_PATH, prjConfigMap.get(MODULE_PATH));
            }
            if (checkEmptyString(configs.getAddModules()) && prjConfigMap.containsKey(ADD_MODULES)) {
                addOption.accept(ADD_MODULES, prjConfigMap.get(ADD_MODULES));
            }
            enablePreview = enablePreview || projOptions.contains(ENABLE_PREVIEW);
        }
        if (enablePreview) {
            remoteOptions.add(ENABLE_PREVIEW);
        }
        
        List<String> extraVmOptions = NotebookConfigs.getInstance().getNotebookVmOptions();
        remoteOptions.addAll(extraVmOptions);
        
        return remoteOptions;
    }

    private void onJshellInit(String notebookId, JShell jshell) {
        jshell.onShutdown(shell -> closeSession(notebookId));

        List<String> elements = NotebookConfigs.getInstance().getImplicitImports();
        if (elements != null && !elements.isEmpty()) {
            elements.forEach(el -> CodeEval.getInstance().runCode(jshell, "import " + el));
        } else {
            List.of("java.util", "java.io", "java.math")
                    .forEach(el -> CodeEval.getInstance().runCode(jshell, "import " + el + ".*"));
        }
    }

    public CompletableFuture<JShell> getSessionFuture(String notebookId) {
        return sessions.get(notebookId);
    }

    public JShell getSession(String notebookId) {
        try {
            CompletableFuture<JShell> future = sessions.get(notebookId);
            if (future == null) {
                return null;
            }
            return future.get();
        } catch (InterruptedException | ExecutionException | CancellationException ex) {
            LOG.log(Level.WARNING, "Error while fetching session for {0}", notebookId);
        }
        return null;
    }

    public JshellStreamsHandler getJshellStreamsHandler(String notebookId) {
        return jshellStreamsMap.get(notebookId);
    }

    public ProjectContextInfo getNotebookPrjNameContext(String notebookId) {
        return notebookPrjMap.get(notebookId);
    }

    public void closeSession(String notebookUri) {
        CompletableFuture<JShell> future = sessions.remove(notebookUri);
        if (future != null) {
            JShell jshell = future.getNow(null);
            if (jshell != null) {
                jshell.close();
            }
            JshellStreamsHandler handler = jshellStreamsMap.remove(notebookUri);
            if (handler != null) {
                handler.close();
            }
            notebookPrjMap.remove(notebookUri);
        }
    }

    private CompletableFuture<Project> getProjectContextForNotebook(String notebookUri) {
        JsonObject mapping = NotebookConfigs.getInstance().getNotebookProjectMapping();

        URI uri = URI.create(notebookUri);
        String path = Path.of(uri).toAbsolutePath().toString();
        JsonElement el = mapping.get(path);

        String value = null;
        if (el != null && el.isJsonPrimitive() && el.getAsJsonPrimitive().isString()) {
            value = Paths.get(el.getAsString()).toUri().toString();
        }

        String projectKey = value != null ? value : notebookUri;

        LOG.log(Level.FINE, "projectKey: {0}", projectKey);
        Project prj = ProjectContext.getProject(projectKey);

        if (prj == null) {
            LOG.log(Level.WARNING, "Project not found or not open in workspace: {0}", projectKey);
            return CompletableFuture.completedFuture(null);
        }

        return ProjectConfigurationUtils.buildProject(prj).thenApply(buildStatus -> {
            if (!buildStatus) {
                LOG.log(Level.WARNING, "Error while building project: {0}", projectKey);
                return null;
            }
            return prj;
        });

    }

    public CompletableFuture<Void> resetSession(String notebookUri) {
        closeSession(notebookUri);
        return createSession(notebookUri)
                .thenApply(jshell -> (Void) null)
                .exceptionally(ex -> {
                    LOG.log(Level.SEVERE, "Error creating new session after reset", ex);
                    throw new CompletionException(Bundle.MSG_JshellResetError(), ex);
                });
    }
}
