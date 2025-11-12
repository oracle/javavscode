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

import java.io.PrintWriter;
import java.io.Writer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiConsumer;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import jdk.jshell.DeclarationSnippet;
import jdk.jshell.Diag;
import jdk.jshell.EvalException;
import jdk.jshell.JShell;
import jdk.jshell.JShellException;
import jdk.jshell.Snippet.SubKind;
import jdk.jshell.SourceCodeAnalysis;
import jdk.jshell.SnippetEvent;
import org.eclipse.lsp4j.MessageParams;
import org.eclipse.lsp4j.MessageType;
import org.netbeans.modules.java.lsp.server.notebook.CellExecutionResult;
import org.netbeans.modules.java.lsp.server.notebook.NotebookCellExecutionProgressResultParams;
import org.netbeans.modules.java.lsp.server.notebook.NotebookCellExecutionProgressResultParams.Builder;
import org.netbeans.modules.java.lsp.server.notebook.NotebookCellExecutionProgressResultParams.EXECUTION_STATUS;
import org.netbeans.modules.java.lsp.server.protocol.NbCodeLanguageClient;
import org.openide.util.NbBundle;
import org.openide.util.RequestProcessor;

/**
 *
 * @author atalati
 */
@NbBundle.Messages({
    "MSG_InterruptCodeCellExecSuccess=Code execution stopped successfully",
    "MSG_InterruptCodeCellInfo=Code execution was interrupted",
    "MSG_NotebookRestartSession=Notebook session unavailable. Please restart the notebook kernel.",
    "LBL_method=method",
    "LBL_variable=variable",
    "LBL_class=class",
    "LBL_enum=enum",
    "LBL_interface=interface",
    "LBL_annotation=annotation interface",
    "# {0} - declaration type and snippet name combination",
    "# {1} - unresolved dependencies list",
    "MSG_UnresolvedDepsRecoverableDefined=Created {0}. However, it cannot be invoked or used or instantiated until {1} is declared",
    "# {0} - declaration type and snippet name combination",
    "# {1} - unresolved dependencies list",
    "MSG_UnresolvedDepsRecoverableNotDefined=Created {0}. However, it cannot be referenced until {1} is declared",
    "MSG_ListCombine=, "
})
public class CodeEval {

