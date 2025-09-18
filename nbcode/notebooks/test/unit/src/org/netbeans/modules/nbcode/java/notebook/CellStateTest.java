/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
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

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import org.eclipse.lsp4j.ExecutionSummary;
import org.eclipse.lsp4j.NotebookCell;
import org.eclipse.lsp4j.NotebookCellKind;
import org.eclipse.lsp4j.TextDocumentItem;
import org.netbeans.modules.java.lsp.server.notebook.CellStateResponse;
import org.junit.Before;
import org.junit.Test;
import static org.junit.Assert.*;
import org.netbeans.junit.NbTestCase;

public class CellStateTest extends NbTestCase{

    private static final String NOTEBOOK_URI = "file:///path/to/notebook.ijnb";
    private static final String CELL_URI = "notebook-cell:/path/to/notebook.ijnb#ch0,cell0";
    private static final String INITIAL_CONTENT = "initial content";
    private static final String LANGUAGE_ID = "java";

    private NotebookCell notebookCell;
    private TextDocumentItem textDocumentItem;

    public CellStateTest(String name) {
        super(name);
    }

    @Before
    @Override
    public void setUp() {
        ExecutionSummary summary = new ExecutionSummary();
        summary.setExecutionOrder(1);

        notebookCell = new NotebookCell(NotebookCellKind.Code, CELL_URI);
        notebookCell.setExecutionSummary(summary);
        notebookCell.setMetadata("initial metadata");

        textDocumentItem = new TextDocumentItem(CELL_URI, LANGUAGE_ID, 1, INITIAL_CONTENT);
    }

    /**
     * Test that the constructor correctly initializes all fields of the
     * CellState.
     */
    @Test
    public void testConstructorInitialization() {
        CellState cellState = new CellState(notebookCell, textDocumentItem, NOTEBOOK_URI);

        assertEquals("Cell type should be CODE", NotebookCellKind.Code, cellState.getType());
        assertEquals("Language ID should be 'java'", LANGUAGE_ID, cellState.getLanguage());
        assertEquals("Cell URI should match", CELL_URI, cellState.getCellUri());
        assertEquals("Notebook URI should match", NOTEBOOK_URI, cellState.getNotebookUri());
        assertEquals("Content should be initialized", INITIAL_CONTENT, cellState.getContent());
        assertEquals("Initial version should be 1", 1, cellState.getVersionAwareContent().getVersion());
        assertEquals("Metadata should be initialized", "initial metadata", cellState.getMetadata());
        assertNotNull("Execution summary should not be null", cellState.getExecutionSummary());
        assertEquals("Execution order should be 1", 1, cellState.getExecutionSummary().getExecutionOrder());
    }

    /**
     * Test a simple, successful content update where the new version is
     * sequential.
     */
    @Test
    public void testSetContentSequentialUpdate() throws InterruptedException, ExecutionException {
        CellState cellState = new CellState(notebookCell, textDocumentItem, NOTEBOOK_URI);
        String newContent = "updated content";
        int newVersion = 2;

        cellState.setContent(newContent, newVersion);

        assertEquals("Content should be updated", newContent, cellState.getContent());
        assertEquals("Version should be updated", newVersion, cellState.getVersionAwareContent().getVersion());
    }

    /**
     * Test that an attempt to update with a stale (older or same) version is
     * ignored.
     */
    @Test
    public void testSetContentStaleUpdateIsIgnored() throws InterruptedException, ExecutionException {
        CellState cellState = new CellState(notebookCell, textDocumentItem, NOTEBOOK_URI);

        cellState.setContent("stale content v1", 1);
        assertEquals("Content should not change for same version", INITIAL_CONTENT, cellState.getContent());
        assertEquals("Version should not change for same version", 1, cellState.getVersionAwareContent().getVersion());

        cellState.setContent("stale content v0", 0);
        assertEquals("Content should not change for older version", INITIAL_CONTENT, cellState.getContent());
        assertEquals("Version should not change for older version", 1, cellState.getVersionAwareContent().getVersion());
    }

