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

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;
import java.util.logging.Logger;
import jdk.jshell.JShell;
import org.eclipse.lsp4j.CallHierarchyItem;
import org.eclipse.lsp4j.CallHierarchyPrepareParams;
import org.eclipse.lsp4j.CodeAction;
import org.eclipse.lsp4j.CodeActionParams;
import org.eclipse.lsp4j.CodeLens;
import org.eclipse.lsp4j.CodeLensParams;
import org.eclipse.lsp4j.Command;
import org.eclipse.lsp4j.CompletionItem;
import org.eclipse.lsp4j.CompletionList;
import org.eclipse.lsp4j.CompletionParams;
import org.eclipse.lsp4j.DefinitionParams;
import org.eclipse.lsp4j.services.LanguageClient;
import org.netbeans.modules.java.lsp.server.protocol.NbCodeLanguageClient;
import org.netbeans.modules.java.lsp.server.notebook.NotebookDocumentServiceHandler;
import org.eclipse.lsp4j.DidChangeNotebookDocumentParams;
import org.eclipse.lsp4j.DidCloseNotebookDocumentParams;
import org.eclipse.lsp4j.DidOpenNotebookDocumentParams;
import org.eclipse.lsp4j.DidSaveNotebookDocumentParams;
import org.eclipse.lsp4j.DocumentHighlight;
import org.eclipse.lsp4j.DocumentHighlightParams;
import org.eclipse.lsp4j.FoldingRange;
import org.eclipse.lsp4j.FoldingRangeRequestParams;
import org.eclipse.lsp4j.Hover;
import org.eclipse.lsp4j.HoverParams;
import org.eclipse.lsp4j.ImplementationParams;
import org.eclipse.lsp4j.Location;
import org.eclipse.lsp4j.LocationLink;
import org.eclipse.lsp4j.MessageParams;
import org.eclipse.lsp4j.MessageType;
import org.eclipse.lsp4j.PrepareRenameDefaultBehavior;
import org.eclipse.lsp4j.PrepareRenameParams;
import org.eclipse.lsp4j.PrepareRenameResult;
import org.eclipse.lsp4j.Range;
import org.eclipse.lsp4j.ReferenceParams;
import org.eclipse.lsp4j.SemanticTokens;
import org.eclipse.lsp4j.SemanticTokensParams;
import org.eclipse.lsp4j.SignatureHelp;
import org.eclipse.lsp4j.SignatureHelpParams;
import org.eclipse.lsp4j.TextEdit;
import org.eclipse.lsp4j.TypeDefinitionParams;
import org.eclipse.lsp4j.WillSaveTextDocumentParams;
import org.eclipse.lsp4j.jsonrpc.messages.Either;
import org.eclipse.lsp4j.jsonrpc.messages.Either3;
import org.netbeans.modules.java.lsp.server.protocol.ShowStatusMessageParams;
import org.openide.util.lookup.ServiceProvider;

/**
 *
 * @author atalati
 */
@ServiceProvider(service = NotebookDocumentServiceHandler.class)
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
            client.showStatusBarMessage(new ShowStatusMessageParams(MessageType.Info, "Intializing Java kernel for notebook."));
            NotebookSessionManager.getInstance().createSession(params.getNotebookDocument()).whenComplete((JShell jshell, Throwable t) -> {
                if (t == null) {
                    client.showStatusBarMessage(new ShowStatusMessageParams(MessageType.Info, "Java kernel initialized successfully"));
                } else {
                    // if package import fails user is not informed ?
                    client.showMessage(new MessageParams(MessageType.Error, "Error could not initialize Java kernel for the notebook."));
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
        LanguageClientInstance.getInstance().setClient((NbCodeLanguageClient) client);
        NotebookConfigs.getInstance().initConfigs();

    }

    @Override
    public CompletableFuture<SemanticTokens> semanticTokensFull(SemanticTokensParams params) {
        LOG.finer("SemanticTokensFull is not supported yet in notebookDocumentService");
        return CompletableFuture.completedFuture(null);
    }

    @Override
    public CompletableFuture<List<CallHierarchyItem>> prepareCallHierarchy(CallHierarchyPrepareParams params) {
        LOG.finer("prepareCallHierarchy is not supported yet in notebookDocumentService");
        return CompletableFuture.completedFuture(Collections.emptyList());
    }

    @Override
    public CompletableFuture<Either3<Range, PrepareRenameResult, PrepareRenameDefaultBehavior>> prepareRename(PrepareRenameParams params) {
        LOG.finer("prepareRename is not supported yet in notebookDocumentService");
        return CompletableFuture.completedFuture(null);
    }

    @Override
    public CompletableFuture<List<FoldingRange>> foldingRange(FoldingRangeRequestParams params) {
        LOG.finer("foldingRange is not supported yet in notebookDocumentService");
        return CompletableFuture.completedFuture(Collections.emptyList());
    }

    @Override
    public CompletableFuture<List<TextEdit>> willSaveWaitUntil(WillSaveTextDocumentParams params) {
        LOG.finer("willSaveWaitUntil is not supported yet in notebookDocumentService");
        return CompletableFuture.completedFuture(Collections.emptyList());
    }

    @Override
    public CompletableFuture<List<? extends CodeLens>> codeLens(CodeLensParams params) {
        LOG.finer("codeLens is not supported yet in notebookDocumentService");
        return CompletableFuture.completedFuture(Collections.emptyList());
    }

    @Override
    public CompletableFuture<List<Either<Command, CodeAction>>> codeAction(CodeActionParams params) {
        LOG.finer("codeAction is not supported yet in notebookDocumentService");
        return CompletableFuture.completedFuture(Collections.emptyList());
    }

    @Override
    public CompletableFuture<List<? extends DocumentHighlight>> documentHighlight(DocumentHighlightParams params) {
        LOG.finer("documentHighlight is not supported yet in notebookDocumentService");
        return CompletableFuture.completedFuture(Collections.emptyList());
    }

    @Override
    public CompletableFuture<List<? extends Location>> references(ReferenceParams params) {
        LOG.finer("references is not supported yet in notebookDocumentService");
        return CompletableFuture.completedFuture(Collections.emptyList());
    }

    @Override
    public CompletableFuture<Either<List<? extends Location>, List<? extends LocationLink>>> implementation(ImplementationParams params) {
        LOG.finer("implementation is not supported yet in notebookDocumentService");
        return CompletableFuture.completedFuture(Either.forLeft(Collections.emptyList()));
    }

    @Override
    public CompletableFuture<Either<List<? extends Location>, List<? extends LocationLink>>> typeDefinition(TypeDefinitionParams params) {
        LOG.finer("typeDefinition is not supported yet in notebookDocumentService");
        return CompletableFuture.completedFuture(Either.forLeft(Collections.emptyList()));
    }

    @Override
    public CompletableFuture<Either<List<? extends Location>, List<? extends LocationLink>>> definition(DefinitionParams params) {
        LOG.finer("definition is not supported yet in notebookDocumentService");
        return CompletableFuture.completedFuture(Either.forLeft(Collections.emptyList()));
    }

    @Override
    public CompletableFuture<SignatureHelp> signatureHelp(SignatureHelpParams params) {
        LOG.finer("signatureHelp is not supported yet in notebookDocumentService");
        return CompletableFuture.completedFuture(null);
    }

    @Override
    public CompletableFuture<Hover> hover(HoverParams params) {
        LOG.finer("hover is not supported yet in notebookDocumentService");
        return CompletableFuture.completedFuture(null);
    }

}
