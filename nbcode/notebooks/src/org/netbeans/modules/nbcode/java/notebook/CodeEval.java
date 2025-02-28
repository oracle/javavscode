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
import com.google.gson.JsonPrimitive;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;
import jdk.jshell.SourceCodeAnalysis;

/**
 *
 * @author atalati
 */
public class CodeEval {

    private static final Logger LOG = Logger.getLogger(CodeEval.class.getName());

    public static List<ResultEval> evaluate(List<Object> arguments) {
        if (arguments != null) {
            String sourceCode = null, notebookId = null;
            if (arguments.get(0) != null && arguments.get(0) instanceof JsonPrimitive) {
                sourceCode = ((JsonPrimitive) arguments.get(0)).getAsString();
            }
            if (arguments.size() > 1 && arguments.get(1) != null && arguments.get(1) instanceof JsonPrimitive) {
                notebookId = ((JsonPrimitive) arguments.get(1)).getAsString();
            }
            if (sourceCode != null && notebookId != null) {
                JShell jshell = NotebookSessionManager.getInstance().getSession(notebookId);

                ByteArrayOutputStream outputStream = NotebookSessionManager.getInstance().getOutputStreamById(notebookId);
                ByteArrayOutputStream errorStream = NotebookSessionManager.getInstance().getErrorStreamById(notebookId);

                if (jshell == null) {
                    throw new ExceptionInInitializerError("Error creating session for notebook");
                }

                return runCode(jshell, sourceCode, outputStream, errorStream, true);
            }
            LOG.warning("sourceCode or notebookId are not present in code cell evaluation request");
        } else {
            LOG.warning("Empty arguments recevied in code cell evaluate request");
        }

        return new ArrayList<>();
    }

    public static List<ResultEval> runCode(JShell jshell, String code) {
        List<ResultEval> results = new ArrayList<>();
        try {
            List<SnippetEvent> events = jshell.eval(code);
            events.forEach(event -> {
                if (event.value() != null && !event.value().isEmpty()) {
                    results.add(ResultEval.text(event.value()));
                }
                if (event.exception() != null) {
                    results.add(ResultEval.text(event.exception().getMessage()));
                }
            });
        } catch (Exception e) {
            LOG.log(Level.SEVERE, "Error while executing code in JShell instance {0}", e.getMessage());
        }
        return results;
    }

    public static List<ResultEval> runCode(JShell jshell, String code, ByteArrayOutputStream outStream, ByteArrayOutputStream errStream, boolean getVariableValues) {
        List<ResultEval> results = new ArrayList<>();
        try {
            String codeLeftToEval = code.trim();
            while (!codeLeftToEval.isEmpty()) {
                SourceCodeAnalysis analysis = jshell.sourceCodeAnalysis();
                SourceCodeAnalysis.CompletionInfo info = analysis.analyzeCompletion(codeLeftToEval);
                if (info.completeness().isComplete()) {
                    for (SnippetEvent event : jshell.eval(info.source())) {
                        if (event.exception() != null) {
                            results.add(ResultEval.text(event.exception().getMessage()));
                        } else if (event.value() != null && getVariableValues) {
                            results.add(ResultEval.text(event.value()));
                        }

                        jshell.diagnostics(event.snippet()).forEach(diag
                                -> results.add(ResultEval.text(diag.getMessage(null)))
                        );

                        flushStreams(results, outStream, errStream);
                    }
                } else {
                    results.add(ResultEval.text("Code snippet is incomplete"));
                }
                codeLeftToEval = info.remaining();
            }
        } catch (Exception e) {
            LOG.log(Level.SEVERE, "Error while evaluation of the code : {0}", e.getMessage());
            results.add(ResultEval.text(("Evaluation error: " + e.getMessage())));
        }
        return results;
    }

    private static void flushStreams(List<ResultEval> results, ByteArrayOutputStream out, ByteArrayOutputStream err) {
        if (out.size() > 0) {
            results.add(ResultEval.text(out.toString()));
            out.reset();
        }
        if (err.size() > 0) {
            results.add(ResultEval.text(err.toString()));
            err.reset();
        }
    }
}