    private static final Logger LOG = Logger.getLogger(CodeEval.class.getName());
    private static final String CODE_EXEC_INTERRUPT_SUCCESS_MESSAGE = Bundle.MSG_InterruptCodeCellExecSuccess();
    private static final String CODE_EXEC_INTERRUPTED_MESSAGE = Bundle.MSG_InterruptCodeCellInfo();
    private static final String RESTART_NOTEBOOK_SESSION_MESSAGE = Bundle.MSG_NotebookRestartSession();
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
            throw new IllegalArgumentException("Recevied null arguments");
        }

        String notebookId = NotebookUtils.getArgument(arguments, 0, String.class);

        if (notebookId == null) {
            LOG.warning("Received empty notebookId in interrupt execution request");
            throw new IllegalArgumentException("Empty notebookId received");
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
            NbCodeLanguageClient client = LanguageClientInstance.getInstance().getClient();
            if (client != null) {
                client.showMessage(new MessageParams(MessageType.Error, RESTART_NOTEBOOK_SESSION_MESSAGE));
            }
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
            if (jshell == null) {
                future.completeExceptionally(new IllegalStateException("notebook session not found or closed"));
                return;
            }
            activeCellExecutionMapping.put(notebookId, cellId);
            sendNotification(notebookId, EXECUTION_STATUS.EXECUTING);

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
    
    // Made package-private for easy unit test
    List<String> getCompilationErrors(JShell jshell, SnippetEvent event) {
        List<String> compilationErrors = new ArrayList<>();
        jshell.diagnostics(event.snippet()).forEach(diag -> {
            compilationErrors.addAll(displayableDiagnostic(event.snippet().source(), diag));
        });

        if (event.snippet() instanceof DeclarationSnippet) {
            DeclarationSnippet declSnippet = (DeclarationSnippet) event.snippet();
            List<String> unresolvedDeps = jshell.unresolvedDependencies(declSnippet).toList();
            if (!unresolvedDeps.isEmpty()) {
                String msg = getUnresolvedDependencyMsg(event, declSnippet, unresolvedDeps);
                compilationErrors.add(msg);
            }
        }

        return compilationErrors;
    }

    private String getUnresolvedDependencyMsg(SnippetEvent event, DeclarationSnippet snippet, List<String> unresolvedDeps) {
        String declarationType = getDeclarationType(snippet);
        String prefix = declarationType.isEmpty()
                ? snippet.name()
                : declarationType + " " + snippet.name();

        String dependencies = String.join(Bundle.MSG_ListCombine(), unresolvedDeps);

        if (event.status().isDefined()) {
            return Bundle.MSG_UnresolvedDepsRecoverableDefined(prefix, dependencies);
        }
        return Bundle.MSG_UnresolvedDepsRecoverableNotDefined(prefix, dependencies);
    }

    private String getDeclarationType(DeclarationSnippet snippet) {
        switch (snippet.kind()) {
            case METHOD:
                return Bundle.LBL_method();
            case VAR:
                return Bundle.LBL_variable();
            case TYPE_DECL:
                return getTypeDeclarationType(snippet.subKind());
            default:
                LOG.warning("Cannot find declaration type of the snippet");
                return "";
        }
    }

    private String getTypeDeclarationType(SubKind subKind) {
        switch (subKind) {
            case CLASS_SUBKIND:
                return Bundle.LBL_class();
            case INTERFACE_SUBKIND:
                return Bundle.LBL_interface();
            case ENUM_SUBKIND:
                return Bundle.LBL_enum();
            case ANNOTATION_TYPE_SUBKIND:
                return Bundle.LBL_annotation();
            default:
                LOG.warning("Cannot find declaration sub-type of the snippet");
                return "";
        }
    }

    private List<String> getRuntimeErrors(SnippetEvent event) {
        List<String> runtimeErrors = new ArrayList<>();
        JShellException jshellException = event.exception();
        if (jshellException != null) {
            String msg = jshellException.getMessage();
            boolean msgAdded = false;
            if (msg != null && !msg.isBlank()) {
                runtimeErrors.add(msg);
                msgAdded = true;
            }
            // Getting the exception stacktrace/details:
            // stacktrace for EvalException provides the exception that the snippet code generated
            // stacktrace for non-EvalException is not helpful as it is only internal details
            String stacktrace = jshellException instanceof EvalException
                    ? getStackTrace((EvalException) jshellException)
                    : msgAdded ? "" : jshellException.toString();
            if (!stacktrace.isBlank()) {
                runtimeErrors.add(stacktrace);
            }
        }

        return runtimeErrors;
    }

    private String getStackTrace(EvalException exception) {
        return printStackTrace(null, exception).toString();
    }

    private StringBuilder printStackTrace(StringBuilder output, EvalException exception) {
        StringBuilder sb = printStackTrace(output, (Throwable) exception);

        return correctExceptionName(sb, 0, exception);
    }

    private StringBuilder correctExceptionName(StringBuilder output, int startIndex, EvalException exception) {
        // EvalException has the peculiarity that it replaces the actual cause,
        // while retaining the name, stacktrace and subsequent causes.
        // This is unhelpful since it hides the actual exception in the output.
        // Note: jdk.internal.jshell.tool.JShellTool.displayEvalException() uses
        // elaborate code to perform the user-friendly printing on console.
        String actualName = exception.getExceptionClassName();
        String wrapperName = exception.getClass().getName();
        if (actualName != null && !wrapperName.equals(actualName)) {
            int foundAt = output.indexOf(wrapperName, startIndex);
            if (foundAt >= 0) {
                output.replace(foundAt, foundAt + wrapperName.length(), actualName);
                foundAt += actualName.length();
                if (foundAt < output.length()) {
                    Throwable cause = exception;
                    Throwable cycleDetector = cause;
                    do {
                        cause = cause.getCause();

                        if (cycleDetector != null) {
                            // Check for loops in cause using a tortoise-hare detector.
                            cycleDetector = cycleDetector.getCause();
                            if (cycleDetector != null) {
                                cycleDetector = cycleDetector.getCause();
                                if (cycleDetector == cause) {
                                    cause = null;   // Cycle has been detected; break
                                }
                            }
                        }
                    } while (cause != null && !(cause instanceof EvalException));
                    if (cause != null) {
                        correctExceptionName(output, foundAt, (EvalException) cause);
                    }
                }
            }
        }
        return output;
    }

    private StringBuilder printStackTrace(StringBuilder output, Throwable exception) {
        if (exception == null) {
            return output != null ? output : new StringBuilder(0);
        }
        StringBuilder sb = output != null ? output : new StringBuilder();
        PrintWriter stackWriter = new PrintWriter(new Writer() {
            @Override
            public void write(char[] cbuf, int off, int len) {
                sb.append(cbuf, off, len);
            }

            @Override
            public void flush() {
            }

            @Override
            public void close() {
            }
        });
        exception.printStackTrace(stackWriter);

        return sb;
    }

    private List<String> getSnippetValue(SnippetEvent event) {
        return event.value() != null ? List.of(event.value()) : Collections.emptyList();
    }

    private void flushStreams(String notebookId) {
        JshellStreamsHandler streamHandler = NotebookSessionManager.getInstance().getJshellStreamsHandler(notebookId);
        if (streamHandler != null) {
            streamHandler.flushOutputStreams();
        }
    }

    // Note: This method is taken from jdk.internal.jshell.tool.JShellTool with some simplifications
    private List<String> displayableDiagnostic(String source, Diag diag) {
        List<String> toDisplay = new ArrayList<>();

        for (String line : diag.getMessage(null).split("\\R")) {
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

            Builder b = NotebookCellExecutionProgressResultParams.builder(notebookId, cellId).status(status);
            if (msg == null) {
                if (diags != null) {
                    b.diagnostics(diags);
                } else if (errorDiags != null) {
                    b.errorDiagnostics(errorDiags);
                }
            } else {
                b = isError
                        ? b.errorStream(CellExecutionResult.text(msg))
                        : b.outputStream(CellExecutionResult.text(msg));
            }
            NotebookCellExecutionProgressResultParams params = b.build();
            NbCodeLanguageClient client = LanguageClientInstance.getInstance().getClient();
            if (client != null) {
                client.notifyNotebookCellExecutionProgress(params);
            }
        } catch (Exception ex) {
            LOG.log(Level.SEVERE, "Some error ocurred while sending code eval notification to the client {0}", ex.getMessage());
        }
    }
}
