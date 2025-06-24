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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Level;
import java.util.logging.Logger;
import jdk.jshell.JShell;
import jdk.jshell.SourceCodeAnalysis;
import org.eclipse.lsp4j.CompletionItem;
import org.eclipse.lsp4j.CompletionList;
import org.eclipse.lsp4j.CompletionParams;
import org.eclipse.lsp4j.Position;
import org.eclipse.lsp4j.jsonrpc.messages.Either;

/**
 *
 * @author atalati
 */
public class CodeCompletionProvider {
    private static final Logger LOG = Logger.getLogger(CodeCompletionProvider.class.getName());

    private CodeCompletionProvider() {
    }

    public static CodeCompletionProvider getInstance() {
        return Singleton.instance;
    }

    private static class Singleton {

        private static final CodeCompletionProvider instance = new CodeCompletionProvider();
    }

    public CompletableFuture<Either<List<CompletionItem>, CompletionList>> getCodeCompletions(CompletionParams params, NotebookDocumentStateManager state, JShell instance) {
        try {
            if (instance == null || state == null) {
                return CompletableFuture.completedFuture(Either.<List<CompletionItem>, CompletionList>forLeft(new ArrayList<>()));
            }
            String uri = params.getTextDocument().getUri();
            CellState cellState = state.getCell(uri);
            String content = cellState.getContent();

            Position position = params.getPosition();
            int cursorOffset = NotebookUtils.getOffset(content, position);

            String inputText = content.substring(0, cursorOffset);

            SourceCodeAnalysis sourceAnalysis = instance.sourceCodeAnalysis();
            int[] anchor = new int[1];

            sourceAnalysis.analyzeCompletion(inputText);
            // Need to get snippets because JShell doesn't provide suggestions sometimes if import statement is there in the cell
            String finalString = getSnippets(sourceAnalysis, inputText).getLast();
            finalString = finalString.charAt(finalString.length() - 1) == ';' ? finalString.substring(0, finalString.length() - 1) : finalString;

            List<SourceCodeAnalysis.Suggestion> suggestions = sourceAnalysis.completionSuggestions(
                    finalString, finalString.length(), anchor);

            List<CompletionItem> completionItems = new ArrayList<>();
            Map<String, Boolean> visited = new HashMap<>();

            for (SourceCodeAnalysis.Suggestion suggestion : suggestions) {
                if (visited.containsKey(suggestion.continuation())) {
                    continue;
                }

                CompletionItem item = new CompletionItem();
                item.setLabel(suggestion.continuation());

                if (!suggestion.continuation().isEmpty()) {
                    item.setDocumentation(suggestion.continuation());
                }

                completionItems.add(item);
                visited.put(suggestion.continuation(), Boolean.TRUE);
            }

            return CompletableFuture.completedFuture(Either.<List<CompletionItem>, CompletionList>forLeft(completionItems));
        } catch (Exception e) {
            LOG.log(Level.WARNING, "Error getting code completions: {0}", e.getMessage());
            return CompletableFuture.completedFuture(Either.<List<CompletionItem>, CompletionList>forLeft(new ArrayList<>()));
        }
    }

    private List<String> getSnippets(SourceCodeAnalysis analysis, String code) {
        String codeRemaining = code.trim();

        List<String> codeSnippets = new ArrayList<>();
        while (!codeRemaining.isEmpty()) {
            SourceCodeAnalysis.CompletionInfo info = analysis.analyzeCompletion(codeRemaining);
            if (info.completeness().isComplete()) {
                codeSnippets.add(info.source());
            } else {
                codeSnippets.add(codeRemaining);
                break;
            }
            codeRemaining = info.remaining().trim();
        }

        return codeSnippets;
    }
}
