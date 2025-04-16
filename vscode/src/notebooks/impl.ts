import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { isNbCommandRegistered } from '../commands/utils';
import { nbCommands } from '../commands/commands';
import { globalState } from '../globalState';

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
      const cellData = new vscode.NotebookCellData(
        cell.cell_type === 'code' ? vscode.NotebookCellKind.Code : vscode.NotebookCellKind.Markup,
        cellContent,
        cell.cell_type === 'code' ? 'java' : 'markdown'
      );

      if (cell.outputs && Array.isArray(cell.outputs)) {
        const outputs: vscode.NotebookCellOutput[] = [];

        for (const output of cell.outputs) {
          if (output.output_type === 'display_data' || output.output_type === 'execute_result') {
            const items: vscode.NotebookCellOutputItem[] = [];

            if (output.data && output.data['text/plain']) {
              const text = Array.isArray(output.data['text/plain'])
                ? output.data['text/plain'].join('\n')
                : output.data['text/plain'];
              items.push(vscode.NotebookCellOutputItem.text(text));
            }

            if (items.length > 0) {
              outputs.push(new vscode.NotebookCellOutput(items, output.metadata));
            }
          } else if (output.output_type === 'stream') {
            const text = Array.isArray(output.text) ? output.text.join('') : output.text;
            outputs.push(new vscode.NotebookCellOutput([
              vscode.NotebookCellOutputItem.text(text)
            ]));
          } else if (output.output_type === 'error') {
            outputs.push(new vscode.NotebookCellOutput([
              vscode.NotebookCellOutputItem.error({
                name: output.ename || 'Error',
                message: output.evalue || 'Unknown error',
                stack: output.traceback ? output.traceback.join('\n') : undefined
              })
            ]));
          }
        }

        if (outputs.length > 0) {
          cellData.outputs = outputs;
        }
      }

      if (cell.execution_count !== null && cell.execution_count !== undefined) {
        cellData.executionSummary = {
          executionOrder: cell.execution_count,
          success: true
        };
      }

      return cellData;
    });

    return new vscode.NotebookData(cells);
  }

  async serializeNotebook(data: vscode.NotebookData, _token: vscode.CancellationToken): Promise<Uint8Array> {
    const notebook = {
      cells: data.cells.map(cell => {
        const cellData: any = {
          cell_type: cell.kind === vscode.NotebookCellKind.Code ? 'code' : 'markdown',
          source: [cell.value],
          metadata: {
            ...cell.metadata,
            language: cell.languageId
          },
          execution_count: cell.executionSummary?.executionOrder ?? null,
          outputs: []
        };

        if (cell.outputs && cell.outputs.length > 0) {
          cellData.outputs = cell.outputs.map(output => {
            const items = output.items;

            const errorItem = items.find(item => item.mime === 'application/vnd.code.notebook.error');
            if (errorItem) {
              const errorData = JSON.parse(Buffer.from(errorItem.data).toString());
              return {
                output_type: 'error',
                ename: errorData.name,
                evalue: errorData.message,
                traceback: errorData.stack ? [errorData.stack] : []
              };
            }

            const textItem = items.find(item => item.mime === 'text/plain');
            if (textItem) {
              return {
                output_type: 'execute_result',
                data: {
                  'text/plain': Buffer.from(textItem.data).toString()
                },
                metadata: output.metadata,
                execution_count: cell.executionSummary?.executionOrder ?? null
              };
            }

            return {
              output_type: 'execute_result',
              data: {},
              metadata: output.metadata,
              execution_count: cell.executionSummary?.executionOrder ?? null
            };
          });
        }

        return cellData;
      }),
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

    vscode.workspace.onDidCloseNotebookDocument(this.onNotebookClosed.bind(this));
  }

  dispose() {
    this.controller.dispose();
  }

  private async onNotebookClosed(notebook: vscode.NotebookDocument): Promise<void> {
    try {
      await globalState.getClientPromise().client;
      if (await isNbCommandRegistered(nbCommands.notebookCleanup)) {
        vscode.commands.executeCommand(nbCommands.notebookCleanup, notebook.uri.toString());
      }
    } catch (err) {
      console.error(`Error cleaning up JShell for notebook: ${err}`);
    }
  }

  private async executeCell(cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, _controller: vscode.NotebookController): Promise<void> {
    console.log("Starting execution for cells:", cells);

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
          await globalState.getClientPromise().client;
          if (await isNbCommandRegistered(nbCommands.executeNotebookCell)) {
            const response: string[] = await vscode.commands.executeCommand(
              nbCommands.executeNotebookCell,
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
          } else {
            throw new Error("Notebook not supported");
          }
        }

        execution.end(true, Date.now());
      } catch (err) {
        console.error(`Error executing cell: ${err}`);

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