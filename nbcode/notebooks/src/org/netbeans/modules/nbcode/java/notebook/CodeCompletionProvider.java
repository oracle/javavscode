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
import java.util.HashSet;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Level;
import java.util.logging.Logger;
import jdk.jshell.JShell;
import jdk.jshell.SourceCodeAnalysis;
import jdk.jshell.SourceCodeAnalysis.Suggestion;
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

    public CompletableFuture<Either<List<CompletionItem>, CompletionList>> getCodeCompletions(
            CompletionParams params,
            NotebookDocumentStateManager state,
            JShell instance) {

        return CompletableFuture.supplyAsync(() -> {
            try {
                if (instance == null || state == null) {
                    return Either.<List<CompletionItem>, CompletionList>forLeft(new ArrayList<>());
                }

                SourceCodeAnalysis sourceCodeAnalysis = instance.sourceCodeAnalysis();
                List<Suggestion> suggestions = getSuggestions(
                        params.getTextDocument().getUri(),
                        params.getPosition(),
                        state,
                        sourceCodeAnalysis
                );

                List<CompletionItem> completionItems = new ArrayList<>();
                HashSet<String> visited = new HashSet<>();

                for (Suggestion suggestion : suggestions) {
                    String continuation = suggestion.continuation();
                    if (visited.add(continuation)) {
                        completionItems.add(createCompletionItem(continuation));
                    }
                }

                return Either.<List<CompletionItem>, CompletionList>forLeft(completionItems);

            } catch (Exception e) {
                LOG.log(Level.WARNING, "Error getting code completions: {0}", e.toString());
                return Either.<List<CompletionItem>, CompletionList>forLeft(new ArrayList<>());
            }
        });
    }

    private CompletionItem createCompletionItem(String label) {
        CompletionItem item = new CompletionItem();
        item.setLabel(label);

        return item;
    }

    private List<Suggestion> getSuggestions(String uri, Position position, NotebookDocumentStateManager state, SourceCodeAnalysis sourceCodeAnalysis) {
        CellState cellState = state.getCell(uri);
        String content = cellState.getContent();
        int cursorOffset = NotebookUtils.getOffset(content, position);
        int[] anchor = new int[1];
        String offsetText = content.substring(0, cursorOffset);
        List<String> snippets = NotebookUtils.getCodeSnippets(sourceCodeAnalysis, offsetText);

        String lastSnippet = snippets.isEmpty() ? "" : snippets.get(snippets.size()-1);
        List<Suggestion> suggestions = new ArrayList<>();
        suggestions.addAll(sourceCodeAnalysis.completionSuggestions(
                lastSnippet,
                lastSnippet.length(),
                anchor
        ));
        if (snippets.size() > 1) {
            suggestions.addAll(sourceCodeAnalysis.completionSuggestions(
                    offsetText,
                    offsetText.length(),
                    anchor
            ));
        }
        return suggestions;
    }
}
