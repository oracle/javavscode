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

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import org.eclipse.lsp4j.ExecutionSummary;
import org.eclipse.lsp4j.NotebookCell;
import org.eclipse.lsp4j.NotebookCellArrayChange;
import org.eclipse.lsp4j.NotebookCellKind;
import org.eclipse.lsp4j.NotebookDocument;
import org.eclipse.lsp4j.NotebookDocumentChangeEvent;
import org.eclipse.lsp4j.NotebookDocumentChangeEventCells;
import org.eclipse.lsp4j.NotebookDocumentChangeEventCellStructure;
import org.eclipse.lsp4j.NotebookDocumentChangeEventCellTextContent;
import org.eclipse.lsp4j.Position;
import org.eclipse.lsp4j.Range;
import org.eclipse.lsp4j.TextDocumentContentChangeEvent;
import org.eclipse.lsp4j.TextDocumentIdentifier;
import org.eclipse.lsp4j.TextDocumentItem;
import org.eclipse.lsp4j.VersionedNotebookDocumentIdentifier;
import org.eclipse.lsp4j.VersionedTextDocumentIdentifier;
import org.junit.Before;
import org.junit.Test;
import org.netbeans.junit.NbTestCase;
import org.netbeans.modules.java.lsp.server.notebook.CellStateResponse;

public class NotebookDocumentStateManagerTest extends NbTestCase {

    private static final String NOTEBOOK_URI = "file:///path/to/notebook.ipynb";
    private NotebookDocument notebookDoc;
    private List<TextDocumentItem> initialCells;
    private NotebookDocumentStateManager manager;

    public NotebookDocumentStateManagerTest(String name) {
        super(name);
    }

    @Before
    @Override
    public void setUp() {
        notebookDoc = new NotebookDocument(NOTEBOOK_URI, "java-notebook", 1, new ArrayList<>());
        initialCells = new ArrayList<>();

        addCell("cell1_uri", "System.out.println(\"Hello\");", 1, notebookDoc, initialCells);
        addCell("cell2_uri", "int x = 10;", 1, notebookDoc, initialCells);

        manager = new NotebookDocumentStateManager(notebookDoc, initialCells);
    }

    private void addCell(String uri, String content, int version, NotebookDocument doc, List<TextDocumentItem> items) {
        NotebookCell cell = new NotebookCell(NotebookCellKind.Code, uri);
        cell.setDocument(uri);
        doc.getCells().add(cell);
        items.add(new TextDocumentItem(uri, "java", version, content));
    }

    private NotebookCell getCell(String uri) {
        NotebookCell cell = new NotebookCell(NotebookCellKind.Code, uri);
        cell.setDocument(uri);
        return cell;
    }

    @Test
    public void testConstructorInitialization() {
        assertNotNull("Manager should not be null", manager);
        assertEquals("Should have 2 cells initially", 2, manager.getNotebookDocument().getCells().size());
        assertNotNull("Cell 1 should exist", manager.getCell("cell1_uri"));
        assertNotNull("Cell 2 should exist", manager.getCell("cell2_uri"));
        assertEquals("Cell 1 content should match", "System.out.println(\"Hello\");", manager.getCell("cell1_uri").getContent());
    }

    @Test
    public void testSyncState_AddCell() {
        NotebookDocumentChangeEvent event = new NotebookDocumentChangeEvent();
        NotebookDocumentChangeEventCells cellsChange = new NotebookDocumentChangeEventCells();
        NotebookDocumentChangeEventCellStructure structureChange = new NotebookDocumentChangeEventCellStructure();
        cellsChange.setStructure(structureChange);
        event.setCells(cellsChange);

        NotebookCell newNotebookCell = new NotebookCell(NotebookCellKind.Code, "cell3_uri");
        newNotebookCell.setDocument("cell3_uri");
        TextDocumentItem newTextItem = new TextDocumentItem("cell3_uri", "java", 1, "new cell content");

        NotebookCellArrayChange arrayChange = new NotebookCellArrayChange(1, 0, Collections.singletonList(newNotebookCell));
        structureChange.setArray(arrayChange);
        structureChange.setDidOpen(Collections.singletonList(newTextItem));

        manager.syncState(new VersionedNotebookDocumentIdentifier(2, NOTEBOOK_URI), event, new HashMap<>());

        assertEquals("Should have 3 cells after adding", 3, manager.getCellsMap().size());
        assertNotNull("New cell should exist", manager.getCell("cell3_uri"));
        assertEquals("New cell content should match", "new cell content", manager.getCell("cell3_uri").getContent());
    }

    @Test
    public void testSyncState_RemoveCell() {
        NotebookDocumentChangeEvent event = new NotebookDocumentChangeEvent();
        NotebookDocumentChangeEventCells cellsChange = new NotebookDocumentChangeEventCells();
        NotebookDocumentChangeEventCellStructure structureChange = new NotebookDocumentChangeEventCellStructure();
        cellsChange.setStructure(structureChange);
        event.setCells(cellsChange);

        NotebookCellArrayChange arrayChange = new NotebookCellArrayChange(0, 1, List.of());
        structureChange.setArray(arrayChange);
        structureChange.setDidClose(Collections.singletonList(new TextDocumentIdentifier("cell1_uri")));
        structureChange.setDidOpen(List.of());

        manager.syncState(new VersionedNotebookDocumentIdentifier(2, NOTEBOOK_URI), event, new HashMap<>());

        assertNull("Cell 1 should be removed", manager.getCell("cell1_uri"));
        assertNotNull("Cell 2 should still exist", manager.getCell("cell2_uri"));
    }

