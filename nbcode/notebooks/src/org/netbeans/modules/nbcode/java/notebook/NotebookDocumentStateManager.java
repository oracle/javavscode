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
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.eclipse.lsp4j.NotebookCell;
import org.eclipse.lsp4j.NotebookDocument;
import org.eclipse.lsp4j.NotebookDocumentChangeEvent;
import org.eclipse.lsp4j.NotebookDocumentChangeEventCellStructure;
import org.eclipse.lsp4j.NotebookDocumentChangeEventCellTextContent;
import org.eclipse.lsp4j.Position;
import org.eclipse.lsp4j.Range;
import org.eclipse.lsp4j.TextDocumentContentChangeEvent;
import org.eclipse.lsp4j.TextDocumentItem;
import org.eclipse.lsp4j.VersionedNotebookDocumentIdentifier;
import org.netbeans.modules.java.lsp.server.notebook.NotebookCellContentRequestParams;
import org.netbeans.modules.java.lsp.server.protocol.NbCodeLanguageClient;

/**
 *
 * @author atalati
 */
public class NotebookDocumentStateManager {

    private static final Logger LOG = Logger.getLogger(NotebookDocumentStateManager.class.getName());

    private final NotebookDocument notebookDoc;
    private final Map<String, CellState> cellsMap = new ConcurrentHashMap<>();
    private final List<String> cellsOrder;

    public NotebookDocumentStateManager(NotebookDocument notebookDoc, List<TextDocumentItem> cells) {
        this.notebookDoc = notebookDoc;
        this.cellsOrder = new ArrayList<>();
        for (int i = 0; i < cells.size(); i++) {
            addNewCellState(notebookDoc.getCells().get(i), cells.get(i));
            this.cellsOrder.add(cells.get(i).getUri());
        }
    }

    public void syncState(VersionedNotebookDocumentIdentifier notebook, NotebookDocumentChangeEvent changeEvent, Map<String, String> cellsNotebookMap) {
        try {
            if (changeEvent.getCells() != null) {
                updateNotebookCellStructure(changeEvent.getCells().getStructure(), cellsNotebookMap);
                updateNotebookCellData(changeEvent.getCells().getData());

                if (changeEvent.getCells().getTextContent() != null) {
                    for (NotebookDocumentChangeEventCellTextContent contentChange : changeEvent.getCells().getTextContent()) {
                        updateNotebookCellContent(contentChange);
                    }
                }
            }
        } catch (Exception e) {
            LOG.log(Level.WARNING, "Failed to sync notebook state", e);
            throw new RuntimeException("Failed to sync notebook state", e);
        }
    }

    public NotebookDocument getNotebookDocument() {
        return notebookDoc;
    }

    public CellState getCell(String uri) {
        return cellsMap.get(uri);
    }

    private void updateNotebookCellStructure(NotebookDocumentChangeEventCellStructure updatedStructure, Map<String, String> cellsNotebookMap) {
        if (updatedStructure == null) {
            return;
        }
        // Handle deleted cells
        int deletedCells = updatedStructure.getArray().getDeleteCount();
        if (deletedCells > 0 && updatedStructure.getDidClose() != null) {
            updatedStructure.getDidClose().forEach(cell -> {
                String uri = cell.getUri();

                CellState removed = cellsMap.remove(uri);
                cellsNotebookMap.remove(uri);
                cellsOrder.remove(uri);
                if (removed != null) {
                    LOG.log(Level.FINE, "Removed cell: {0}", uri);
                }
            });
        }

        // Handle added cells
        int startIdx = updatedStructure.getArray().getStart();
        List<TextDocumentItem> cellsItem = updatedStructure.getDidOpen();
        List<NotebookCell> cellsDetail = updatedStructure.getArray().getCells();

        if (cellsItem != null && cellsDetail != null && cellsDetail.size() == cellsItem.size()) {
            for (int i = 0; i < cellsDetail.size(); i++) {
                addNewCellState(cellsDetail.get(i), cellsItem.get(i));
                cellsNotebookMap.put(cellsItem.get(i).getUri(), notebookDoc.getUri());
                if (startIdx + i <= cellsOrder.size()) {
                    cellsOrder.add(startIdx + i, cellsItem.get(i).getUri());
                } else {
                    LOG.warning("unable to add cell in the list of cells");
                }
            }
        } else {
            LOG.severe("cell details is null or array size mismatch is present");
            throw new IllegalStateException("Error while adding cell to the notebook state");
        }

    }

