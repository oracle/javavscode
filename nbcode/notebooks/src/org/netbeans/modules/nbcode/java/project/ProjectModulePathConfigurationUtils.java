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

import java.net.URL;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.netbeans.api.java.classpath.ClassPath;
import org.netbeans.api.java.classpath.JavaClassPathConstants;
import org.netbeans.api.java.platform.JavaPlatform;
import org.netbeans.api.java.queries.BinaryForSourceQuery;
import org.netbeans.api.java.queries.SourceLevelQuery;
import org.netbeans.api.java.source.ClassIndex;
import org.netbeans.api.java.source.ClasspathInfo;
import org.netbeans.api.java.source.SourceUtils;
import org.netbeans.api.project.Project;
import org.netbeans.spi.java.classpath.support.ClassPathSupport;
import org.openide.filesystems.FileObject;
import org.openide.filesystems.URLMapper;
import org.openide.modules.SpecificationVersion;

/**
 * Methods in this class are taken from the org.netbeans.modules.jshell.support
 * module
 *
 * @author atalati
 */
public class ProjectModulePathConfigurationUtils {

    /**
     * Returns set of modules imported by the project. Adds to the passed
     * collection if not null. Module names from `required` clause will be
     * returned
     *
     * @param project the project
     * @param in optional; the collection
     * @return original collection or a new one with imported modules added
     */
    private static Collection<String> findProjectImportedModules(Project project, Collection<String> in) {
        Collection<String> result = in != null ? in : new HashSet<>();
        if (project == null) {
            return result;
        }
        List<FileObject> roots = ProjectConfigurationUtils.getNonTestRoots(project);
        for (FileObject root : roots) {
            ClasspathInfo cpi = ClasspathInfo.create(root);
            ClassPath mcp = cpi.getClassPath(ClasspathInfo.PathKind.COMPILE);

            for (FileObject r : mcp.getRoots()) {
                URL u = URLMapper.findURL(r, URLMapper.INTERNAL);
                String modName = SourceUtils.getModuleName(u);
                if (modName != null) {
                    result.add(modName);
                }
            }
        }

        return result;
    }

    private static Set<String> findProjectModules(Project project, Set<String> in) {
        Set<String> result = in != null ? in : new HashSet<>();
        if (project == null) {
            return result;
        }

        List<FileObject> roots = ProjectConfigurationUtils.getNonTestRoots(project);
        for (FileObject root : roots) {
            FileObject fo = root.getFileObject("module-info.java");
            if (fo == null) {
                continue;
            }
            URL u = URLMapper.findURL(root, URLMapper.INTERNAL);
            BinaryForSourceQuery.Result r = BinaryForSourceQuery.findBinaryRoots(u);
            for (URL u2 : r.getRoots()) {
                String modName = SourceUtils.getModuleName(u2, true);
                if (modName != null) {
                    result.add(modName);
                }
            }
        }
        return result;
    }

    /**
     * Collects project modules and packages from them. For each modules,
     * provides a list of (non-empty) packages from that module.
     *
     * @param project
     * @return
     */
    private static Map<String, Collection<String>> findProjectModulesAndPackages(Project project) {
        Map<String, Collection<String>> result = new HashMap<>();
        if (project == null) {
            return result;
        }

        List<FileObject> roots = ProjectConfigurationUtils.getNonTestRoots(project);
        for (FileObject root : roots) {
            URL u = URLMapper.findURL(root, URLMapper.INTERNAL);
            BinaryForSourceQuery.Result r = BinaryForSourceQuery.findBinaryRoots(u);
            for (URL u2 : r.getRoots()) {
                String modName = SourceUtils.getModuleName(u2, true);
                if (modName != null) {
                    FileObject rootMod = URLMapper.findFileObject(u);
                    Collection<String> pkgs = getPackages(rootMod); //new HashSet<>();
                    if (!pkgs.isEmpty()) {
                        Collection<String> oldPkgs = result.get(modName);
                        if (oldPkgs != null) {
                            oldPkgs.addAll(pkgs);
                        } else {
                            result.put(modName, pkgs);
                        }
                    }
                }
            }
        }
        return result;
    }

    private static Collection<String> getPackages(FileObject root) {
        ClasspathInfo cpi = ClasspathInfo.create(root);
        // create CPI from just the single source root, to avoid packages from other
        // modules
        ClasspathInfo rootCpi = new ClasspathInfo.Builder(
                cpi.getClassPath(ClasspathInfo.PathKind.BOOT)).
                setClassPath(cpi.getClassPath(ClasspathInfo.PathKind.COMPILE)).
                setModuleSourcePath(cpi.getClassPath(ClasspathInfo.PathKind.MODULE_SOURCE)).
                setModuleCompilePath(cpi.getClassPath(ClasspathInfo.PathKind.MODULE_COMPILE)).
                setSourcePath(
                        ClassPathSupport.createClassPath(root)
                ).build();

        Collection<String> pkgs = new HashSet<>(rootCpi.getClassIndex().getPackageNames("", false,
                Collections.singleton(ClassIndex.SearchScope.SOURCE)));
        pkgs.remove(""); // NOI18N
        return pkgs;
    }

