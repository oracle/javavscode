import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { LOGGER } from '../logger';
import { commands, ConfigurationTarget, Uri, window, workspace } from 'vscode';
import { isError } from '../utils';
import { extCommands, nbCommands } from './commands';
import { ICommand } from './types';
import { LanguageClient } from 'vscode-languageclient/node';
import { globalState } from '../globalState';
import { getContextUri, isNbCommandRegistered } from './utils';
import { l10n } from '../localiser';
import { extConstants } from '../constants';
import { Notebook } from '../notebooks/notebook';
import { ICodeCell, INotebookToolbar } from '../notebooks/types';
import { randomUUID } from 'crypto';
import { getConfigurationValue, updateConfigurationValue } from '../configurations/handlers';
import { configKeys } from '../configurations/configuration';

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
                            placeHolder: l10n.value("jdk.notebook.create.select.workspace.folder"),
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
                openLabel: l10n.value("jdk.notebook.create.select.workspace.folder.label"),
                title: l10n.value("jdk.notebook.create.select.workspace.folder.title")
            });

            if (nbFolderPath) {
                notebookDir = nbFolderPath[0];
            }
        } else {
            notebookDir = getContextUri(ctx) || null;
        }
        if (notebookDir == null) {
            window.showErrorMessage(l10n.value("jdk.notebook.create.error_msg.path.not.selected"));
            return;
        } else if(!fs.existsSync(notebookDir.fsPath)){
            window.showErrorMessage(l10n.value("jdk.notebook.create.error_msg.dir.not.found"));
            return;
        }

        const notebookName = await window.showInputBox({
            prompt: l10n.value("jdk.notebook.create.new.notebook.input.name"),
            value: `Untitled.${extConstants.NOTEBOOK_FILE_EXTENSION}`
        });

        if (!notebookName?.trim()) {
            window.showErrorMessage(l10n.value("jdk.notebook.create.error_msg.invalid.notebook.name"));
            return;
        }
        const notebookNameWithExt = notebookName.endsWith(extConstants.NOTEBOOK_FILE_EXTENSION) ?
            notebookName : `${notebookName}.${extConstants.NOTEBOOK_FILE_EXTENSION}`;

        const finalNotebookPath = path.join(notebookDir.fsPath, notebookNameWithExt);

        LOGGER.log(`Attempting to create notebook at: ${finalNotebookPath}`);

        if (fs.existsSync(finalNotebookPath)) {
            window.showErrorMessage(l10n.value("jdk.notebook.create.error_msg.invalid.notebook.path"));
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

        window.showErrorMessage(l10n.value("jdk.notebook.create.error_msg.failed"));
    }
};

type openJshellNbResponse = {
    jdkPath: string,
    vmOptions: string[]
}

const openJshellInContextOfProject = async (ctx: any) => {
    try {
        let client: LanguageClient = await globalState.getClientPromise().client;
        if (await isNbCommandRegistered(nbCommands.openJshellInProject)) {
            const additionalContext = window.activeTextEditor?.document.uri.toString();
            const res = await commands.executeCommand<openJshellNbResponse>(nbCommands.openJshellInProject, ctx?.toString(), additionalContext);
            const { envMap, finalArgs } = passArgsToTerminal(res.vmOptions);
            const jshellPath = res.jdkPath ? path.join(res.jdkPath, "bin", "jshell") : "jshell";
            // Direct sendText is not working since it truncates the command exceeding a certain length.
            // Open issues on vscode: 130688, 134324 and many more
            // So, workaround by setting env variables.
            const terminal = window.createTerminal({
                name: "Jshell instance", env: envMap
            });
            terminal.sendText(`${jshellPath} ${finalArgs.join(' ')}`, true);
            terminal.show();
        } else {
            throw l10n.value("jdk.extension.error_msg.doesntSupportJShellExecution", { client: client?.name });
        }
    } catch (error) {
        window.showErrorMessage(l10n.value("jdk.jshell.open.error_msg.failed"));
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

const notebookChangeProjectContextHandler = async (ctx: INotebookToolbar) => {
    try {
        const uri: Uri = ctx.notebookEditor.notebookUri;

        let client: LanguageClient = await globalState.getClientPromise().client;
        if (await isNbCommandRegistered(nbCommands.createNotebookProjectContext)) {
            const res = await commands.executeCommand<string | null>(nbCommands.createNotebookProjectContext, uri.toString());
            if (!res) {
                return;
            }
            const oldValue = getConfigurationValue(configKeys.notebookProjectMapping, {});
            updateConfigurationValue(configKeys.notebookProjectMapping,
                { ...oldValue, [uri.fsPath]: res },
                ConfigurationTarget.Workspace);
        } else {
            throw l10n.value("jdk.extension.error_msg.doesntSupportNotebookCellExecution", { client: client?.name });
        }
    } catch (error) {
        LOGGER.error(`Error occurred while opening notebook : ${isError(error) ? error.message : error}`);
        window.showErrorMessage(l10n.value("jdk.notebook.project.mapping.error_msg.failed"));
    }
}


export const registerNotebookCommands: ICommand[] = [
    {
        command: extCommands.createNotebook,
        handler: createNewNotebook
    },
    {
        command: extCommands.openJshellInProject,
        handler: openJshellInContextOfProject
    },
    {
        command: extCommands.notebookChangeProjectContext,
        handler: notebookChangeProjectContextHandler
    }
];