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
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.logging.Level;
import java.util.logging.Logger;
import jdk.jshell.JShell;
import org.eclipse.lsp4j.NotebookDocument;

/**
 *
 * @author atalati
 */
public class NotebookSessionManager {

    private static final Logger LOGGER = Logger.getLogger(NotebookSessionManager.class.getName());
    private final Map<String, JShell> sessions = new ConcurrentHashMap<>();
    private final Map<String, ByteArrayOutputStream> outputStreams = new ConcurrentHashMap<>();
    private final Map<String, ByteArrayOutputStream> errorStreams = new ConcurrentHashMap<>();
    private static final String SOURCE_FLAG = "--source";
    private static final String ENABLE_PREVIEW = "--enable-preview";

    private NotebookSessionManager() {
    }

    public static NotebookSessionManager getInstance() {
        return Singleton.instance;
    }

    private static class Singleton {

        private static final NotebookSessionManager instance = new NotebookSessionManager();
    }

    private JShell jshellBuilder(PrintStream outPrintStream, PrintStream errPrintStream) throws InterruptedException, ExecutionException {
        List<String> compilerOptions = new ArrayList<>();
        List<String> remoteOptions = new ArrayList<>();

        boolean isEnablePreview = true;
        if (isEnablePreview) {
            compilerOptions.add(ENABLE_PREVIEW);
        }

        String notebookJdkVersion = NotebookConfigs.getInstance().getJdkVersion();
        if (notebookJdkVersion == null) {
            notebookJdkVersion = System.getProperty("java.version").split("\\.")[0];
        }

        compilerOptions.addAll(List.of(SOURCE_FLAG, notebookJdkVersion));

        return JShell.builder()
                .out(outPrintStream)
                .err(errPrintStream)
                .compilerOptions(compilerOptions.toArray(new String[0]))
                .remoteVMOptions(remoteOptions.toArray(new String[0]))
                .build();
    }

    public void createSession(NotebookDocument notebookDoc) {
        String notebookId = notebookDoc.getUri();

        sessions.computeIfAbsent(notebookId, (String id) -> {
            try {
                ByteArrayOutputStream outStream = new ByteArrayOutputStream();
                ByteArrayOutputStream errStream = new ByteArrayOutputStream();
                outputStreams.put(id, outStream);
                errorStreams.put(id, errStream);

                PrintStream outPrintStream = new PrintStream(outStream, true);
                PrintStream errPrintStream = new PrintStream(errStream, true);

                JShell jshell = jshellBuilder(outPrintStream, errPrintStream);
                jshell.onShutdown(shell -> closeSession(notebookId));

                boolean implicitImports = true;
                if (implicitImports) {
                    List.of("java.util", "java.io", "java.math")
                            .forEach(pkg -> CodeEval.runCode(jshell, "import " + pkg + ".*"));
                }

                return jshell;
            } catch (IllegalStateException | InterruptedException | ExecutionException e) {
                LOGGER.log(Level.SEVERE, "Error creating notebook session: {0}", e.getMessage());
                throw new IllegalStateException("Error while creating notebook session");
            }
        });
    }

    public JShell getSession(String notebookId) {
        return sessions.get(notebookId);
    }

    public ByteArrayOutputStream getOutputStreamById(String notebookId) {
        return outputStreams.get(notebookId);
    }

    public ByteArrayOutputStream getErrorStreamById(String notebookId) {
        return errorStreams.get(notebookId);
    }

    public void closeSession(String notebookUri) {
        JShell jshell = sessions.remove(notebookUri);
        if (jshell != null) {
            jshell.close();
        }
        outputStreams.remove(notebookUri);
        errorStreams.remove(notebookUri);
    }
}
