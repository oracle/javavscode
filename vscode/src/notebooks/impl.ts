import * as vscode from 'vscode';

export class IJNBNotebookSerializer implements vscode.NotebookSerializer {
  async deserializeNotebook(content: Uint8Array, _token: vscode.CancellationToken): Promise<vscode.NotebookData> {
    let notebook: any;
    const contents = this.decoder.decode(content);

    console.log(`Content Size: ${content.length}`);
    console.log("Decoded Content: ", contents);

    if (!contents.trim()) {
      return new vscode.NotebookData([
        new vscode.NotebookCellData(
          vscode.NotebookCellKind.Markup,
          '# Error: Empty Notebook\n\nThe notebook file appears to be empty.',
          'markdown'
        )
      ]);
    }

    try {
      notebook = JSON.parse(contents);
    } catch (error) {
      console.error('Failed to parse notebook content:', error);
      vscode.window.showErrorMessage(`Failed to open notebook: ${(error as Error).message}`);

      return new vscode.NotebookData([
        new vscode.NotebookCellData(
          vscode.NotebookCellKind.Markup,
          `# Error Opening Notebook\n\nThere was an error parsing the notebook file. The file may be corrupted or in an invalid format.\n\nError details: ${(error as Error).message}`,
          'markdown'
        )
      ]);
    }

    if (!notebook || !Array.isArray(notebook.cells)) {
      console.error('Invalid notebook structure');
      vscode.window.showErrorMessage('The notebook file has an invalid structure.');
      return new vscode.NotebookData([
        new vscode.NotebookCellData(
          vscode.NotebookCellKind.Markup,
          '# Error: Invalid Notebook Structure\n\nThe notebook file does not have the expected structure.',
          'markdown'
        )
      ]);
    }

    const cells = notebook.cells.map((cell: any) => {
      if (typeof cell.cell_type !== 'string' || !Array.isArray(cell.source)) {
        console.warn('Invalid cell structure:', cell);
        return new vscode.NotebookCellData(
          vscode.NotebookCellKind.Markup,
          '# Error: Invalid Cell\n\nThis cell could not be parsed correctly.',
          'markdown'
        );
      }

      const cellContent = cell.source.join('');

      return new vscode.NotebookCellData(
        cell.cell_type === 'code' ? vscode.NotebookCellKind.Code : vscode.NotebookCellKind.Markup,
        cellContent,
        cell.cell_type === 'code' ? 'java' : 'markdown'
      );
    });

    return new vscode.NotebookData(cells);
  }

  async serializeNotebook(data: vscode.NotebookData, _token: vscode.CancellationToken): Promise<Uint8Array> {
    const notebook = {
      cells: data.cells.map(cell => ({
        cell_type: cell.kind === vscode.NotebookCellKind.Code ? 'code' : 'markdown',
        source: [cell.value],
        metadata: {
          ...cell.metadata,
          language: cell.languageId
        },
        execution_count: null,
        outputs: cell.outputs
      })),
      metadata: {
        language_info: {
          name: 'java'
        },
        orig_nbformat: 4
      },
      nbformat: 4,
      nbformat_minor: 2
    };

    return this.encoder.encode(JSON.stringify(notebook, null, 2));
  }

  private readonly decoder = new TextDecoder();
  private readonly encoder = new TextEncoder();
}

export class IJNBKernel implements vscode.Disposable {
  private readonly controller: vscode.NotebookController;

  constructor() {
    this.controller = vscode.notebooks.createNotebookController(
      'ijnb-kernel',
      'ijnb-notebook',
      'IJNB Kernel'
    );

    this.controller.supportedLanguages = ['markdown', 'java'];
    this.controller.supportsExecutionOrder = true;
    this.controller.executeHandler = this.executeCell.bind(this);
    
    // Listen for notebook close events to clean up resources
    vscode.workspace.onDidCloseNotebookDocument(this.onNotebookClosed.bind(this));
  }

  dispose() {
    this.controller.dispose();
  }
  
  private onNotebookClosed(notebook: vscode.NotebookDocument): void {
    // Clean up JShell instance when notebook is closed
    try {
      vscode.commands.executeCommand("jdk.jshell.cleanup", notebook.uri.toString());
    } catch (err) {
      console.error(`Error cleaning up JShell for notebook: ${err}`);
    }
  }

  private async executeCell(cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, _controller: vscode.NotebookController): Promise<void> {
    console.log("Starting execution for cells:", cells);
    
    // Use notebook URI as the unique identifier
    const notebookId = notebook.uri.toString();

    for (let cell of cells) {
      console.log("Executing cell:", cell.document.getText());

      const execution = this.controller.createNotebookCellExecution(cell);
      execution.executionOrder = 1;
      execution.start(Date.now());

      try {
        const cellContent = cell.document.getText();
        console.log("Cell content:", cellContent);

        if (cell.document.languageId === 'markdown') {
          await execution.replaceOutput([
            new vscode.NotebookCellOutput([
              vscode.NotebookCellOutputItem.text(cellContent)
            ])
          ]);
        } else {
          const response: string[] = await vscode.commands.executeCommand(
            "jdk.jshell.execute.cell", 
            cellContent, 
            notebookId
          );
          
          console.log("Response:", response);
          const outputContent = response.join('\n');
          await execution.replaceOutput([
            new vscode.NotebookCellOutput([
              vscode.NotebookCellOutputItem.text(outputContent)
            ])
          ]);
        }

        execution.end(true, Date.now());

      } catch (err) {
        console.error(`Error executing cell: ${err}`);
        
        // Show error in cell output
        await execution.replaceOutput([
          new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.error({
              name: 'Execution Error',
              message: `${err}`
            })
          ])
        ]);
        
        execution.end(false, Date.now());
      }
    }
  }
}