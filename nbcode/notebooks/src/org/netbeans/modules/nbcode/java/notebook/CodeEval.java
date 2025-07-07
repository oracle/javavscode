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

import jdk.jshell.JShell;
import jdk.jshell.SnippetEvent;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiConsumer;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import jdk.jshell.Diag;
import jdk.jshell.SourceCodeAnalysis;
import org.netbeans.modules.java.lsp.server.notebook.CellExecutionResult;
import org.netbeans.modules.java.lsp.server.notebook.NotebookCellExecutionProgressResultParams;
import org.netbeans.modules.java.lsp.server.notebook.NotebookCellExecutionProgressResultParams.EXECUTION_STATUS;
import org.netbeans.modules.java.lsp.server.protocol.NbCodeLanguageClient;
import org.openide.util.RequestProcessor;

/**
 *
 * @author atalati
 */
public class CodeEval {

    private static final Logger LOG = Logger.getLogger(CodeEval.class.getName());
    private static final String CODE_EXEC_INTERRUPT_SUCCESS_MESSAGE = "Code execution stopped successfully";
    private static final String CODE_EXEC_INTERRUPTED_MESSAGE = "Code execution was interrupted";
    private static final Pattern LINEBREAK = Pattern.compile("\\R");

    private final Map<String, RequestProcessor> codeExecMap = new ConcurrentHashMap<>();
    private final Map<String, List<CompletableFuture<Boolean>>> pendingTasks = new ConcurrentHashMap<>();
    private final Map<String, String> activeCellExecutionMapping = new ConcurrentHashMap<>();

    public static CodeEval getInstance() {
        return Singleton.instance;
    }

    private static class Singleton {

        private static final CodeEval instance = new CodeEval();
    }

    public BiConsumer<String, byte[]> outStreamFlushCb = (notebookId, msg) -> {
        sendNotification(notebookId, msg, EXECUTION_STATUS.EXECUTING, false);
    };

    public BiConsumer<String, byte[]> errStreamFlushCb = (notebookId, msg) -> {
        sendNotification(notebookId, msg, EXECUTION_STATUS.EXECUTING, true);
    };

    public String interrupt(List<Object> arguments) {
        if (arguments == null) {
            LOG.warning("Received null in interrupt execution request");
            return "Arguments list is null";
        }

        String notebookId = NotebookUtils.getArgument(arguments, 0, String.class);

        if (notebookId == null) {
            LOG.warning("Received empty notebookId in interrupt execution request");
            return "Empty notebookId received";
        }

        return interruptCodeExecution(notebookId);
    }

    private String interruptCodeExecution(String notebookId) {
        try {
            JShell jshell = NotebookSessionManager.getInstance().getSession(notebookId);
            String cellId = activeCellExecutionMapping.get(notebookId);
            if (cellId != null) {
                sendNotification(notebookId, cellId, EXECUTION_STATUS.INTERRUPTED);
            }
            flushStreams(notebookId);
            List<CompletableFuture<Boolean>> tasks = pendingTasks.get(notebookId);
            if (tasks != null) {
                tasks.forEach(task -> {
                    if (!task.isDone()) {
                        task.completeExceptionally(new InterruptedException(CODE_EXEC_INTERRUPTED_MESSAGE));
                    }
                });
                tasks.clear();
            }
            if (jshell != null) {
                jshell.stop();
            }
            RequestProcessor executor = codeExecMap.get(notebookId);
            if (executor != null) {
                executor.shutdownNow();
                codeExecMap.remove(notebookId);
            }
            activeCellExecutionMapping.remove(notebookId);

            return CODE_EXEC_INTERRUPT_SUCCESS_MESSAGE;
        } catch (Exception ex) {
            LOG.log(Level.WARNING, "Error during interrupt operation", ex);
            return "Error during interrupt: " + ex.getMessage();
        }
    }

