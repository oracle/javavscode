import { ExtensionContext, workspace } from "vscode";
import { IJNBKernel, IJNBNotebookSerializer } from "./impl";

export const registerNotebooks = (context: ExtensionContext) => {
    context.subscriptions.push(
        workspace.registerNotebookSerializer(
            'ijnb-notebook',
            new IJNBNotebookSerializer()),
        new IJNBKernel()
    );
}