import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { LOGGER } from '../logger';
import { commands, Uri, window, workspace } from 'vscode';
import { isError } from '../utils';
import { extCommands, nbCommands } from './commands';
import { ICommand } from './types';
import { LanguageClient } from 'vscode-languageclient/node';
import { globalState } from '../globalState';
import { getContextUri, isNbCommandRegistered } from './utils';
import { l10n } from '../localiser';
import { extConstants } from '../constants';
import { Notebook } from '../notebooks/notebook';
import { ICodeCell } from '../notebooks/types';
import { randomUUID } from 'crypto';

const createNewNotebook = async (ctx?: any) => {
    try {
        let notebookDir: Uri | null = null;

        if (!ctx) {
            let defaultUri: Uri | null = null;
            const activeFilePath = window.activeTextEditor?.document.uri;

            if (activeFilePath) {
                const parentDir = Uri.parse(path.dirname(activeFilePath.fsPath));
                if (workspace.getWorkspaceFolder(parentDir)) {
                    defaultUri = parentDir;
                }
            }
            if (defaultUri == null) {
                const workspaceFolders = workspace.workspaceFolders;
                defaultUri = workspaceFolders?.length === 1 ? workspaceFolders[0].uri : null;
                if (defaultUri == null) {
                    if (workspaceFolders && workspaceFolders.length > 1) {
                        const userPref = await window.showWorkspaceFolderPick({
                            placeHolder: "Select workspace folder in which notebook needs to be created",
                            ignoreFocusOut: true
                        });
                        if (userPref) {
                            defaultUri = userPref.uri;
                        }
                    }
                }
                if (defaultUri == null) {
                    defaultUri = Uri.parse(os.homedir());
                }
            }

            const nbFolderPath = await window.showOpenDialog({
                canSelectFolders: true,
                canSelectFiles: false,
                canSelectMany: false,
                defaultUri,
                openLabel: "Select Notebook creation folder",
                title: "Select folder in which notebook needs to be created"
            });

            if (nbFolderPath) {
                notebookDir = nbFolderPath[0];
            }
        } else {
            notebookDir = getContextUri(ctx) || null;
        }
        if (notebookDir == null) {
            window.showErrorMessage("Path not selected for creating new notebook");
            return;
        }

        const notebookName = await window.showInputBox({
            prompt: `Enter new Java notebook (${extConstants.NOTEBOOK_FILE_EXTENSION}) or (.ipynb) file name`,
            value: `Untitled.${extConstants.NOTEBOOK_FILE_EXTENSION}`
        });

        if (!notebookName?.trim()) {
            window.showErrorMessage("Invalid notebook file name");
            return;
        }
        const notebookNameWithExt = notebookName.endsWith(extConstants.NOTEBOOK_FILE_EXTENSION) || notebookName.endsWith('.ipynb') ?
            notebookName : `${notebookName}.${extConstants.NOTEBOOK_FILE_EXTENSION}`;

        const finalNotebookPath = path.join(notebookDir.fsPath, notebookNameWithExt);

        LOGGER.log(`Attempting to create notebook at: ${finalNotebookPath}`);

        if (fs.existsSync(finalNotebookPath)) {
            window.showErrorMessage("Notebook already exists, please try creating with some different name");
            return;
        }

        const newCell: ICodeCell = {
            cell_type: 'code',
            execution_count: null,
            outputs: [],
            id: randomUUID(),
            metadata: {},
            source: ''
        };

        const emptyNotebook = new Notebook([newCell]).toJSON();

        await fs.promises.writeFile(finalNotebookPath, JSON.stringify(emptyNotebook, null, 2), { encoding: 'utf8' });

        LOGGER.log(`Created notebook at: ${finalNotebookPath}`);

        const notebookUri = Uri.file(finalNotebookPath);
        const notebookDocument = await workspace.openNotebookDocument(notebookUri);
        await window.showNotebookDocument(notebookDocument);
    } catch (error) {
        LOGGER.error(`Error occurred while creating new notebook: ${isError(error) ? error.message : error}`);

        window.showErrorMessage(`Failed to create new notebook`);
    }
};

const openJshellInContextOfProject = async (ctx: any) => {
    try {
        let client: LanguageClient = await globalState.getClientPromise().client;
        if (await isNbCommandRegistered(nbCommands.openJshellInProject)) {
            const res: string[] = await commands.executeCommand(nbCommands.openJshellInProject, getContextUri(ctx)?.toString());
            const { envMap, finalArgs } = passArgsToTerminal(res);
            // Direct sendText is not working since it truncates the command exceeding a certain length.
            // Open issues on vscode: 130688, 134324 and many more
            // So, workaround by setting env variables.
            const terminal = window.createTerminal({
                name: "Jshell instance", env: envMap
            });
            terminal.sendText(`jshell ${finalArgs.join(' ')}`, true);
            terminal.show();
        } else {
            throw l10n.value("jdk.extension.error_msg.doesntSupportGoToTest", { client });
        }
    } catch (error) {
        window.showErrorMessage("Some error occurred while launching jshell");
        LOGGER.error(`Error occurred while launching jshell in project context : ${isError(error) ? error.message : error}`);
    }
}

const passArgsToTerminal = (args: string[]): { envMap: { [key: string]: string }, finalArgs: string[] } => {
    const envMap: { [key: string]: string } = {};
    const finalArgs = args.map((arg, index) => {
        if (arg.startsWith('-') || arg.startsWith('--')) {
            return arg;
        }
        const envName = `jshellArgsEnv${index}`;
        envMap[envName] = arg;
        return `$${envName}`;
    });
    return { envMap, finalArgs };
}

export const registerNotebookCommands: ICommand[] = [
    {
        command: extCommands.createNotebook,
        handler: createNewNotebook
    },
    {
        command: extCommands.openJshellInProject,
        handler: openJshellInContextOfProject
    }
];