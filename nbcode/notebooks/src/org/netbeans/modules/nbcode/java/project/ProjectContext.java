/*
/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.netbeans.modules.nbcode.java.project;

import java.net.MalformedURLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.netbeans.api.project.FileOwnerQuery;
import org.netbeans.api.project.Project;
import org.netbeans.api.project.ProjectUtils;
import org.netbeans.modules.java.lsp.server.LspServerState;
import org.netbeans.modules.java.lsp.server.Utils;
import org.netbeans.modules.java.lsp.server.input.QuickPickItem;
import org.netbeans.modules.java.lsp.server.input.ShowQuickPickParams;
import org.netbeans.modules.java.lsp.server.protocol.NbCodeLanguageClient;
import org.openide.filesystems.FileObject;
import org.openide.util.Exceptions;
import org.openide.util.Lookup;
import org.openide.util.NbBundle;

/**
 *
 * @author atalati
 */
@NbBundle.Messages({
    "PROMPT_SelectProjectTitle=Select Project",
    "# {0} - project name",
    "LBL_CurrentProjectContext=Current project context: {0}",
    "MSG_NoProjectFound=No projects found",
    "MSG_NoProjectContextFound=No project context"
})
public class ProjectContext {

    public static Project getProject(String uri) {
        try {
            if (uri == null) {
                return null;
            }
            FileObject file = Utils.fromUri(uri);
            Project prj = FileOwnerQuery.getOwner(file);

            return prj;
        } catch (MalformedURLException ex) {
            Exceptions.printStackTrace(ex);
        }
        return null;
    }

    public static CompletableFuture<Project> getProject() {
        return getProject(false, null);
    }

    public static CompletableFuture<Project> getProject(boolean forceShowQuickPick, ProjectContextInfo prjCxtInfo) {
        LspServerState serverState = Lookup.getDefault().lookup(LspServerState.class);
        if (serverState == null) {
            return CompletableFuture.completedFuture(null);
        }
        if (forceShowQuickPick) {
            return serverState.openedProjects()
                    .thenCompose(prjs -> selectFromMultipleProjects(prjs, prjCxtInfo).thenApply(res
                    -> res.isEmpty() ? null : res.get(0)));
        }
        return serverState.openedProjects().thenCompose(prjs -> {
            switch (prjs.length) {
                case 0:
                    return CompletableFuture.completedFuture(null);
                case 1:
                    return CompletableFuture.completedFuture(prjs[0]);
                default:
                    return selectFromMultipleProjects(prjs, prjCxtInfo).thenApply(res
                            -> res.isEmpty() ? null : res.get(0));
            }
        });
    }

    private static CompletableFuture<List<Project>> selectFromMultipleProjects(Project[] prjs, ProjectContextInfo defaultPrjSelected) {
        NbCodeLanguageClient client = Lookup.getDefault().lookup(NbCodeLanguageClient.class);
        if (client == null) {
            return CompletableFuture.completedFuture(new ArrayList<>());
        }
        String title = Bundle.PROMPT_SelectProjectTitle();
        List<QuickPickItem> items = new ArrayList<>();
        Map<String, Project> prjMap = new HashMap<>();
        for (Project prj : prjs) {
            String displayName = ProjectUtils.getInformation(prj).getDisplayName();
            QuickPickItem item = new QuickPickItem(displayName);
            prjMap.put(displayName, prj);
            items.add(item);
        }
        String placeholder = defaultPrjSelected != null ? Bundle.LBL_CurrentProjectContext(defaultPrjSelected.getName())
                : items.isEmpty() ? Bundle.MSG_NoProjectFound() : Bundle.MSG_NoProjectFound();

        ShowQuickPickParams params = new ShowQuickPickParams(title, placeholder, false, items);
        return client.showQuickPick(params).thenApply(selected -> {
            List<Project> res = new ArrayList<>();
            if (selected == null) {
                return res;
            }
            for (QuickPickItem item : selected) {
                if (prjMap.containsKey(item.getLabel())) {
                    res.add(prjMap.get(item.getLabel()));
                }
            }
            return res;
        });
    }
}