    public CompletableFuture<Boolean> evaluate(List<Object> arguments) {
        if (arguments == null) {
            LOG.warning("Empty arguments received in code cell evaluate request");
            return CompletableFuture.completedFuture(false);
        }

        String notebookId = NotebookUtils.getArgument(arguments, 0, String.class);
        String cellId = NotebookUtils.getArgument(arguments, 1, String.class);
        String sourceCode = NotebookUtils.getArgument(arguments, 2, String.class);

        if (sourceCode == null || notebookId == null || cellId == null) {
            LOG.warning("sourceCode or notebookId or cellId are not present in code cell evaluation request");
            return CompletableFuture.completedFuture(false);
        }

        CompletableFuture<JShell> sessionFuture = NotebookSessionManager.getInstance().getSessionFuture(notebookId);
        if (sessionFuture == null) {
            LOG.warning("notebook session not found");
            return CompletableFuture.completedFuture(false);
        }

        CompletableFuture<Boolean> resultFuture = new CompletableFuture<>();
        pendingTasks.computeIfAbsent(notebookId, k -> new ArrayList<>()).add(resultFuture);

        return sessionFuture.thenCompose(jshell -> {
            sendNotification(notebookId, cellId, EXECUTION_STATUS.QUEUED);
            getCodeExec(notebookId).submit(() -> codeEvalTaskRunnable(resultFuture, jshell, notebookId, cellId, sourceCode));
            return resultFuture;
        });
    }

    private void codeEvalTaskRunnable(CompletableFuture<Boolean> future, JShell jshell, String notebookId, String cellId, String sourceCode) {
        try {
            activeCellExecutionMapping.put(notebookId, cellId);
            sendNotification(notebookId, EXECUTION_STATUS.EXECUTING);

            if (jshell == null) {
                future.completeExceptionally(new ExceptionInInitializerError("notebook session not found or closed"));
                return;
            }

            runCode(jshell, sourceCode, notebookId);
            flushStreams(notebookId);
            sendNotification(notebookId, EXECUTION_STATUS.SUCCESS);

            future.complete(true);
        } catch (Exception e) {
            LOG.log(Level.WARNING, "Exception occurred while code evaluation: " + e.getMessage(), e);
            sendNotification(notebookId, EXECUTION_STATUS.FAILURE);
            future.completeExceptionally(e);
        } finally {
            List<CompletableFuture<Boolean>> tasks = pendingTasks.get(notebookId);
            if (tasks != null) {
                tasks.remove(future);
            }
            activeCellExecutionMapping.remove(notebookId);
        }
    }

    public void runCode(JShell jshell, String code) {
        runCode(jshell, code, null);
    }

    public void runCode(JShell jshell, String code, String notebookId) {
        try {
            SourceCodeAnalysis analysis = jshell.sourceCodeAnalysis();
            List<String> snippets = NotebookUtils.getCodeSnippets(analysis, code);

            for (String snippet : snippets) {
                for (SnippetEvent event : jshell.eval(snippet)) {
                    if (notebookId != null) {
                        sendNotification(notebookId, getRuntimeErrors(event), EXECUTION_STATUS.EXECUTING, true);
                        sendNotification(notebookId, getCompilationErrors(jshell, event), EXECUTION_STATUS.EXECUTING, true);
                        // TODO: Discuss if diagnostics needs to be given to client as part of excutionResult
                        if (false) {
                            sendNotification(notebookId, getSnippetValue(event), EXECUTION_STATUS.EXECUTING, false);
                        }
                    }
                }
            }
        } catch (IllegalStateException e) {
            LOG.log(Level.SEVERE, "Error while evaluation of the code : {0}", e.getMessage());
            throw new IllegalStateException(e);
        }
    }

    private RequestProcessor getCodeExec(String notebookId) {
        return codeExecMap.computeIfAbsent(notebookId, (id) -> {
            return new RequestProcessor("Jshell Code Evaluator for notebookId: " + id, 1, true, true);
        });
    }

    private List<String> getCompilationErrors(JShell jshell, SnippetEvent event) {
        List<String> compilationErrors = new ArrayList<>();
        jshell.diagnostics(event.snippet()).forEach(diag -> {
            compilationErrors.addAll(displayableDiagnostic(event.snippet().source(), diag));
        });

        return compilationErrors;
    }

    private List<String> getRuntimeErrors(SnippetEvent event) {
        List<String> runtimeErrors = new ArrayList<>();
        if (event.exception() != null) {
            if (!event.exception().getMessage().isBlank()) {
                runtimeErrors.add(event.exception().getMessage());
            }
            if (!event.exception().fillInStackTrace().toString().isBlank()) {
                runtimeErrors.add(event.exception().fillInStackTrace().toString());
            }
        }

        return runtimeErrors;
    }

    private List<String> getSnippetValue(SnippetEvent event) {
        List<String> snippetValues = new ArrayList<>();
        if (event.value() != null) {
            snippetValues.add(event.value());
        }

        return snippetValues;
    }

