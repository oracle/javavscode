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
package org.netbeans.modules.nbcode.java.notebook;

import com.google.gson.JsonObject;
import java.net.URI;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CompletableFuture;
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

/**
 *
 * @author atalati
 */
public class NotebookSessionManager {

    private static final Logger LOG = Logger.getLogger(NotebookSessionManager.class.getName());
    private static final String SOURCE_FLAG = "--source";
    private static final String ENABLE_PREVIEW = "--enable-preview";
    private static final String CLASS_PATH = "--class-path";
    private static final String MODULE_PATH = "--module-path";
    private static final String ADD_MODULES = "--add-modules";

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
                    return jshellBuildWithProject(prj, streamsHandler);
                })).exceptionally(throwable -> {
            LOG.log(Level.WARNING, "Failed to get project context, using default JShell configuration", throwable);
            return jshellBuildWithProject(null, streamsHandler);
        });
    }

    private JShell jshellBuildWithProject(Project prj, JshellStreamsHandler streamsHandler) {
        List<String> compilerOptions = getCompilerOptions(prj);
        List<String> remoteOptions = getRemoteVmOptions(prj);

        JShell.Builder builder = JShell.builder()
                .out(streamsHandler.getPrintOutStream())
                .err(streamsHandler.getPrintErrStream())
                .in(streamsHandler.getInputStream());

        if (!compilerOptions.isEmpty()) {
            builder.compilerOptions(compilerOptions.toArray(new String[0]))
                    .remoteVMOptions(remoteOptions.toArray(new String[0]));
        }

        return builder.build();
    }

    public CompletableFuture<JShell> createSession(NotebookDocument notebookDoc) {
        String notebookId = notebookDoc.getUri();

        return sessions.computeIfAbsent(notebookId, id -> {
            JshellStreamsHandler handler = new JshellStreamsHandler(id, CodeEval.getInstance().outStreamFlushCb, CodeEval.getInstance().errStreamFlushCb);
            jshellStreamsMap.put(id, handler);

            CompletableFuture<JShell> future = jshellBuilder(notebookDoc.getUri(), handler);

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

        if (configs.isEnablePreview()) {
            compilerOptions.add(ENABLE_PREVIEW);
            compilerOptions.add(SOURCE_FLAG);
            compilerOptions.add(configs.getJdkVersion());
        }

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
        }

        return compilerOptions;
    }

    private List<String> getRemoteVmOptions(Project prj) {
        List<String> remoteOptions = new ArrayList<>();
        NotebookConfigs configs = NotebookConfigs.getInstance();
        boolean isEnablePreview = configs.isEnablePreview();

        BiConsumer<String, String> addOption = (flag, value) -> {
            if (!checkEmptyString(value)) {
                remoteOptions.add(flag);
                remoteOptions.add(value);
            }
        };

        addOption.accept(CLASS_PATH, configs.getClassPath());
        addOption.accept(MODULE_PATH, configs.getModulePath());
        addOption.accept(ADD_MODULES, configs.getAddModules());

        if (isEnablePreview) {
            remoteOptions.add(ENABLE_PREVIEW);
        }

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
        }
        return remoteOptions;
    }

    private void onJshellInit(String notebookId, JShell jshell) {
        jshell.onShutdown(shell -> closeSession(notebookId));

        List<String> packages = NotebookConfigs.getInstance().getImplicitImports();
        if (packages != null && !packages.isEmpty()) {
            packages.forEach(pkg -> CodeEval.getInstance().runCode(jshell, "import " + pkg));
        } else {
            List.of("java.util", "java.io", "java.math")
                    .forEach(pkg -> CodeEval.getInstance().runCode(jshell, "import " + pkg + ".*"));
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

    private CompletableFuture<Project> getProjectContextForNotebook(String notebookUri) {
        JsonObject mapping = NotebookConfigs.getInstance().getNotebookProjectMapping();
        String notebookPath = URI.create(notebookUri).getPath();
        String projectKey = mapping.has(notebookPath)
                ? Paths.get(mapping.get(notebookPath).getAsString()).toUri().toString()
                : notebookUri;

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
}
