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
import org.eclipse.lsp4j.DidChangeNotebookDocumentParams;
import org.eclipse.lsp4j.DidCloseNotebookDocumentParams;
import org.eclipse.lsp4j.DidOpenNotebookDocumentParams;
import org.eclipse.lsp4j.DidSaveNotebookDocumentParams;
import org.eclipse.lsp4j.MessageParams;
import org.eclipse.lsp4j.MessageType;
import org.eclipse.lsp4j.NotebookDocumentSyncRegistrationOptions;
import org.eclipse.lsp4j.NotebookSelector;
import org.eclipse.lsp4j.NotebookSelectorCell;
import org.eclipse.lsp4j.ServerCapabilities;
import org.eclipse.lsp4j.jsonrpc.messages.Either;
import org.eclipse.lsp4j.services.LanguageClient;
import org.netbeans.modules.java.lsp.server.notebook.NotebookDocumentServiceHandler;
import org.netbeans.modules.java.lsp.server.protocol.NbCodeLanguageClient;
import org.netbeans.modules.java.lsp.server.protocol.ShowStatusMessageParams;
import org.openide.util.NbBundle;
import org.openide.util.lookup.ServiceProvider;

/**
 *
 * @author atalati
 */
@ServiceProvider(service = NotebookDocumentServiceHandler.class)
@NbBundle.Messages({
    "MSG_KernelInitializing=Intializing Java kernel for notebook",
    "MSG_KernelInitializeSuccess=Java kernel initialized successfully.",
    "# {0} - error message",
    "MSG_KernelInitializeFailed=Java kernel initialization for the notebook failed. Error {0}"
})
public class NotebookDocumentServiceHandlerImpl implements NotebookDocumentServiceHandler {

    private static final Logger LOG = Logger.getLogger(NotebookDocumentServiceHandler.class.getName());
    private final Map<String, NotebookDocumentStateManager> notebookStateMap = new ConcurrentHashMap<>();
    // Below map is required because completion request doesn't send notebook uri in the params
    private final Map<String, String> notebookCellMap = new ConcurrentHashMap<>();
    
    @Override
    public void didOpen(DidOpenNotebookDocumentParams params) {
        try {
            NbCodeLanguageClient client = LanguageClientInstance.getInstance().getClient();
            if (client == null) {
                return;
            }
            client.showStatusBarMessage(new ShowStatusMessageParams(MessageType.Info, Bundle.MSG_KernelInitializing()));
            NotebookSessionManager.getInstance().createSession(params.getNotebookDocument()).whenComplete((JShell jshell, Throwable t) -> {
                if (t == null) {
                    client.showStatusBarMessage(new ShowStatusMessageParams(MessageType.Info, Bundle.MSG_KernelInitializeSuccess()));
                } else {
                    // if package import fails user is not informed ?
                    client.showMessage(new MessageParams(MessageType.Error, Bundle.MSG_KernelInitializeFailed(t.getMessage())));
                    LOG.log(Level.SEVERE, "Error could not initialize Java kernel for the notebook. : {0}", t.getMessage());
                }
            });
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
        String notebookUri = params.getNotebookDocument().getUri();
        NotebookSessionManager.getInstance().closeSession(notebookUri);
        NotebookDocumentStateManager state = notebookStateMap.remove(notebookUri);
        if (state != null) {
            state.getCellsMap().keySet().forEach(notebookCellMap::remove);
        } else {
            notebookCellMap.values().removeIf(notebookUri::equals);
        }
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
        LanguageClientInstance.getInstance().setClient((NbCodeLanguageClient) client);
        NotebookConfigs.getInstance().initConfigs();

    }
    @Override // connect must be called before init
    public void init(ServerCapabilities serverCapabilities){
        if (clientWantsNotebook()) {
            NotebookDocumentSyncRegistrationOptions opts = createNotebookRegOpts();
            serverCapabilities.setNotebookDocumentSync(opts);
        }
    }
    private boolean clientWantsNotebook() {
        NbCodeLanguageClient client = LanguageClientInstance.getInstance().getClient();
        return  client != null && client.getNbCodeCapabilities().wantsNotebookSupport();
    }
    private NotebookDocumentSyncRegistrationOptions createNotebookRegOpts() {
        NotebookDocumentSyncRegistrationOptions opts = new NotebookDocumentSyncRegistrationOptions();
        NotebookSelector ns = new NotebookSelector();
        ns.setNotebook("*");
        ns.setCells(List.of(new NotebookSelectorCell("java"), new NotebookSelectorCell("markdown")));
        opts.setNotebookSelector(List.of(ns));
        return opts;
    }

}
