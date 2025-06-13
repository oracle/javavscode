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

import java.util.concurrent.atomic.AtomicReference;
import org.eclipse.lsp4j.ExecutionSummary;
import org.eclipse.lsp4j.NotebookCell;
import org.eclipse.lsp4j.NotebookCellKind;
import org.eclipse.lsp4j.TextDocumentItem;

/**
 *
 * @author atalati
 */
public class CellState {

    private final NotebookCellKind type;
    private final String language;
    private final AtomicReference<Object> metadata;
    private final AtomicReference<VersionAwareCotent> content;
    private final AtomicReference<ExecutionSummary> executionSummary;

    CellState(NotebookCell notebookCell, TextDocumentItem details) {
        String normalizedText = NotebookUtils.normalizeLineEndings(details.getText());
        this.content = new AtomicReference<>(new VersionAwareCotent(normalizedText, details.getVersion()));
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

    public void setContent(String newContent, int newVersion) {
        String normalizedContent = NotebookUtils.normalizeLineEndings(newContent);
        VersionAwareCotent currentContent = content.get();

        if (currentContent.getVersion() != newVersion - 1) {
            throw new IllegalStateException("Version mismatch: expected " + (newVersion - 1) + ", got " + currentContent.getVersion());
        }

        VersionAwareCotent newVersionContent = new VersionAwareCotent(normalizedContent, newVersion);

        if (!content.compareAndSet(currentContent, newVersionContent)) {
            throw new IllegalStateException("Concurrent modification detected. Version expected: " + (newVersion - 1) + ", current: " + content.get().getVersion());
        }
    }

    public void setExecutionSummary(ExecutionSummary executionSummary) {
        this.executionSummary.set(executionSummary);
    }

    public void setMetadata(Object metadata) {
        this.metadata.set(metadata);
    }

    private class VersionAwareCotent {

        private String content;
        private int version;

        public VersionAwareCotent(String content, int version) {
            this.content = content;
            this.version = version;
        }

        public String getContent() {
            return content;
        }

        public void setContent(String content) {
            this.content = content;
        }

        public int getVersion() {
            return version;
        }

        public void setVersion(int version) {
            this.version = version;
        }

    }
}