    /**
     * Test the scenario where there is a version gap, triggering a successful
     * fetch from the client to synchronize the state.
     */
    @Test
    public void testSetContentWithVersionGapSuccess() throws InterruptedException, ExecutionException {
        String latestContentFromServer = "latest content from server";
        int latestVersionFromServer = 5;

        TestableCellState cellState = new TestableCellState(
                notebookCell, textDocumentItem, NOTEBOOK_URI,
                latestContentFromServer, latestVersionFromServer
        );

        cellState.setContent("a newer content", 3);

        assertEquals("Content should be synchronized from client", latestContentFromServer, cellState.getContent());
        assertEquals("Version should be synchronized from client", latestVersionFromServer, cellState.getVersionAwareContent().getVersion());
    }

    /**
     * Test the scenario where a version gap triggers a client fetch, but the
     * client returns a version that is not newer than the current one, causing
     * an exception.
     */
    @Test
    public void testSetContentWithVersionGapMismatchOnFetch() throws InterruptedException {
        String staleContentFromServer = "stale content from server";
        int staleVersionFromServer = 1;

        TestableCellState cellState = new TestableCellState(
                notebookCell, textDocumentItem, NOTEBOOK_URI,
                staleContentFromServer, staleVersionFromServer
        );

        assertThrows(IllegalStateException.class, () -> cellState.setContent("a newer content", 3));
        assertEquals("Content should remain unchanged after failed fetch", INITIAL_CONTENT, cellState.getContent());
        assertEquals("Version should remain unchanged after failed fetch", 1, cellState.getVersionAwareContent().getVersion());
    }

    /**
     * Test that a direct request to fetch and set content works correctly.
     */
    @Test
    public void testRequestContentAndSetSuccess() throws InterruptedException, ExecutionException {
        String latestContentFromServer = "content from direct request";
        int latestVersionFromServer = 10;

        TestableCellState cellState = new TestableCellState(
                notebookCell, textDocumentItem, NOTEBOOK_URI,
                latestContentFromServer, latestVersionFromServer
        );

        cellState.requestContentAndSet();

        assertEquals("Content should be updated from direct request", latestContentFromServer, cellState.getContent());
        assertEquals("Version should be updated from direct request", latestVersionFromServer, cellState.getVersionAwareContent().getVersion());
    }

    /**
     * Test that requestContentAndSet throws an exception if the server provides
     * an invalid version number (e.g., 0 or negative).
     */
    @Test
    public void testRequestContentAndSetWithInvalidVersionFromServer() throws InterruptedException {
        String content = "some content";
        int invalidVersion = 0;

        TestableCellState cellState = new TestableCellState(
                notebookCell, textDocumentItem, NOTEBOOK_URI,
                content, invalidVersion
        );
        
        assertThrows(IllegalStateException.class, () -> cellState.requestContentAndSet());
        assertEquals("Content should remain unchanged after invalid fetch", INITIAL_CONTENT, cellState.getContent());
        assertEquals("Version should remain unchanged after invalid fetch", 1, cellState.getVersionAwareContent().getVersion());
    }

    /**
     * Tests simple setters for metadata and execution summary.
     */
    @Test
    public void testSettersForMetadataAndExecutionSummary() {
        CellState cellState = new CellState(notebookCell, textDocumentItem, NOTEBOOK_URI);

        String newMetadata = "updated metadata";
        cellState.setMetadata(newMetadata);
        assertEquals("Metadata should be updated", newMetadata, cellState.getMetadata());

        ExecutionSummary newSummary = new ExecutionSummary();
        newSummary.setExecutionOrder(100);
        cellState.setExecutionSummary(newSummary);
        assertEquals("ExecutionSummary should be updated", 100, cellState.getExecutionSummary().getExecutionOrder());
    }

    private static class TestableCellState extends CellState {

        private final String mockResponseText;
        private final int mockResponseVersion;

        TestableCellState(NotebookCell notebookCell, TextDocumentItem details, String notebookUri,
                String mockResponseText, int mockResponseVersion) {
            super(notebookCell, details, notebookUri);
            this.mockResponseText = mockResponseText;
            this.mockResponseVersion = mockResponseVersion;
        }

        @Override
        protected CompletableFuture<CellStateResponse> requestLatestCellState() {
            CellStateResponse mockResponse = new CellStateResponse(mockResponseText, mockResponseVersion);
            return CompletableFuture.completedFuture(mockResponse);
        }
    }
}