    @Test
    public void testSyncState_UpdateCellData() {
        NotebookDocumentChangeEvent event = new NotebookDocumentChangeEvent();
        NotebookCell cellToUpdate = new NotebookCell(NotebookCellKind.Code, "cell1_uri");
        cellToUpdate.setDocument("cell1_uri");
        cellToUpdate.setMetadata("new metadata");
        ExecutionSummary summary = new ExecutionSummary();
        summary.setExecutionOrder(10);
        cellToUpdate.setExecutionSummary(summary);

        NotebookDocumentChangeEventCells cellsChange = new NotebookDocumentChangeEventCells();
        cellsChange.setData(Collections.singletonList(cellToUpdate));
        event.setCells(cellsChange);

        manager.syncState(new VersionedNotebookDocumentIdentifier(2, NOTEBOOK_URI), event, new HashMap<>());

        CellState cellState = manager.getCell("cell1_uri");
        assertEquals("Metadata should be updated", "new metadata", cellState.getMetadata());
        assertEquals("Execution order should be updated", 10, cellState.getExecutionSummary().getExecutionOrder());
    }

    @Test
    public void testSyncState_UpdateCellContent_Incremental() {
        NotebookDocumentChangeEvent event = new NotebookDocumentChangeEvent();
        NotebookDocumentChangeEventCellTextContent textChange = new NotebookDocumentChangeEventCellTextContent();
        textChange.setDocument(new VersionedTextDocumentIdentifier("cell2_uri", 2));

        TextDocumentContentChangeEvent contentChange = new TextDocumentContentChangeEvent(
                new Range(new Position(0, 0), new Position(0, 0)),
                "final "
        );
        textChange.setChanges(Collections.singletonList(contentChange));

        NotebookDocumentChangeEventCells cellsChange = new NotebookDocumentChangeEventCells();
        cellsChange.setTextContent(Collections.singletonList(textChange));
        event.setCells(cellsChange);

        manager.syncState(new VersionedNotebookDocumentIdentifier(2, NOTEBOOK_URI), event, new HashMap<>());

        assertEquals("Content should be updated incrementally", "final int x = 10;", manager.getCell("cell2_uri").getContent());
    }

    @Test
    public void testSyncState_UpdateCellContent_FailureAndFallback() throws InterruptedException, ExecutionException {
        TestableNotebookDocumentStateManager testManager = new TestableNotebookDocumentStateManager(notebookDoc, initialCells);

        String fallbackContent = "content from fallback";
        TestableCellState.setMockResponseForUri("cell1_uri", fallbackContent, 5);

        NotebookDocumentChangeEvent event = new NotebookDocumentChangeEvent();
        NotebookDocumentChangeEventCellTextContent textChange = new NotebookDocumentChangeEventCellTextContent();
        textChange.setDocument(new VersionedTextDocumentIdentifier("cell1_uri", 2));
        TextDocumentContentChangeEvent contentChange = new TextDocumentContentChangeEvent(
                new Range(new Position(99, 0), new Position(99, 0)), // Invalid line number
                "this will fail"
        );
        textChange.setChanges(Collections.singletonList(contentChange));

        NotebookDocumentChangeEventCells cellsChange = new NotebookDocumentChangeEventCells();
        cellsChange.setTextContent(Collections.singletonList(textChange));
        event.setCells(cellsChange);

        testManager.syncState(new VersionedNotebookDocumentIdentifier(2, NOTEBOOK_URI), event, new HashMap<>());

        assertEquals("Content should be updated from fallback", fallbackContent, testManager.getCell("cell1_uri").getContent());

        TestableCellState.clearMockResponses();
    }

    private static class TestableNotebookDocumentStateManager extends NotebookDocumentStateManager {

        public TestableNotebookDocumentStateManager(NotebookDocument notebookDoc, List<TextDocumentItem> cells) {
            super(notebookDoc, cells);
        }

        @Override
        protected void addNewCellState(NotebookCell cell, TextDocumentItem item) {
            if (cell == null || item == null) {
                return;
            }
            CellState cellState = new TestableCellState(cell, item, getNotebookDocument().getUri());
            getCellsMap().put(item.getUri(), cellState);
        }
    }

    private static class TestableCellState extends CellState {

        private static final Map<String, CellStateResponse> mockResponses = new HashMap<>();

        public static void setMockResponseForUri(String uri, String text, int version) {
            mockResponses.put(uri, new CellStateResponse(text, version));
        }

        public static void clearMockResponses() {
            mockResponses.clear();
        }

        TestableCellState(NotebookCell notebookCell, TextDocumentItem details, String notebookUri) {
            super(notebookCell, details, notebookUri);
        }

        @Override
        protected CompletableFuture<CellStateResponse> requestLatestCellState() {
            CellStateResponse mockResponse = mockResponses.get(this.getCellUri());
            if (mockResponse != null) {
                return CompletableFuture.completedFuture(mockResponse);
            }
            return CompletableFuture.completedFuture(new CellStateResponse("", -1));
        }
    }
}
