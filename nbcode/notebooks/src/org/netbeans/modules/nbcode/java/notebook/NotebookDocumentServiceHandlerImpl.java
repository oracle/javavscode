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

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;
import java.util.logging.Logger;
import jdk.jshell.JShell;
import org.eclipse.lsp4j.CompletionItem;
import org.eclipse.lsp4j.CompletionList;
import org.eclipse.lsp4j.CompletionParams;
import org.eclipse.lsp4j.services.LanguageClient;
import org.netbeans.modules.java.lsp.server.protocol.NbCodeLanguageClient;
import org.netbeans.modules.java.lsp.server.protocol.NotebookDocumentServiceHandler;
import org.eclipse.lsp4j.DidChangeNotebookDocumentParams;
import org.eclipse.lsp4j.DidCloseNotebookDocumentParams;
import org.eclipse.lsp4j.DidOpenNotebookDocumentParams;
import org.eclipse.lsp4j.DidSaveNotebookDocumentParams;
import org.eclipse.lsp4j.jsonrpc.messages.Either;
import org.openide.util.lookup.ServiceProvider;

/**
 *
 * @author atalati
 */
@ServiceProvider(service = NotebookDocumentServiceHandler.class)
public class NotebookDocumentServiceHandlerImpl implements NotebookDocumentServiceHandler {

    private static final Logger LOG = Logger.getLogger(NotebookDocumentServiceHandler.class.getName());
    private NbCodeLanguageClient client;
    private final Map<String, NotebookDocumentStateManager> notebookStateMap = new ConcurrentHashMap<>();
    // Below map is required because completion request doesn't send notebook uri in the params
    private final Map<String, String> notebookCellMap = new ConcurrentHashMap<>(); 

    @Override
    public void didOpen(DidOpenNotebookDocumentParams params) {
        try {
            NotebookSessionManager.getInstance().createSession(params.getNotebookDocument());
            NotebookDocumentStateManager state = new NotebookDocumentStateManager(params.getNotebookDocument(), params.getCellTextDocuments());
            params.getNotebookDocument().getCells().forEach(cell -> {
                notebookCellMap.put(cell.getDocument(), params.getNotebookDocument().getUri());
            });
            
            notebookStateMap.put(params.getNotebookDocument().getUri(), state);
            
        } catch (Exception e) {
            LOG.log(Level.SEVERE, "Error while opening notebook {0}", e.getMessage());
        }
    }

    @Override
    public void didChange(DidChangeNotebookDocumentParams params) {
        NotebookDocumentStateManager state = notebookStateMap.get(params.getNotebookDocument().getUri());
        state.syncState(params.getNotebookDocument(), params.getChange(), notebookCellMap);
    }

    @Override
    public void didSave(DidSaveNotebookDocumentParams params) {
        // do nothing
    }

    @Override
    public void didClose(DidCloseNotebookDocumentParams params) {
        NotebookSessionManager.getInstance().closeSession(params.getNotebookDocument().getUri());
    }

    @Override
    public CompletableFuture<Either<List<CompletionItem>, CompletionList>> completion(CompletionParams params) {
        try {
            String cellUri = params.getTextDocument().getUri();
            String notebookUri = notebookCellMap.get(cellUri);
            NotebookDocumentStateManager stateManager = notebookStateMap.get(notebookUri);
            JShell instance = NotebookSessionManager.getInstance().getSession(notebookUri);
            
            return CodeCompletionProvider.getInstance().getCodeCompletions(params, stateManager, instance);
        } catch (Exception e) {
            LOG.log(Level.SEVERE, "Unable to compute code completions {0}", e.getMessage());
            return CompletableFuture.completedFuture(Either.forRight(new CompletionList()));
        }
    }

    @Override
    public void connect(LanguageClient client) {
        this.client = (NbCodeLanguageClient) client;
        NotebookConfigs.getInstance().setLanguageClient((NbCodeLanguageClient) client);
    }

    public NbCodeLanguageClient getNbCodeLanguageClient() {
        return this.client;
    }
}
