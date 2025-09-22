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

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.atomic.AtomicReference;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.eclipse.lsp4j.ExecutionSummary;
import org.eclipse.lsp4j.NotebookCell;
import org.eclipse.lsp4j.NotebookCellKind;
import org.eclipse.lsp4j.TextDocumentItem;
import org.netbeans.modules.java.lsp.server.notebook.CellStateResponse;
import org.netbeans.modules.java.lsp.server.notebook.NotebookCellStateParams;
import org.netbeans.modules.java.lsp.server.protocol.NbCodeLanguageClient;

/**
 *
 * @author atalati
 */
public class CellState {

    private final NotebookCellKind type;
    private final String language;
    private final String cellUri;
    private final String notebookUri;
    private final AtomicReference<Object> metadata;
    private final AtomicReference<VersionAwareContent> content;
    private final AtomicReference<ExecutionSummary> executionSummary;
    private static final Logger LOG = Logger.getLogger(CellState.class.getName());

    CellState(NotebookCell notebookCell, TextDocumentItem details, String notebookUri) {
        String normalizedText = NotebookUtils.normalizeLineEndings(details.getText());
        this.cellUri = details.getUri();
        this.notebookUri = notebookUri;
        this.content = new AtomicReference<>(new VersionAwareContent(normalizedText, details.getVersion()));
        this.language = details.getLanguageId();
        this.type = notebookCell.getKind();
        this.metadata = new AtomicReference<>(notebookCell.getMetadata());
        this.executionSummary = new AtomicReference<>(notebookCell.getExecutionSummary());
    }

    public String getLanguage() {
        return language;
    }

    public String getContent() {
        return content.get().getContent();
    }

    public NotebookCellKind getType() {
        return type;
    }

    public Object getMetadata() {
        return metadata.get();
    }

    public ExecutionSummary getExecutionSummary() {
        return executionSummary.get();
    }

    public String getCellUri() {
        return cellUri;
    }

    public String getNotebookUri() {
        return notebookUri;
    }

    public void setContent(String newContent, int newVersion) throws InterruptedException, ExecutionException {
        VersionAwareContent currentContent = content.get();

        if (currentContent.getVersion() != newVersion - 1) {
            if (currentContent.getVersion() >= newVersion) {
                LOG.warning("Current version is higher or equal than the new version request received, so ignoring it.");
                return;
            }
            CompletableFuture<CellStateResponse> response = requestLatestCellState();
            if (response == null) {
                throw new IllegalStateException("Unable to send notebook cell state request to the client");
            }

            CellStateResponse newCellState = response.get();
            int receivedVersion = newCellState.getVersion();

            if (receivedVersion > currentContent.getVersion()) {
                VersionAwareContent newVersionContent = new VersionAwareContent(NotebookUtils.normalizeLineEndings(newCellState.getText()), receivedVersion);
                content.updateAndGet(current -> current != currentContent && receivedVersion <= current.getVersion() ? current : newVersionContent);
            } else {
                LOG.log(Level.WARNING, "Version mismatch: Received version to be greater than current version, received version:  {0}, current version: {1}", new Object[]{receivedVersion, currentContent.getVersion()});
            }
        } else {
            // newContent is already normalized during applyChanges
            VersionAwareContent newVersionContent = new VersionAwareContent(newContent, newVersion);

            if (!content.compareAndSet(currentContent, newVersionContent)) {
                LOG.log(Level.WARNING, "Concurrent modification detected. Version expected: {0}, current: {1}", new Object[]{newVersion - 1, content.get().getVersion()});
            }
        }
    }

    public void requestContentAndSet() throws InterruptedException, ExecutionException {
        CompletableFuture<CellStateResponse> response = requestLatestCellState();
        if (response == null) {
            throw new IllegalStateException("Unable to send notebook cell state request to the client");
        }
        CellStateResponse newCellState = response.get();
        if (newCellState.getVersion() <= 0) {
            throw new IllegalStateException("Received incorrect version number: " + newCellState.getVersion());
        }
        VersionAwareContent newVersionContent = new VersionAwareContent(NotebookUtils.normalizeLineEndings(newCellState.getText()), newCellState.getVersion());
        content.set(newVersionContent);
    }

    public void setExecutionSummary(ExecutionSummary executionSummary) {
        this.executionSummary.set(executionSummary);
    }

    public void setMetadata(Object metadata) {
        this.metadata.set(metadata);
    }

    // protected methods for ease of unit testing 
    protected CompletableFuture<CellStateResponse> requestLatestCellState() {
        NbCodeLanguageClient client = LanguageClientInstance.getInstance().getClient();

        if (client == null) {
            LOG.warning("Client is null");
            return null;
        }
        return client.getNotebookCellState(new NotebookCellStateParams(notebookUri, cellUri));
    }

    protected VersionAwareContent getVersionAwareContent() {
        return this.content.get();
    }

    protected class VersionAwareContent {

        private final String content;
        private final int version;

        public VersionAwareContent(String content, int version) {
            this.content = content;
            this.version = version;
        }

        public String getContent() {
            return content;
        }

        public int getVersion() {
            return version;
        }
    }
}
