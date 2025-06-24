import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { isNbCommandRegistered } from '../commands/utils';
import { nbCommands } from '../commands/commands';
import { globalState } from '../globalState';
import { getConfigurationValue } from '../configurations/handlers';
import { configKeys } from '../configurations/configuration';

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

            if (output.data) {
              // Handle text/plain
              if (output.data['text/plain']) {
                const text = Array.isArray(output.data['text/plain'])
                  ? output.data['text/plain'].join('\n')
                  : output.data['text/plain'];
                items.push(vscode.NotebookCellOutputItem.text(text, 'text/plain'));
              }

              // Handle image formats
              for (const mimeType in output.data) {
                if (mimeType.startsWith('image/')) {
                  const base64Data = Array.isArray(output.data[mimeType])
                    ? output.data[mimeType].join('')
                    : output.data[mimeType];
                  
                  // Convert base64 string to Uint8Array
                  const imageData = this.base64ToUint8Array(base64Data);
                  items.push(new vscode.NotebookCellOutputItem(imageData, mimeType));
                }
              }
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
            const outputData: any = {
              output_type: 'execute_result',
              data: {},
              metadata: output.metadata,
              execution_count: cell.executionSummary?.executionOrder ?? null
            };

            for (const item of output.items) {
              const errorItem = item.mime === 'application/vnd.code.notebook.error';
              if (errorItem) {
                const errorData = JSON.parse(Buffer.from(item.data).toString());
                return {
                  output_type: 'error',
                  ename: errorData.name,
                  evalue: errorData.message,
                  traceback: errorData.stack ? [errorData.stack] : []
                };
              }

              // Handle text items
              if (item.mime === 'text/plain') {
                outputData.data['text/plain'] = Buffer.from(item.data).toString();
              }
              // Handle image items
              else if (item.mime.startsWith('image/')) {
                // Convert binary data to base64 string for storage
                outputData.data[item.mime] = this.uint8ArrayToBase64(item.data);
              }
            }

            return outputData;
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

  private base64ToUint8Array(base64: string): Uint8Array {
    if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
      return Buffer.from(base64, 'base64');
    } else {
      return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    }
  }

  private uint8ArrayToBase64(data: Uint8Array): string {
    if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
      return Buffer.from(data).toString('base64');
    } else {
      return btoa(String.fromCharCode.apply(null, Array.from(data)));
    }
  }
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
  }

  dispose() {
    this.controller.dispose();
  }

  private async executeCell(cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, _controller: vscode.NotebookController): Promise<void> {
    console.log("Starting execution for cells:", cells);

    const notebookId = notebook.uri.toString();
    const classpath = getConfigurationValue(configKeys.notebookClasspath);

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
            const response: { data: string, mimeType: string }[] = await vscode.commands.executeCommand(
              nbCommands.executeNotebookCell,
              cellContent,
              notebookId,
              classpath || null
            );

            console.log("Response:", response);
            const outputMap: Map<string, string[]> = new Map<string, string[]>();
            response.forEach((el) => {
              if (!outputMap.has(el.mimeType)) {
                outputMap.set(el.mimeType, [el.data]);
              } else {
                outputMap.set(el.mimeType, [...outputMap.get(el.mimeType)!, el.data]);
              }
            });
            const output: vscode.NotebookCellOutputItem[] = [];
            for (const [mimeType, value] of outputMap) {
              if (mimeType.startsWith('image')) {
                output.push(createNotebookCellOutput(value[0], mimeType));
              } else {
                output.push(createNotebookCellOutput(value.join("\n"), mimeType));
              }
            }
            await execution.replaceOutput([
              new vscode.NotebookCellOutput(output.length ? output : [vscode.NotebookCellOutputItem.text('')])
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

const createNotebookCellOutput = (data: string, mimeType: string): vscode.NotebookCellOutputItem => {
  if (mimeType.startsWith('image')) {
    return new vscode.NotebookCellOutputItem(base64ToUint8Array(data), mimeType);
  }
  return vscode.NotebookCellOutputItem.text(data, mimeType);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    return Buffer.from(base64, 'base64');
  } else {
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  }
}