import { ExtensionContext, workspace } from "vscode";
import { IJNBKernel } from "./kernel";
import { IJNBNotebookSerializer } from "./serializer";

export const registerNotebooks = (context: ExtensionContext) => {
    context.subscriptions.push(
        workspace.registerNotebookSerializer(
            'ijnb-notebook',
            new IJNBNotebookSerializer()
    ));

    const kernel = new IJNBKernel();
    context.subscriptions.push(kernel);
}