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

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.logging.Level;
import java.util.logging.Logger;
import jdk.jshell.JShell;
import org.eclipse.lsp4j.NotebookDocument;
import static org.netbeans.modules.nbcode.java.notebook.NotebookUtils.checkEmptyString;

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
    private final Map<String, ByteArrayOutputStream> outputStreams = new ConcurrentHashMap<>();
    private final Map<String, ByteArrayOutputStream> errorStreams = new ConcurrentHashMap<>();

    private NotebookSessionManager() {
    }

    public static NotebookSessionManager getInstance() {
        return Singleton.instance;
    }

    private static class Singleton {

        private static final NotebookSessionManager instance = new NotebookSessionManager();
    }

    private CompletableFuture<JShell> jshellBuilder(PrintStream outPrintStream, PrintStream errPrintStream) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                NotebookConfigs.getInstance().getInitialized().get();
            } catch (InterruptedException ex) {
                LOG.log(Level.WARNING, "InterruptedException occurred while getting notebook configs: {0}", ex.getMessage());
            } catch (ExecutionException ex) {
                LOG.log(Level.WARNING, "ExecutionException occurred while getting notebook configs: {0}", ex.getMessage());
            }
            List<String> compilerOptions = getCompilerOptions();
            List<String> remoteOptions = getRemoteVmOptions();
            if (compilerOptions.isEmpty()) {
                return JShell.builder()
                        .out(outPrintStream)
                        .err(errPrintStream)
                        .compilerOptions()
                        .remoteVMOptions()
                        .build();
            } else {
                return JShell.builder()
                        .out(outPrintStream)
                        .err(errPrintStream)
                        .compilerOptions(compilerOptions.toArray(new String[0]))
                        .remoteVMOptions(remoteOptions.toArray(new String[0]))
                        .build();
            }
        });
    }

    public CompletableFuture<JShell> createSession(NotebookDocument notebookDoc) {
        String notebookId = notebookDoc.getUri();

        return sessions.computeIfAbsent(notebookId, (String id) -> {
            ByteArrayOutputStream outStream = new ByteArrayOutputStream();
            ByteArrayOutputStream errStream = new ByteArrayOutputStream();
            outputStreams.put(notebookId, outStream);
            errorStreams.put(notebookId, errStream);

            PrintStream outPrintStream = new PrintStream(outStream, true);
            PrintStream errPrintStream = new PrintStream(errStream, true);
            CompletableFuture<JShell> future = jshellBuilder(outPrintStream, errPrintStream);

            future.thenAccept(jshell -> onJshellInit(notebookId, jshell))
                    .exceptionally(ex -> {
                        LOG.log(Level.SEVERE, "Error creating notebook session: {0}", ex.getMessage());
                        throw new IllegalStateException("Error while creating notebook session");
                    });

            return future;
        });
    }

    private List<String> getCompilerOptions() {
        List<String> compilerOptions = new ArrayList<>();
        String classpath = NotebookConfigs.getInstance().getClassPath();
        String modulePath = NotebookConfigs.getInstance().getModulePath();
        String addModules = NotebookConfigs.getInstance().getAddModules();
        boolean isEnablePreview = NotebookConfigs.getInstance().isEnablePreview();
        String notebookJdkVersion = NotebookConfigs.getInstance().getJdkVersion();

        if (!checkEmptyString(classpath)) {
            compilerOptions.add(CLASS_PATH);
            compilerOptions.add(classpath);
        }
        if (!checkEmptyString(modulePath)) {
            compilerOptions.add(MODULE_PATH);
            compilerOptions.add(modulePath);
        }
        if (!checkEmptyString(addModules)) {
            compilerOptions.add(ADD_MODULES);
            compilerOptions.add(addModules);
        }
        if (isEnablePreview) {
            compilerOptions.add(ENABLE_PREVIEW);
            compilerOptions.add(SOURCE_FLAG);
            compilerOptions.add(notebookJdkVersion);
        }

        return compilerOptions;
    }

    private List<String> getRemoteVmOptions() {
        List<String> remoteOptions = new ArrayList<>();
        String classpath = NotebookConfigs.getInstance().getClassPath();
        String modulePath = NotebookConfigs.getInstance().getModulePath();
        String addModules = NotebookConfigs.getInstance().getAddModules();
        boolean isEnablePreview = NotebookConfigs.getInstance().isEnablePreview();

        if (!checkEmptyString(classpath)) {
            remoteOptions.add(CLASS_PATH);
            remoteOptions.add(classpath);
        }
        if (!checkEmptyString(modulePath)) {
            remoteOptions.add(MODULE_PATH);
            remoteOptions.add(modulePath);
        }
        if (!checkEmptyString(addModules)) {
            remoteOptions.add(ADD_MODULES);
            remoteOptions.add(addModules);
        }
        if (isEnablePreview) {
            remoteOptions.add(ENABLE_PREVIEW);
        }

        return remoteOptions;
    }

    private void onJshellInit(String notebookId, JShell jshell) {
        jshell.onShutdown(shell -> closeSession(notebookId));

        List<String> packages = NotebookConfigs.getInstance().getImplicitImports();
        if (packages != null && !packages.isEmpty()) {
            packages.forEach(pkg -> CodeEval.runCode(jshell, "import " + pkg));
        } else {
            List.of("java.util", "java.io", "java.math")
                    .forEach(pkg -> CodeEval.runCode(jshell, "import " + pkg + ".*"));
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

    public ByteArrayOutputStream getOutputStreamById(String notebookId) {
        return outputStreams.get(notebookId);
    }

    public ByteArrayOutputStream getErrorStreamById(String notebookId) {
        return errorStreams.get(notebookId);
    }

    public void closeSession(String notebookUri) {
        CompletableFuture<JShell> future = sessions.remove(notebookUri);
        JShell jshell = future.getNow(null);
        if (jshell != null) {
            jshell.close();
        }
        outputStreams.remove(notebookUri);
        errorStreams.remove(notebookUri);
    }
}
