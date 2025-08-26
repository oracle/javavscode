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

import java.io.File;
import java.net.URL;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import org.eclipse.lsp4j.jsonrpc.validation.NonNull;
import org.netbeans.api.java.classpath.ClassPath;
import org.netbeans.api.java.platform.JavaPlatform;
import org.netbeans.api.java.platform.JavaPlatformManager;
import org.netbeans.api.java.platform.Specification;
import org.netbeans.api.java.project.JavaProjectConstants;
import org.netbeans.api.java.queries.UnitTestForSourceQuery;
import org.netbeans.api.project.Project;
import org.netbeans.api.project.SourceGroup;
import org.openide.filesystems.FileObject;
import org.netbeans.api.project.ProjectUtils;
import org.netbeans.spi.project.ActionProgress;
import org.netbeans.spi.project.ActionProvider;
import org.openide.filesystems.FileUtil;
import org.openide.modules.SpecificationVersion;
import org.openide.util.lookup.Lookups;

/**
 *
 * @author atalati
 */
public class ProjectConfigurationUtils {

    public final static String CLASS_PATH = "--class-path";
    public final static String MODULE_PATH = "--module-path";
    public final static String ADD_MODULES = "--add-modules";
    public final static String ADD_EXPORTS = "--add-exports";

    public static boolean isNonTestRoot(SourceGroup sg) {
        return UnitTestForSourceQuery.findSources(sg.getRootFolder()).length == 0;
    }

    public static boolean isNonTestRoot(FileObject root) {
        return UnitTestForSourceQuery.findSources(root).length == 0;
    }

    public static String addRoots(String prev, ClassPath cp) {
        FileObject[] roots = cp.getRoots();
        StringBuilder sb = new StringBuilder(prev);

        for (FileObject r : roots) {
            FileObject ar = FileUtil.getArchiveFile(r);
            if (ar == null) {
                ar = r;
            }
            File f = FileUtil.toFile(ar);
            if (f != null) {
                if (sb.length() > 0) {
                    sb.append(File.pathSeparatorChar);
                }
                sb.append(f.getPath());
            }
        }
        return sb.toString();
    }

    public static Set<URL> to2Roots(ClassPath bootCP) {
        Set<URL> roots = new HashSet<>();
        for (ClassPath.Entry e : bootCP.entries()) {
            roots.add(e.getURL());
        }
        return roots;
    }

    public static List<FileObject> findProjectRoots(Project project) {
        List<FileObject> roots = new ArrayList<>();
        if (project == null) {
            return roots;
        }
        for (SourceGroup sg : ProjectUtils.getSources(project).getSourceGroups(JavaProjectConstants.SOURCES_TYPE_JAVA)) {
            roots.add(sg.getRootFolder());
        }
        return roots;
    }

    public static List<FileObject> getNonTestRoots(Project project) {
        List<FileObject> roots = findProjectRoots(project);
        return roots.stream().filter(root -> isNonTestRoot(root)).toList();
    }

    public static JavaPlatform findPlatform(Project project) {
        List<FileObject> ref = findProjectRoots(project);
        if (ref.isEmpty()) {
            return null;
        }
        JavaPlatform platform = findPlatform(ClassPath.getClassPath(ref.get(0), ClassPath.BOOT));
        return platform != null ? platform : JavaPlatform.getDefault();
    }

    private static JavaPlatform findPlatform(ClassPath bootCP) {
        Set<URL> roots = to2Roots(bootCP);
        for (JavaPlatform platform : JavaPlatformManager.getDefault().getInstalledPlatforms()) {
            Set<URL> platformRoots = to2Roots(platform.getBootstrapLibraries());
            if (platformRoots.containsAll(roots)) {
                return platform;
            }
        }
        return null;
    }

    @NonNull
    public static List<String> launchVMOptions(Project project) {
        if (project == null) {
            return new ArrayList<>();
        }
        boolean isModular = ProjectModulePathConfigurationUtils.isModularProject(project);
        if (isModular) {
            return ProjectModulePathConfigurationUtils.getVmOptions(project);
        }
        List<String> vmOptions = new ArrayList<>();
        List<FileObject> roots = getNonTestRoots(project);
        if (!roots.isEmpty()) {
            ClassPath cp = ClassPath.getClassPath(roots.getFirst(), ClassPath.EXECUTE);
            vmOptions.addAll(Arrays.asList(CLASS_PATH, addRoots("", cp)));
        }
        return vmOptions;
    }

    @NonNull
    public static List<String> compilerOptions(Project project) {
        if (project == null) {
            return new ArrayList<>();
        }
        boolean isModular = ProjectModulePathConfigurationUtils.isModularProject(project);
        if (isModular) {
            return ProjectModulePathConfigurationUtils.getCompileOptions(project);
        }
        List<String> compileOptions = new ArrayList<>();
        List<FileObject> roots = getNonTestRoots(project);
        if (!roots.isEmpty()) {
            ClassPath cp = ClassPath.getClassPath(roots.getFirst(), ClassPath.COMPILE);
            compileOptions.addAll(Arrays.asList(CLASS_PATH, addRoots("", cp)));
        }
        return compileOptions;
    }

    public static boolean isModularJDK(JavaPlatform pl) {
        if (pl != null) {
            Specification plSpec = pl.getSpecification();
            SpecificationVersion jvmversion = plSpec.getVersion();
            if (jvmversion.compareTo(new SpecificationVersion("9")) >= 0) {
                return true;
            }
        }
        return false;
    }

    public static CompletableFuture<Boolean> buildProject(Project project) {
        CompletableFuture<Boolean> future = new CompletableFuture<>();
        ActionProvider p = project.getLookup().lookup(ActionProvider.class);

        if (p == null || !p.isActionEnabled(ActionProvider.COMMAND_BUILD, Lookups.singleton(project))) {
            future.completeExceptionally(new IllegalStateException("Build action not enabled"));
            return future;
        }
        p.invokeAction(ActionProvider.COMMAND_BUILD, Lookups.fixed(project, new ActionProgress() {
            @Override
            protected void started() {
                // no op
            }

            @Override
            public void finished(boolean success) {
                if (success) {
                    future.complete(true);
                } else {
                    future.complete(false);
                }
            }
        }));
        return future;
    }
}
