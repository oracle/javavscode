/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may 'ou may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
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
import org.eclipse.lsp4j.ConfigurationParams;
import org.eclipse.lsp4j.MessageActionItem;
import org.eclipse.lsp4j.MessageParams;
import org.eclipse.lsp4j.PublishDiagnosticsParams;
import org.eclipse.lsp4j.ShowMessageRequestParams;
import org.eclipse.lsp4j.jsonrpc.messages.Either;
import org.netbeans.modules.java.lsp.server.explorer.api.NodeChangedParams;
import org.netbeans.modules.java.lsp.server.input.QuickPickItem;
import org.netbeans.modules.java.lsp.server.input.ShowInputBoxParams;
import org.netbeans.modules.java.lsp.server.input.ShowMutliStepInputParams;
import org.netbeans.modules.java.lsp.server.input.ShowQuickPickParams;
import org.netbeans.modules.java.lsp.server.notebook.CellStateResponse;
import org.netbeans.modules.java.lsp.server.notebook.NotebookCellExecutionProgressResultParams;
import org.netbeans.modules.java.lsp.server.notebook.NotebookCellStateParams;
import org.netbeans.modules.java.lsp.server.protocol.DecorationRenderOptions;
import org.netbeans.modules.java.lsp.server.protocol.HtmlPageParams;
import org.netbeans.modules.java.lsp.server.protocol.NbCodeClientCapabilities;
import org.netbeans.modules.java.lsp.server.protocol.NbCodeLanguageClient;
import org.netbeans.modules.java.lsp.server.protocol.OutputMessage;
import org.netbeans.modules.java.lsp.server.protocol.SaveDocumentRequestParams;
import org.netbeans.modules.java.lsp.server.protocol.SetTextEditorDecorationParams;
import org.netbeans.modules.java.lsp.server.protocol.ShowStatusMessageParams;
import org.netbeans.modules.java.lsp.server.protocol.TestProgressParams;
import org.netbeans.modules.java.lsp.server.protocol.UpdateConfigParams;

/**
 * Overrides all the methods with UnsupportedOperation extend this class and
 * override the method you want to mock
 *
 * @author shimadan
 */
public class MockNbClient implements NbCodeLanguageClient {

    @Override
    public NbCodeClientCapabilities getNbCodeCapabilities() {
        NbCodeClientCapabilities caps = new NbCodeClientCapabilities();
        caps.setConfigurationPrefix("jdk.");
        return caps;
    }

    @Override
    public CompletableFuture<Void> configurationUpdate(UpdateConfigParams ucp) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public CompletableFuture<List<Object>> configuration(ConfigurationParams configurationParams) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public void showStatusBarMessage(ShowStatusMessageParams ssmp) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public CompletableFuture<String> showHtmlPage(HtmlPageParams hpp) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public CompletableFuture<String> execInHtmlPage(HtmlPageParams hpp) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public CompletableFuture<List<QuickPickItem>> showQuickPick(ShowQuickPickParams sqpp) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public CompletableFuture<String> showInputBox(ShowInputBoxParams sibp) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public CompletableFuture<Map<String, Either<List<QuickPickItem>, String>>> showMultiStepInput(ShowMutliStepInputParams smsip) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public void notifyTestProgress(TestProgressParams tpp) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public CompletableFuture<String> createTextEditorDecoration(DecorationRenderOptions dro) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public void setTextEditorDecoration(SetTextEditorDecorationParams stedp) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public void disposeTextEditorDecoration(String params) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public void notifyNodeChange(NodeChangedParams ncp) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public CompletableFuture<Boolean> requestDocumentSave(SaveDocumentRequestParams sdrp) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public CompletableFuture<Void> writeOutput(OutputMessage om) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public CompletableFuture<Void> showOutput(String outputName) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public CompletableFuture<Void> closeOutput(String outputName) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public CompletableFuture<Void> resetOutput(String outputName) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public void telemetryEvent(Object object) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public void publishDiagnostics(PublishDiagnosticsParams diagnostics) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public void showMessage(MessageParams messageParams) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public CompletableFuture<MessageActionItem> showMessageRequest(ShowMessageRequestParams requestParams) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public void logMessage(MessageParams message) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public void notifyNotebookCellExecutionProgress(NotebookCellExecutionProgressResultParams params) {
        throw new UnsupportedOperationException("Not supported yet.");
    }

    @Override
    public CompletableFuture<CellStateResponse> getNotebookCellState(NotebookCellStateParams params) {
        throw new UnsupportedOperationException("Not supported yet.");
    }
}