    private void updateNotebookCellData(List<NotebookCell> data) {
        if (data == null) {
            return;
        }

        data.forEach(cell -> {
            String cellUri = cell.getDocument();
            CellState cellState = cellsMap.get(cellUri);
            if (cellState != null) {
                cellState.setExecutionSummary(cell.getExecutionSummary());
                cellState.setMetadata(cell.getMetadata());
                LOG.log(Level.FINE, "Updated cell data for: {0}", cellUri);
            } else {
                LOG.log(Level.WARNING, "Attempted to update non-existent cell: {0}", cellUri);
            }
        });
    }

    private void updateNotebookCellContent(NotebookDocumentChangeEventCellTextContent contentChange) {
        if (contentChange == null) {
            return;
        }
        String uri = contentChange.getDocument().getUri();
        CellState cellState = cellsMap.get(uri);
        if (cellState == null) {
            LOG.log(Level.WARNING, "Attempted to update content of non-existent cell: {0}", uri);
            return;
        }
        int newVersion = contentChange.getDocument().getVersion();
        String currentContent = cellState.getContent();
        if (!contentChange.getChanges().isEmpty()) {
            try {
                String updatedContent = applyContentChanges(currentContent, contentChange.getChanges());
                cellState.setContent(updatedContent, newVersion);
                LOG.log(Level.FINE, "Updated content for cell: {0}, version: {1}", new Object[]{uri, newVersion});
            } catch (Exception e) {
                LOG.log(Level.SEVERE, "Failed to apply content changes to cell: " + uri, e);
                throw new RuntimeException("Failed to apply content changes", e);
            }
        }
    }

    private String applyContentChanges(String originalContent, List<TextDocumentContentChangeEvent> changes) {
        if (originalContent == null) {
            originalContent = "";
        }

        String currentContent = originalContent;

        for (TextDocumentContentChangeEvent change : changes) {
            if (change.getRange() != null) {
                currentContent = applyRangeChange(currentContent, change);
            } else {
                currentContent = change.getText();
            }
        }

        return currentContent;
    }

    private String applyRangeChange(String content, TextDocumentContentChangeEvent change) {
        Range range = change.getRange();
        Position start = range.getStart();
        Position end = range.getEnd();

        String[] lines = content.split("\n", -1);

        if (start.getLine() < 0 || start.getLine() >= lines.length
                || end.getLine() < 0 || end.getLine() >= lines.length) {
            throw new IllegalArgumentException("Invalid range positions");
        }

        StringBuilder result = new StringBuilder();

        for (int i = 0; i < start.getLine(); i++) {
            result.append(lines[i]);
            if (i < lines.length - 1) {
                result.append("\n");
            }
        }

        String startLine = lines[start.getLine()];
        String beforeChange = startLine.substring(0, Math.min(start.getCharacter(), startLine.length()));
        result.append(beforeChange);

        result.append(change.getText());

        String endLine = lines[end.getLine()];
        String afterChange = endLine.substring(Math.min(end.getCharacter(), endLine.length()));
        result.append(afterChange);

        for (int i = end.getLine() + 1; i < lines.length; i++) {
            result.append("\n").append(lines[i]);
        }

        return result.toString();
    }

    private void addNewCellState(NotebookCell cell, TextDocumentItem item) {
        if (cell == null || item == null) {
            LOG.log(Level.WARNING, "Attempted to add null cell or item");
            return;
        }

        try {
            CellState cellState = new CellState(cell, item);
            cellsMap.put(item.getUri(), cellState);
            LOG.log(Level.FINE, "Added new cell state: {0}", item.getUri());
        } catch (Exception e) {
            LOG.log(Level.SEVERE, "Failed to create cell state for: " + item.getUri(), e);
            throw new RuntimeException("Failed to create cell state", e);
        }
    }
}
