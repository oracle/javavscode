import { workspace } from "vscode";
import { ExtensionContextInfo } from "../extensionContextInfo";
import { IJNBKernel, IJNBNotebookSerializer } from "./impl";

export const registerNotebooks = (context: ExtensionContextInfo) => {
    context.getExtensionContext().subscriptions.push(
        workspace.registerNotebookSerializer(
            'ijnb-notebook',
            new IJNBNotebookSerializer()),
        new IJNBKernel()
    );
}