    private static ClassPath getRuntimeModulePath(Project project) {
        List<FileObject> roots = ProjectConfigurationUtils.getNonTestRoots(project);
        if (!roots.isEmpty()) {
            return ClassPath.getClassPath(roots.getFirst(), JavaClassPathConstants.MODULE_EXECUTE_PATH);
        }
        return null;
    }

    private static ClassPath getCompileTimeModulePath(Project project) {
        List<FileObject> roots = ProjectConfigurationUtils.findProjectRoots(project);

        if (!roots.isEmpty()) {
            ClasspathInfo cpi = ClasspathInfo.create(roots.getFirst());
            return cpi.getClassPath(ClasspathInfo.PathKind.COMPILE);
        }
        return null;
    }

    private static List<String> getModuleConfigurations(Project project) {
        List<String> exportMods = new ArrayList<>(
                ProjectModulePathConfigurationUtils.findProjectImportedModules(project,
                        ProjectModulePathConfigurationUtils.findProjectModules(project, null))
        );

        List<String> addReads = new ArrayList<>();
        boolean modular = ProjectModulePathConfigurationUtils.isModularProject(project);
        if (exportMods.isEmpty() || !modular) {
            return addReads;
        }
        Collections.sort(exportMods);
        addReads.add(ProjectConfigurationUtils.ADD_MODULES);
        addReads.add(String.join(",", exportMods));

        // now export everything from the project:
        Map<String, Collection<String>> packages = ProjectModulePathConfigurationUtils.findProjectModulesAndPackages(project);
        for (Map.Entry<String, Collection<String>> en : packages.entrySet()) {
            String p = en.getKey();
            Collection<String> vals = en.getValue();

            for (String v : vals) {
                addReads.add(ProjectConfigurationUtils.ADD_EXPORTS);
                addReads.add(String.format("%s/%s=ALL-UNNAMED", p, v));
            }
        }
        return addReads;
    }

    public static boolean isModularProject(Project project) {
        if (project == null) {
            return false;
        }
        JavaPlatform platform = ProjectConfigurationUtils.findPlatform(project);
        if (platform == null || !ProjectConfigurationUtils.isModularJDK(platform)) {
            return false;
        }

        List<FileObject> roots = ProjectConfigurationUtils.getNonTestRoots(project);
        for (FileObject root : roots) {
            if (root.getFileObject("module-info.java") != null) {
                return true;
            }
        }
        return false;
    }

    public static List<String> getVmOptions(Project project) {
        List<String> vmOptions = new ArrayList<>();
        ClassPath modulePath = getCompileTimeModulePath(project);
        ClassPath classPath = getRuntimeModulePath(project);

        if (modulePath != null && classPath != null) {
            Set<String> compileModulePath = modulePath.entries().stream().map(entry -> entry.getURL().toString()).collect(Collectors.toSet());
            List<FileObject> entries = new ArrayList<>();
            classPath.entries().stream().forEach(entry -> {
                boolean isPresent = compileModulePath.contains(entry.getURL().toString());
                if (!isPresent) {
                    entries.add(entry.getRoot());
                }
            });

            classPath = ClassPathSupport.createClassPath(entries.toArray(FileObject[]::new));
            if (!classPath.entries().isEmpty()) {
                vmOptions.addAll(Arrays.asList(
                        ProjectConfigurationUtils.CLASS_PATH,
                        ProjectConfigurationUtils.addRoots("", classPath)
                ));
            }
            vmOptions.addAll(Arrays.asList(
                    ProjectConfigurationUtils.MODULE_PATH,
                    ProjectConfigurationUtils.addRoots("", modulePath)
            ));

            vmOptions.addAll(getModuleConfigurations(project));
            
        }

        return vmOptions;
    }

    public static List<String> getCompileOptions(Project project) {
        List<String> compileOptions = new ArrayList<>();
        ClassPath modulePath = getCompileTimeModulePath(project);
        ClassPath classPath = getRuntimeModulePath(project);

        if (modulePath != null && classPath != null) {
            compileOptions.addAll(Arrays.asList(
                    ProjectConfigurationUtils.MODULE_PATH,
                    ProjectConfigurationUtils.addRoots("", modulePath)
            ));

            compileOptions.addAll(getModuleConfigurations(project));
        }

        return compileOptions;
    }

}