    private void flushStreams(String notebookId) {
        JshellStreamsHandler streamHandler = NotebookSessionManager.getInstance().getJshellStreamsHandler(notebookId);
        if (streamHandler != null) {
            streamHandler.flushOutputStreams();
        }
    }

    // This method is directly taken from JShell tool implementation in jdk with some minor modifications
    private List<String> displayableDiagnostic(String source, Diag diag) {
        List<String> toDisplay = new ArrayList<>();

        for (String line : diag.getMessage(null).split("\\r?\\n")) {
            if (!line.trim().startsWith("location:")) {
                toDisplay.add(line);
            }
        }

        int pstart = (int) diag.getStartPosition();
        int pend = (int) diag.getEndPosition();
        if (pstart < 0 || pend < 0) {
            pstart = 0;
            pend = source.length();
        }
        Matcher m = LINEBREAK.matcher(source);
        int pstartl = 0;
        int pendl = -2;
        while (m.find(pstartl)) {
            pendl = m.start();
            if (pendl >= pstart) {
                break;
            } else {
                pstartl = m.end();
            }
        }
        if (pendl < pstartl) {
            pendl = source.length();
        }
        toDisplay.add(source.substring(pstartl, pendl));

        StringBuilder sb = new StringBuilder();
        int start = pstart - pstartl;
        for (int i = 0; i < start; ++i) {
            sb.append(' ');
        }
        sb.append('^');
        boolean multiline = pend > pendl;
        int end = (multiline ? pendl : pend) - pstartl - 1;
        if (end > start) {
            for (int i = start + 1; i < end; ++i) {
                sb.append('-');
            }
            if (multiline) {
                sb.append("-...");
            } else {
                sb.append('^');
            }
        }

        toDisplay.add(sb.toString());
        return toDisplay;
    }

    private void sendNotification(String notebookId, EXECUTION_STATUS status) {
        sendNotification(notebookId, null, null, null, null, status, false);
    }

    private void sendNotification(String notebookId, String cellId, EXECUTION_STATUS status) {
        sendNotification(notebookId, cellId, null, null, null, status, false);
    }

    private void sendNotification(String notebookId, byte[] msg, EXECUTION_STATUS status, boolean isError) {
        sendNotification(notebookId, null, msg, null, null, status, isError);
    }

    private void sendNotification(String notebookId, List<String> diags, EXECUTION_STATUS status, boolean isError) {
        if (diags.isEmpty()) {
            return;
        }
        if (isError) {
            sendNotification(notebookId, null, null, null, diags, status, false);
        } else {
            sendNotification(notebookId, null, null, diags, null, status, false);
        }
    }

    private void sendNotification(String notebookId, String cellId, byte[] msg, List<String> diags, List<String> errorDiags, EXECUTION_STATUS status, boolean isError) {
        try {
            if (cellId == null) {
                cellId = activeCellExecutionMapping.get(notebookId);
                if (cellId == null) {
                    throw new Exception("Active cell Id not found");
                }
            }

            NotebookCellExecutionProgressResultParams params;
            if (msg == null) {
                if (diags != null) {
                    params = NotebookCellExecutionProgressResultParams
                            .builder(notebookId, cellId)
                            .diagnostics(diags)
                            .status(status)
                            .build();
                } else if (errorDiags != null) {
                    params = NotebookCellExecutionProgressResultParams
                            .builder(notebookId, cellId)
                            .errorDiagnostics(errorDiags)
                            .status(status)
                            .build();
                } else {
                    params = NotebookCellExecutionProgressResultParams
                            .builder(notebookId, cellId)
                            .status(status)
                            .build();
                }
            } else {
                if (isError) {
                    params = NotebookCellExecutionProgressResultParams
                            .builder(notebookId, cellId)
                            .status(status)
                            .errorStream(CellExecutionResult.text(msg))
                            .build();
                } else {
                    params = NotebookCellExecutionProgressResultParams
                            .builder(notebookId, cellId)
                            .status(status)
                            .outputStream(CellExecutionResult.text(msg))
                            .build();
                }
            }

            NbCodeLanguageClient client = LanguageClientInstance.getInstance().getClient();
            if (client != null) {
                client.notifyNotebookCellExecutionProgress(params);
            }
        } catch (Exception ex) {
            LOG.log(Level.SEVERE, "Some error ocurred while sending code eval notification to the client {0}", ex.getMessage());
        }
    }
}
