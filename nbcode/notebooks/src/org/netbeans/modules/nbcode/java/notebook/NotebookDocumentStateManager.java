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
import java.util.Iterator;
import java.util.List;
import java.util.ListIterator;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.eclipse.lsp4j.NotebookCell;
import org.eclipse.lsp4j.NotebookDocument;
import org.eclipse.lsp4j.NotebookDocumentChangeEvent;
import org.eclipse.lsp4j.NotebookDocumentChangeEventCellStructure;
import org.eclipse.lsp4j.NotebookDocumentChangeEventCellTextContent;
import org.eclipse.lsp4j.Range;
import org.eclipse.lsp4j.TextDocumentContentChangeEvent;
import org.eclipse.lsp4j.TextDocumentIdentifier;
import org.eclipse.lsp4j.TextDocumentItem;
import org.eclipse.lsp4j.VersionedNotebookDocumentIdentifier;

/**
 *
 * @author atalati
 */
public class NotebookDocumentStateManager {

    private static final Logger LOG = Logger.getLogger(NotebookDocumentStateManager.class.getName());

    private final NotebookDocument notebookDoc;
    private final Map<String, CellState> cellsMap = new ConcurrentHashMap<>();
    private final List<String> cellsOrder;
    private final CellStateCreator cellStateCreator;

    public NotebookDocumentStateManager(NotebookDocument notebookDoc, List<TextDocumentItem> cells) {
        this(notebookDoc, cells, null);
    }
    
    public NotebookDocumentStateManager(NotebookDocument notebookDoc, List<TextDocumentItem> cells, CellStateCreator cellStateCreator) {
        this.cellStateCreator = cellStateCreator != null ? cellStateCreator : CellState::new;
        this.notebookDoc = notebookDoc;
        this.cellsOrder = new ArrayList<>();
        Iterator<NotebookCell> notebookCellsIterator = notebookDoc.getCells().iterator();

        for (TextDocumentItem cellItem : cells) {
            if (notebookCellsIterator.hasNext()) {
                addNewCellState(notebookCellsIterator.next(), cellItem);
                this.cellsOrder.add(cellItem.getUri());
            } else {
                LOG.log(Level.SEVERE, "Mismatched number of cells and cell items during initialization.");
                break;
            }
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

        Set<String> closedCellUris = new HashSet<>();
        Set<String> openedCellUris = new HashSet<>();

        if (updatedStructure.getDidClose() != null) {
            for (TextDocumentIdentifier closedCell : updatedStructure.getDidClose()) {
                String uri = closedCell.getUri();
                closedCellUris.add(uri);

                CellState removed = cellsMap.remove(uri);
                cellsNotebookMap.remove(uri);
                if (removed != null) {
                    LOG.log(Level.FINE, "Removed cell from map: {0}", uri);
                }
            }
        }

        List<TextDocumentItem> cellsItem = updatedStructure.getDidOpen();
        List<NotebookCell> cellsDetail = updatedStructure.getArray().getCells();

        if (cellsItem != null && cellsDetail != null) {
            Iterator<NotebookCell> details = cellsDetail.iterator();
            for (TextDocumentItem cellItem: cellsItem) {
                String uri = cellItem.getUri();
                openedCellUris.add(uri);
                cellsNotebookMap.put(uri, notebookDoc.getUri());
                if (details.hasNext()) {
                    addNewCellState(details.next(), cellItem);
                }
            }
        }

        synchronized (cellsOrder) {
            int startIdx = updatedStructure.getArray().getStart();
            int deleteCount = updatedStructure.getArray().getDeleteCount();

            ListIterator<String> iterator = cellsOrder.listIterator(startIdx);

            for (int i = 0; i < deleteCount && iterator.hasNext(); i++) {
                String removedUri = iterator.next();
                iterator.remove();

                if (!closedCellUris.contains(removedUri)) {
                    LOG.log(Level.WARNING, "Removed URI {0} not found in didClose list", removedUri);
                }
                LOG.log(Level.FINE, "Removed cell from order: {0}", removedUri);
            }

            if (cellsItem != null) {
                for (TextDocumentItem cellItem : cellsItem) {
                    String uri = cellItem.getUri();
                    iterator.add(uri);

                    if (!openedCellUris.contains(uri)) {
                        LOG.log(Level.WARNING, "Added URI {0} not found in didOpen list", uri);
                    }

                    LOG.log(Level.FINE, "Added cell to order: {0}", uri);
                }
            }
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

        try {
            String updatedContent = applyContentChanges(currentContent, contentChange.getChanges());
            cellState.setContent(updatedContent, newVersion);
            LOG.log(Level.FINE, "Updated content for cell: {0}, version: {1}", new Object[]{uri, newVersion});
        } catch (Exception e) {
            LOG.log(Level.WARNING, "applyContentChanges failed, requesting full content for cell: {0}. Error - {1}", new Object[]{uri, e});
            try {
                cellState.requestContentAndSet();
            } catch (Exception ex) {
                LOG.log(Level.SEVERE, "Failed to refresh content for cell: " + uri, ex);
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
        return NotebookUtils.applyChange(content, range.getStart(), range.getEnd(), change.getText());
    }


    private void addNewCellState(NotebookCell cell, TextDocumentItem item) {
        if (cell == null || item == null) {
            LOG.log(Level.WARNING, "Attempted to add null cell or item");
            return;
        }

        CellState cellState;
        try {
            cellState = cellStateCreator.create(cell, item, notebookDoc.getUri());
            LOG.log(Level.FINE, "Added new cell state: {0}", item.getUri());
        } catch (Exception e) {
            LOG.log(Level.SEVERE, "Failed to create cell state for: " + item.getUri(), e);
            throw new RuntimeException("Failed to create cell state", e);
        }
        cellsMap.put(item.getUri(), cellState);
    }

    protected Map<String, CellState> getCellsMap() {
        return cellsMap;
    }
    
    // protected methods for ease of unit testing
    protected interface CellStateCreator {
        CellState create(NotebookCell cell, TextDocumentItem item, String notebookDocUri);
    }
}
