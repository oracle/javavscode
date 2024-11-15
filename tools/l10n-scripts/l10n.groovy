#!/usr/bin/env groovy -cp util-jars/commons-vfs2-2.9.0.jar:util-jars/commons-logging-1.3.4.jar:util-jars/commons-lang3-3.17.0.jar:util-jars/jsoup-1.18.1.jar:util-jars/poi-5.2.1.jar:util-jars/commons-io-2.16.1.jar:util-jars/log4j-api-2.24.1.jar:util-jars/log4j-core-2.24.1.jar:util-jars/poi-ooxml-5.2.1.jar:util-jars/poi-ooxml-lite-5.2.1.jar:util-jars/xmlbeans-5.2.1.jar:util-jars/commons-collections4-4.4.jar:util-jars/commons-compress-1.27.1.jar


// /usr/bin/env groovy -cp util-jars/commons-vfs2-2.9.0.jar:util-jars/commons-logging-1.3.4.jar:util-jars/commons-lang3-3.17.0.jar:util-jars/jsoup-1.18.1.jar:util-jars/poi-5.3.0.jar:util-jars/commons-io-2.16.1.jar
import org.apache.commons.vfs2.FileFilterSelector
import org.apache.commons.vfs2.FileObject
import org.apache.commons.vfs2.FileSelectInfo
import org.apache.commons.vfs2.FileSystemManager
import org.apache.commons.vfs2.VFS
import org.apache.commons.vfs2.filter.RegexFileFilter

import org.apache.poi.ss.usermodel.Cell
import org.apache.poi.ss.usermodel.CellType
import org.apache.poi.ss.usermodel.Sheet
import org.apache.poi.ss.usermodel.Workbook
import org.apache.poi.xssf.usermodel.XSSFWorkbook

import java.nio.file.Files
import java.nio.file.Paths
import java.nio.file.StandardCopyOption


String.metaClass.toProperties() {
    String self = delegate
    def content = FsUtil.instance.getContent(self);
    def props = new Properties()
    props.load(new StringReader(content))
    return props;
}
String.metaClass.toWords() {
    def words = delegate.toString().split(" +")
    return words;
}


class FsUtil {
    final static FsUtil instance = new FsUtil();

    private final FileSystemManager mgr

    private FsUtil() {
        this.mgr = VFS.getManager()
    }

    def findFiles(String rootUri, String suffixRegex, Closure fn) {
        def file = mgr.resolveFile(rootUri)
        file.findFiles(new FileFilterSelector(new RegexFileFilter(".*" + suffixRegex)) {
            @Override
            boolean traverseDescendents(FileSelectInfo fileInfo) throws Exception {
                return true;
            }

            @Override
            boolean includeFile(FileSelectInfo fileInfo) throws Exception {
                return accept(fileInfo);
            }
        }).each {
            fn(it)
        }
    }

    static String getContent(String uri) {
        return new String(FsUtil.instance.mgr.resolveFile(uri).getContent().byteArray)
    }
}


if (args && args.length > 0 && args[0]) {
    if (args[0] == "generate-bundles") {

        /**
         * generates excel report with summary and key wise view
         * generates bundle/html files which are to be submitted for translation from prioritised jars
         */
        ReportAndL10nBundleGenerator generator = new ReportAndL10nBundleGenerator()
        generator.generate()
    } else if (args[0] == 'generate-manifest') {
        /**
         * 1. after generating bundle files of interest
         * 2. (manual step)download zip file from go-portal submitted in previous drop/release
         * 3. (manual step)compare contents in javavscode in downloaded zip with ./out/go-portal/javavscode/l10n/en/netbeans using dir diff tools and merge.
         * 3.1 check diff and merge/consolidate changes accordingly into ./out/netbeans as go-portal needs previously translated data along with current delta
         * 4. after above steps run generate-manifest from script
         * 5. (manual step)run ./out/go-portal/javavscode/translate.sh
         */
        generateManifest()
    } else if (args[0] == "unpack") {
        /**
         * unpacks translated zip files
         * drop translated zip files non english zip files here go-portal-translated-zip-files
         * unpacks content into javavscode/netbeans-l10n/netbeans-l10n-zip/src"
         */
        String sourcePath = new File("go-portal-translated-zip-files").getAbsolutePath()
        String targetPath = new File("${ModuleInfo.VSCODE_SOURCE_PATH}/netbeans-l10n/netbeans-l10n-zip/src").getAbsolutePath()
        new UnPacker(sourcePath, targetPath).unpack()
    } else if (args[0] == "ideaLibs") {
        generateIdeaLibsXml()
    } else if (!args[0]?.isEmpty()) {
        /**
         * displays content of the file uri passed, including the content for uri present in jar's
         * example: jar:file:///work/git-work/javavscode/vscode/nbcode/java/modules/org-netbeans-modules-java-hints.jar!/org/netbeans/modules/java/hints/jdk/Bundle.properties
         */
        def content = FsUtil.instance.getContent(args[0])
        println(content)
    }
    System.exit(0);
} else {
    throw new IllegalArgumentException("please use right set of arguments");
}


static void generateManifest() {
    String maniFest = "./out/l10n/manifest.wptg"
    def data = """
Languages: Japanese +Simplified_Chinese

FileType: javavscode-json

vscode/package.nls.%b.json
vscode/l10n/bundle.l10n.%b.json

FileType: JavaProperties
    ${
        def list = ""
        FsUtil.instance.findFiles(new File("./out/l10n").getAbsolutePath(), ".properties") { FileObject fo ->
            list = list + "\n" + fo.getURI().toString().replaceAll(".*/out/", "").replace("l10n/", "l10n/%J/").replaceAll('/(?=[^/]+\\.properties$)', "/\n")
        }
        list
    }

FileType: htmldoc
        ${
        def list = ""
        FsUtil.instance.findFiles(new File("./out/l10n").getAbsolutePath(), ".html") { FileObject fo ->
            list = list + "\n" + fo.getURI().toString().replaceAll(".*/out/", "").replace("l10n/", "l10n/%J/").replaceAll('/(?=[^/]+\\.html$)', "/\n")
        }
        list
    }
""".stripIndent().stripMargin()
    new File(maniFest).with {
        if (it.exists()) it.delete()
        it.withWriter {
            it.write(data)
        }
    }
}

/**
 *  generate idea libs for debugging purpose
 */
static void generateIdeaLibsXml() {
    String paths = """
<!-- replace this external.xml in .idea/libraries directory -->
<component name="libraryTable">
<library name="external">
<CLASSES>
${
        ModuleInfo.moduleNameMap.inject("", { prev, cur ->
            if (cur.value.getModuleJarPath()) {
                prev + """<root url="${cur.value.getModuleJarPath().replaceAll("jar:/", "jar://")}!/" />\n"""
            } else {
                prev
            }
        })
    }
</CLASSES>
<SOURCES>
${
        ModuleInfo.moduleNameMap.inject("", { prev, cur ->
            if (cur.value.getSourceCodePathForModule() && cur.value.getSourceCodePathForModule() != "N/A") {
                prev + """<root url="${cur.value.getSourceCodePathForModule()}/" />\n"""
            } else {
                prev
            }
        })
    }
</SOURCES>
</library>
</component>
"""

    new File("./out/external.xml").with {
        it.delete()
        it.createNewFile()
        it
    }.write(paths)
}


record UnpackFileInfo(String sourceL10nCode, String targetL10nCode, String zipName) {}

class UnPacker {
    private static final String relativeTargetStructure = "netbeans-l10n-zip/src"
    private String translatedContentZipParentDir = ""
    private String targetRootPath = ""
    private List<UnpackFileInfo> unpackFileInfoList = []
    private targetMap = ["ja_JP": "ja", "zh_CN": "zh_CN"]

    /**
     *
     * @param translatedContentZipParentDir , directory where translated zip files are present
     * @param targetRootPath , directory where unpacked content would be applied to
     */
    UnPacker(String translatedContentZipParentDir, String targetRootPath) {
        this.translatedContentZipParentDir = translatedContentZipParentDir
        this.targetRootPath = targetRootPath
        FsUtil.instance.findFiles(translatedContentZipParentDir, '-.+\\.zip$') { FileObject fo ->
            def sourceZipName = fo.getURI().toString().replaceAll('.+/(?=[^/]+\\.zip$)', "")
            def sourceLocaleCode = fo.getURI().toString().replaceAll('.+-(?=[^-]+\\.zip$)', "").replaceAll('\\.zip', "")
            def targetLocaleCode = targetMap[sourceLocaleCode]
            unpackFileInfoList.add(new UnpackFileInfo(sourceLocaleCode, targetLocaleCode, sourceZipName))
        }
    }

    /**
     * unpacks,structures files simlar to targetRootPath and copies contents to targetRootPath.
     */
    void unpack() {
        "rm -rf $translatedContentZipParentDir/out/".execute().waitFor()
        unpackFileInfoList.each {
            "unzip $translatedContentZipParentDir/${it.zipName} -d $translatedContentZipParentDir/out".execute().waitFor()
            "mkdir -p $translatedContentZipParentDir/out/javavscode/l10n/$relativeTargetStructure/${it.targetL10nCode}".execute().waitFor()
            Files.move(Paths.get("$translatedContentZipParentDir/out/javavscode/l10n/${it.targetL10nCode}/netbeans/"), Paths.get("$translatedContentZipParentDir/out/javavscode/l10n/$relativeTargetStructure/${it.targetL10nCode}"), StandardCopyOption.REPLACE_EXISTING)
            Files.delete(Paths.get("$translatedContentZipParentDir/out/javavscode/l10n/${it.targetL10nCode}"))
            UnpackFileInfo unpackFileInfo = it
            List<URI> srcDirs = []
            def translatedModules = [:].withDefault {[
                    module:ModuleInfo.moduleNameMap[it],
                    l10nRootSourceDir:[].toSet()
            ]}
            def translatedSourcePath = "$translatedContentZipParentDir/out/javavscode/l10n/$relativeTargetStructure/${it.targetL10nCode}"
            FsUtil.instance.findFiles(Paths.get(translatedSourcePath).toUri().toString(), 'src$') {
                FileObject fo ->
                    def fileUri = fo.getURI().toString()
                    if (fileUri.endsWith("/src")) {
                        ModuleInfo.moduleNameMap.find {
                            it.value.sourceCodePathForModule?.endsWith(fileUri.replaceAll('.*' + translatedSourcePath, ''))
                        }?.with {
                            translatedModules[it.value.getModuleJarName()]
                        }
                        srcDirs.add(fo.getURI())
                    }
            }
            srcDirs.sort {
                it.toString().length()
            }
            srcDirs.each {
                def targetUri = it.toString().with {
                    def moduleName = it.replaceAll('.+/(?=[^/]+/src$)', "").replaceAll('/src$', "")
                    def sourceUri = "file://$translatedContentZipParentDir/out/javavscode/l10n/$relativeTargetStructure/"
                    it = sourceUri + it.replaceAll("^" + sourceUri, "").replaceAll('\\.', "-")
                    it.replaceAll(moduleName + '/src$', moduleName.with { moduleName.replaceAll('\\.', "-") }.with { "$it/$it" })
                }.with { URI.create(it) }
                new File(targetUri).with {
                    if (!it.parentFile.exists()) {
                        it.parentFile.mkdirs()
                    }
                    it
                }
                Files.move(Paths.get(it), Paths.get(targetUri), StandardCopyOption.REPLACE_EXISTING)
            }

            srcDirs.each {
                new File(it).parentFile.deleteDir()
            }

            FsUtil.instance.findFiles(Paths.get("$translatedContentZipParentDir/out/javavscode/l10n/$relativeTargetStructure/${it.targetL10nCode}").toUri().toString(), '(\\.properties|\\.html)$') {
                FileObject fo ->
                    def targetUri = {
                        if (fo.getURI().toString().matches('.*\\.properties$')) {
                            fo.getURI().toString().replaceAll('\\.properties$', "_${unpackFileInfo.targetL10nCode}.properties")
                        } else {
                            fo.getURI().toString().replaceAll('\\.html$', "_${unpackFileInfo.targetL10nCode}.html")
                        }
                    }().with { String uriString -> URI.create(uriString) }
                    println(targetUri)
                    Files.move(Paths.get(fo.getURI()), Paths.get(targetUri), StandardCopyOption.REPLACE_EXISTING)
            }

            def cp = "cp -r $translatedContentZipParentDir/out/javavscode/l10n/$relativeTargetStructure/ $targetRootPath"
            cp.execute().waitFor()
        }
    }
}


class ModuleInfo {
    static {
        if (System.getenv()["JAVA_VSCODE_SOURCE_PATH"] == null) {
            throw new IllegalArgumentException("please specify JAVA_VSCODE_SOURCE_PATH as env var")
        }
        VSCODE_SOURCE_PATH = System.getenv()["JAVA_VSCODE_SOURCE_PATH"]
        scanForJarsAndRequiredFilesInJars()

    }
    static final VSCODE_SOURCE_PATH
    static final Map<String, ModuleInfo> moduleNameMap = [:].withDefault { new ModuleInfo(moduleJarName: it) }
    List<String> jarPaths = []
    List<String> localeJarPaths = []
    String moduleJarName
    List<String> propertiesFilePaths = []
    List<String> localePropertiesFilePaths = []
    List<String> htmlContent = []
    List<String> localeHtmlContent = []
    def moduleName = { metaBundleProperties['OpenIDE-Module-Name'] }
    def moduleShortDescription = { metaBundleProperties['OpenIDE-Module-Short-Description'] }
    def moduleDisplayCategory = { metaBundleProperties['OpenIDE-Module-Display-Category'] }
    def moduleLongDescription = { metaBundleProperties['OpenIDE-Module-Long-Description'] }
    Properties metaBundleProperties = new Properties()
    String metadataBundlePropertiesPath = ""
    public static final IGNORABLE_KEYS = ['OpenIDE-Module-Name',
                                          'OpenIDE-Module-Short-Description',
                                          'OpenIDE-Module-Display-Category',
                                          'OpenIDE-Module-Long-Description'] as Set
    private String sourcePathForModuleJar
    private String manifestFileUriInJar
    private String manifestFileModuleIdEntry

    private static def LOCALE_SUPPORT = [chinese : [nbLocaleCode: "zh_CN"],
                                         japanese: [nbLocaleCode: "ja"]
    ]

    /**
     * you can also find these jar names in the excel report generated
     */
    private static def REQUIRED_MODULES_JAR_NAMES = [
            "org-netbeans-modules-java-lsp-server"   : "required",
            "org-netbeans-modules-nbcode-integration": "required",
            //   "org-netbeans-modules-maven":"required"  // example
    ]


    /**
     * creates/replaces files with the structure similar to netbeans source code including package structure
     * here it is used for html files
     * @param jarUri
     */
    final void createFileFrom(String jarUri) {
        if (!isRequired(getJarName(jarUri))) return;
        def path = jarUri.replaceAll(".*jar!", "")
        def rootFolderName = this.getSourceCodePathForModule().replaceAll(".*/javavscode/", "")
        def outPutPath = "./out/l10n/$rootFolderName$path"
        new File(outPutPath).with {
            it.delete()
            if (!it.parentFile.exists()) {
                it.parentFile.mkdirs()
            }
            it.createNewFile()
            it
        }.with {
            it.withWriter {
                it.write(FsUtil.instance.getContent(jarUri))
            }
        }
    }

    /**
     * creates properties files with the structure similar to netbeans source code including package structure
     * this can be further used to generate manifest
     * @param jarUri
     * @param enProps
     * @param selectedKeysForTranslation
     */
    final void createFileFrom(String jarUri, Properties enProps, Set<String> selectedKeysForTranslation) {
        if (!isRequired(getJarName(jarUri))) return;
        def path = jarUri.replaceAll(".*jar!", "")
        def rootFolderName = this.getSourceCodePathForModule().replaceAll(".*/javavscode/", "")
        def outPutPath = "./out/l10n/$rootFolderName$path"
        new File(outPutPath).with {
            Properties dataProps = new Properties()
            if (it.exists()) {
                def file = it
                dataProps = new Properties().with {
                    def props = it
                    file.withInputStream {
                        props.load(it)
                    }
                    it
                }
            } else {
                if (!it.parentFile.exists()) {
                    it.parentFile.mkdirs()
                }
                it.createNewFile()
            }
            selectedKeysForTranslation.each {
                dataProps[it] = enProps[it]
            }
            it.withOutputStream {
                dataProps.store(it, null)
            }
        }
    }

    static String getJarName(String jarUri) {
        def fileName = jarUri.replaceAll('\\.jar(!.*)?', "").split("/")[-1].with {
            String name ->
                LOCALE_SUPPORT.each {
                    String code = LOCALE_SUPPORT[it.key]["nbLocaleCode"]
                    name = name.replaceAll("_$code" + '$', "")
                }
                name
        }
        return fileName
    }

    static boolean isLocaleJar(String fileUri) {

        def isLocaleJar = LOCALE_SUPPORT.keySet().any {
            String code = LOCALE_SUPPORT[it]["nbLocaleCode"]
            fileUri.endsWith("_" + code + ".jar")
        }
        return isLocaleJar
    }


    String getModuleJarPath() {
        if (jarPaths.size() > 1) {
            return jarPaths.find { it.contains("/modules") }
        } else {
            return jarPaths[0]
        }
    }

    void setManifestDetails(String manifestFileUriInJar) {
        this.manifestFileUriInJar = manifestFileUriInJar
        def moduleIdEntry = FsUtil.instance.getContent(manifestFileUriInJar)
                .readLines().with {
            if (!it.isEmpty()) {
                it.findAll { String line ->
                    line.matches("OpenIDE-Module *:.*")
                }?.with {
                    if (it) it.first()
                    else null
                }
            } else {
                null
            }
        }
        this.manifestFileModuleIdEntry = moduleIdEntry
    }

    void setSourceCodeDetails(String sourceManifestUri) {
        this.sourcePathForModuleJar = sourceManifestUri.replaceAll('/[^/]+(.MF|.mf)$', "") + "/src"
    }

    private static void scanForSources() {
        def netbeansSourceCodePath = "file://$VSCODE_SOURCE_PATH/netbeans"
        Map<String, ModuleInfo> manifestIdModuleMap = ModuleInfo.moduleNameMap.collectEntries {
            if (it.value.manifestFileModuleIdEntry) {
                return [it.value.manifestFileModuleIdEntry, it.value]
            } else {
                return []
            }
        }
        FsUtil.instance.findFiles(netbeansSourceCodePath, '(.MF|.mf)$',
                { FileObject sourceMf ->
                    FsUtil.instance.getContent(sourceMf.getURI().toString())
                            .readLines()
                            .findAll { it.matches("OpenIDE-Module *:.*") }
                            .each {
                                manifestIdModuleMap[it]?.setSourceCodeDetails(sourceMf.getURI().toString())
                            }
                }
        )
    }

    static void scanForJarsAndRequiredFilesInJars() {

        String nbcodeCompiledJarsLocation = "$VSCODE_SOURCE_PATH/vscode/nbcode"
        println("scanning jars paths.. in $nbcodeCompiledJarsLocation, please ensure you have already built vsix using ant for extension")
        FsUtil.instance.findFiles(nbcodeCompiledJarsLocation, '\\.jar$') { FileObject matchedFile ->
            def jarUri = matchedFile.getURI().toString().replaceAll("file:///", "jar:/");
            def jarName = getJarName(jarUri)
            if (isLocaleJar(jarUri)) {
                println(jarUri)
                moduleNameMap[jarName].localeJarPaths.add(jarUri)
            } else {
                moduleNameMap[jarName].jarPaths.add(jarUri)
                FsUtil.instance.findFiles(jarUri, '.*\\.(mf|MF)$') { FileObject childFile ->
                    moduleNameMap[jarName].setManifestDetails(childFile.getURI().toString())
                }
            }
            FsUtil.instance.findFiles(jarUri, 'Bundle.*\\.properties$') { FileObject childFile ->
                if (!childFile.getURI().toString().replaceAll('.*\\.jar!', "").contains("/org/netbeans")) return
                if (childFile.getURI().toString().matches(".*/[Bb]undle(_ja|_zh_CN)\\.properties\$")) {
                    moduleNameMap[jarName].localePropertiesFilePaths.add(childFile.getURI().toString())
                } else if (childFile.getURI().toString().matches('.*/[Bb]undle\\.properties$')) {
                    moduleNameMap[jarName].addIfMetaDataBundle(childFile.getURI().toString())
                    moduleNameMap[jarName].propertiesFilePaths.add(childFile.getURI().toString())
                }
            }
            FsUtil.instance.findFiles(jarUri, '.*\\.html') { FileObject childFile ->
                if (!childFile.getURI().toString().replaceAll('.*\\.jar!', "").contains("/org/netbeans")) return
                if (childFile.getURI().toString().matches(".*(_ja|_zh_CN)\\.html\$")) {
                    moduleNameMap[jarName].localeHtmlContent.add(childFile.getURI().toString())
                } else if (childFile.getURI().toString().matches('.*\\.html\$')) {
                    moduleNameMap[jarName].htmlContent.add(childFile.getURI().toString())
                }
            }
        }
        System.out.println("scanning source paths..")
        scanForSources()
    }

    String getSourceCodePathForModule() {
        return sourcePathForModuleJar
    }

    void addIfMetaDataBundle(String bundlePath) {
        if (bundlePath) {
            def props = bundlePath.toProperties() as Properties
            if (!metaBundleProperties && props['OpenIDE-Module-Name']) {
                metadataBundlePropertiesPath = bundlePath
                metaBundleProperties = bundlePath.toProperties() as Properties
            }
        }
    }

    boolean isMetaDataBundle(String path) {
        if (path) {
            return path == (metadataBundlePropertiesPath)
        }
        return false
    }


    static String getPriority(String jarName) {
        def priority = REQUIRED_MODULES_JAR_NAMES[jarName]
        return priority ? priority : "not prioritised"
    }

    private static boolean isRequired(String jarName) {
        return getPriority(jarName) == 'required'
    }


}


abstract class ModuleStats {
    abstract protected Map<String, ModuleInfo> l10nm
    abstract protected Map<String, ModuleInfo> nol10n

    def static findModuleInfo(Map<String, ModuleInfo> moduleNameMap, boolean html = false, Closure fn) {
        return moduleNameMap.findAll {
            it.value.jarPaths.size() >= 1 &&
                    (
                            (!html && (it.value.propertiesFilePaths.size() > 0 || it.value.localePropertiesFilePaths.size() > 0)) ||
                                    (html && (it.value.htmlContent.size() > 0 || it.value.localeHtmlContent.size() > 0))
                    )
        }.findAll {
            def jarName = it.key
            def hasLocaleBundleProperties = it.value.localeJarPaths.size() > 0
            def hasMainBundleProperties = it.value.jarPaths.size() > 0
            def hasHtmlFiles = it.value.htmlContent.size() > 0
            def hasLocaleHtmlFiles = it.value.localeHtmlContent.size() > 0
            if (!html) {
                fn(jarName, hasLocaleBundleProperties, hasMainBundleProperties)
            } else {
                fn(jarName, hasHtmlFiles, hasLocaleHtmlFiles)
            }
        }
    }

    abstract l10nModule(Closure fn);

    abstract nol10nModule(Closure fn);

}

class HtmlFileStats extends ModuleStats {
    HtmlFileStats(Map<String, ModuleInfo> fullInfo) {
        nol10n = findModuleInfo(fullInfo, true) { jarName, hasHtmlFiles, hasLocaleHtmlFiles ->
            !hasLocaleHtmlFiles && hasHtmlFiles
        }
        l10nm = findModuleInfo(fullInfo, true) { jarName, hasHtmlFiles, hasLocaleHtmlFiles ->
            hasLocaleHtmlFiles && hasHtmlFiles
        }
    }

    def l10nModule(Closure fn) {
        l10nm.values().each { module ->
            fn(module.moduleJarName, module.htmlContent, module.localeHtmlContent)
        }
    }

    def nol10nModule(Closure fn) {
        nol10n.values().each { module ->
            fn(module.moduleJarName, module.htmlContent, module.localeHtmlContent)
        }
    }
}

class BundleFileStats extends ModuleStats {
    BundleFileStats(Map<String, ModuleInfo> fullInfo) {
        nol10n = findModuleInfo(fullInfo) { jarName, hasLocaleBundle, hasMainBundle ->
            !hasLocaleBundle && hasMainBundle
        }
        l10nm = findModuleInfo(fullInfo) { jarName, hasLocaleBundle, hasMainBundle ->
            hasLocaleBundle && hasMainBundle
        }
    }

    def l10nModule(Closure fn) {
        l10nm.values().each { module ->
            fn(module.moduleJarName, module.propertiesFilePaths, module.localePropertiesFilePaths)
        }

    }

    def nol10nModule(Closure fn) {
        nol10n.values().each { module ->
            fn(module.moduleJarName, module.propertiesFilePaths, module.localePropertiesFilePaths)
        }

    }
}


class ReportAndL10nBundleGenerator {
    private xlReport = new ExcelReport();

    def mainSummaryTable

    def htmlFileTableNol10n
    def htmlFileTablel10n

    def propertiesFileTableNol10n
    def propertiesFileTablel10n

    def propertiesFileTableNol10nKeyWiseDetails
    def propertiesFileTablel10nKeyWiseDetails

    ModuleStats htmlStats
    ModuleStats bundleStats


    ReportAndL10nBundleGenerator() {
        mainSummaryTable = xlReport.addTable("summary");

        htmlFileTableNol10n = xlReport.addTable("htmlSummary-no-l10n")
        htmlFileTablel10n = xlReport.addTable("htmlSummary-l10n")


        propertiesFileTableNol10n = xlReport.addTable("propertiesFileSummary-no-l10n")
        propertiesFileTablel10n = xlReport.addTable("propertiesFileSummary-l10n")

        propertiesFileTableNol10nKeyWiseDetails = xlReport.addTable("propertiesFileSummary-no-l10n-detailed")
        propertiesFileTablel10nKeyWiseDetails = xlReport.addTable("propertiesFileSummary-l10n-detailed")

        htmlStats = new HtmlFileStats(ModuleInfo.moduleNameMap)
        bundleStats = new BundleFileStats(ModuleInfo.moduleNameMap)

    }

    private static void listFiles(ModuleStats stats, String fileExtension, Closure nol0n, Closure l10n) {
        List<Map<String, String>> jaFiles = []
        List<Map<String, String>> zhFiles = []
        List<Map<String, String>> mainFiles = []
        def jaFilter = { String path -> path.replaceAll('\\.' + fileExtension + '$', '').endsWith("_ja") }
        def zhFilter = { String path -> path.replaceAll('\\.' + fileExtension + '$', '').endsWith("_zh_CN") }
        def filterAll = { List<String> paths, Closure<Boolean> filter -> paths.findAll { filter(it) } }
        def fileCollect = { String moduleName, List<String> mainFilePaths, List<String> l10nPaths ->

            def files = filterAll(l10nPaths, jaFilter).collect {
                Map.of(moduleName, it)
            }
            jaFiles.addAll(files)
            files = filterAll(l10nPaths, zhFilter).collect {
                Map.of(moduleName, it)
            }
            zhFiles.addAll(files)
            files = mainFilePaths.collect {
                Map.of(moduleName, it)
            }
            mainFiles.addAll(files)
        }
        stats.nol10nModule { String moduleName, List<String> mainFilePaths, List<String> l10nPaths ->
            fileCollect(moduleName, mainFilePaths, l10nPaths)
        }
        nol0n(jaFiles, zhFiles, mainFiles)
        jaFiles = []
        zhFiles = []
        mainFiles = []
        stats.l10nModule { String moduleName, List<String> mainFilePaths, List<String> l10nPaths ->
            fileCollect(moduleName, mainFilePaths, l10nPaths)
        }
        l10n(jaFiles, zhFiles, mainFiles)
    }

    private static void iterateThroughEachMainFileWithRelatedL10nFiles(String fileType = "properties", Set<String> jarNames, List<Map<String, String>> mainl10n, List<Map<String, String>> ja, List<Map<String, String>> zh, Closure fn) {
        jarNames.each { String name ->
            mainl10n
                    .findAll { it.keySet().find({ it == name }) }
                    .collect { it.values() }
                    .flatten().each { String s ->
                def filePathOf = [:]
                def commonPath = s.replaceFirst('.*\\.jar!', '')
                ja.findAll { it.keySet().find({ it == name }) }
                        .findAll {
                            it.values().find {
                                def eqPath = commonPath.replaceAll('\\.' + fileType + '$', "") + "_ja.${fileType}"
                                it.endsWith(eqPath)
                            }
                        }
                        .collect {
                            if (it.values().size() > 1) println("WARNING:: more files found")
                            it.values()
                        }.flatten().each {
                    filePathOf["ja"] = it
                }
                zh.findAll { it.keySet().find({ it == name }) }
                        .findAll {
                            it.values().find {
                                def eqPath = commonPath.replaceAll('\\.' + fileType + '$', "") + "_zh_CN.${fileType}"
                                it.endsWith(eqPath)
                            }
                        }
                        .collect {
                            if (it.values().size() > 1) println("WARNING:: more files found")
                            it.values()
                        }.flatten().each {
                    filePathOf["zh"] = it
                }
                fn(name, commonPath, s, filePathOf["ja"], filePathOf["zh"])
            }
        }
    }

    def generate() {
        println("""
        NoLocaleWithMainBundleProperties:${bundleStats.nol10n.size()},
        NoLocaleWithMainBundleHtml:${htmlStats.nol10n.size()},
        LocaleWithMainBundleProperties:${bundleStats.l10nm.size()},
        LocaleWithMainHtml:${htmlStats.l10nm.size()},
        """)


        listFiles(bundleStats, "properties", { List<Map<String, String>> ja, List<Map<String, String>> zh, List<Map<String, String>> mainNol10n ->
            Set<String> jarNames = mainNol10n.collect() { it.keySet() }.flatten().toSet()
            mainSummaryTable.addDataMap([
                    "Category"                           : "jars which have Bundle.properties but no l1On properties",
                    "No of jars"                         : jarNames.size(),
                    "No of Bundle.properties files"      : mainNol10n.size(),
                    "No of ja Bundle.properties files"   : ja.size(),
                    "No of zh_CN Bundle.properties files": zh.size(),
                    "No of html files"                   : "n/a",
                    "No of ja html files"                : "n/a",
                    "No of zh_CN html files"             : "n/a"
            ])
            jarNames.each { String jarName ->
                mainNol10n
                        .findAll { it.keySet().find({ it == jarName }) }
                        .collect { it.values() }
                        .flatten()
                        .each { String mainFilePath ->
                            def props = (mainFilePath.toProperties() as Properties)
                            def selectedKeysForTranslation = props.keySet().findAll { props[it]?.toString().trim().length() > 0 }.findAll { !ModuleInfo.IGNORABLE_KEYS.contains(it) }
                            def commonPath = mainFilePath.replaceFirst('.*\\.jar!', '')
                            if (selectedKeysForTranslation.isEmpty() || !ModuleInfo.getPriority(jarName)) return
                            ModuleInfo.moduleNameMap[jarName].createFileFrom(mainFilePath, props, selectedKeysForTranslation)
                            /**
                             * creates table in excel
                             */
                            propertiesFileTableNol10n.addDataMap([
                                    "priority"                      : ModuleInfo.getPriority(jarName),
                                    "jarName"                       : jarName,
                                    "moduleNameInBundle"            : ModuleInfo.moduleNameMap[jarName].moduleName(),
                                    "moduleDisplayCategory"         : ModuleInfo.moduleNameMap[jarName].moduleDisplayCategory(),
                                    "moduleShortDescription"        : ModuleInfo.moduleNameMap[jarName].moduleShortDescription(),
                                    "moduleLongDescription"         : ModuleInfo.moduleNameMap[jarName].moduleLongDescription(),
                                    "commonPath"                    : commonPath,
                                    "main file path"                : mainFilePath,
                                    "is module metadata bundle file": ModuleInfo.moduleNameMap[jarName].isMetaDataBundle(mainFilePath),
                                    "total number of keys"          : selectedKeysForTranslation.size(),
                                    "no of space separated elements": selectedKeysForTranslation.collect { props[it]?.toString().trim().toWords().size() }.sum()
                            ])
                            selectedKeysForTranslation.each { propertyKey ->
                                propertiesFileTableNol10nKeyWiseDetails.addDataMap([
                                        "priority"                      : ModuleInfo.getPriority(jarName),
                                        "jarName"                       : jarName,
                                        "moduleNameInBundle"            : ModuleInfo.moduleNameMap[jarName].moduleName(),
                                        "moduleDisplayCategory"         : ModuleInfo.moduleNameMap[jarName].moduleDisplayCategory(),
                                        "main file path"                : mainFilePath,
                                        "is module metadata bundle file": ModuleInfo.moduleNameMap[jarName].isMetaDataBundle(mainFilePath),
                                        "key"                           : propertyKey,
                                        "en value"                      : props[propertyKey]
                                ])
                            }


                        }
            }
        }, { List<Map<String, String>> ja, List<Map<String, String>> zh, List<Map<String, String>> mainWithl10n ->
            def jarNames = mainWithl10n.collect() { it.keySet() }.flatten().toSet()
            mainSummaryTable.addDataMap([
                    "Category"                           : "jars which have Bundle.properties and l1On properties(means jar is localised)",
                    "No of jars"                         : jarNames.size(),
                    "No of Bundle.properties files"      : mainWithl10n.size(),
                    "No of ja Bundle.properties files"   : ja.size(),
                    "No of zh_CN Bundle.properties files": zh.size(),
                    "No of html files"                   : "n/a",
                    "No of ja html files"                : "n/a",
                    "No of zh_CN html files"             : "n/a"
            ])
            generatePropertiesFilesAndAddDetailsInReport(jarNames, mainWithl10n, ja, zh)

        })


        listFiles(htmlStats, "html", { List<Map<String, String>> ja, List<Map<String, String>> zh, List<Map<String, String>> mainNol10n ->
            def jarNames = mainNol10n.collect() { it.keySet() }.flatten().toSet()
            mainSummaryTable.addDataMap([
                    "Category"                           : "jars which have only html files but no l1On content html files",
                    "No of jars"                         : jarNames.size(),
                    "No of Bundle.properties files"      : "n/a",
                    "No of ja Bundle.properties files"   : "n/a",
                    "No of zh_CN Bundle.properties files": "n/a",
                    "No of html files"                   : mainNol10n.size(),
                    "No of ja html files"                : ja.size(),
                    "No of zh_CN html files"             : zh.size()
            ])

            jarNames.each { String jarName ->
                mainNol10n
                        .findAll { it.keySet().find { it == jarName } }
                        .collect { it.values() }
                        .flatten()
                        .each { String mainFilePath ->
                            ModuleInfo.moduleNameMap[jarName].createFileFrom(mainFilePath)
                            def commonPath = mainFilePath.replaceFirst('.*\\.jar!', '')
                            htmlFileTableNol10n.addDataMap([
                                    "jarName"               : jarName,
                                    "moduleNameInBundle"    : ModuleInfo.moduleNameMap[jarName].moduleName(),
                                    "moduleDisplayCategory" : ModuleInfo.moduleNameMap[jarName].moduleDisplayCategory(),
                                    "moduleShortDescription": ModuleInfo.moduleNameMap[jarName].moduleShortDescription(),
                                    "moduleLongDescription" : ModuleInfo.moduleNameMap[jarName].moduleLongDescription(),
                                    "commonPath"            : commonPath,
                                    "main file path"        : mainFilePath,
                            ])
                        }

            }


        }, { List<Map<String, String>> ja, List<Map<String, String>> zh, List<Map<String, String>> mainWithl10n ->
            def jarNames = mainWithl10n.collect() { it.keySet() }.flatten().toSet()
            mainSummaryTable.addDataMap([
                    "Category"                           : "jars which have only html files but no l1On content html files",
                    "No of jars"                         : jarNames.size(),
                    "No of Bundle.properties files"      : "n/a",
                    "No of ja Bundle.properties files"   : "n/a",
                    "No of zh_CN Bundle.properties files": "n/a",
                    "No of html files"                   : mainWithl10n.size(),
                    "No of ja html files"                : ja.size(),
                    "No of zh_CN html files"             : zh.size()
            ])

            iterateThroughEachMainFileWithRelatedL10nFiles("html", jarNames, mainWithl10n, ja, zh) {
                String jarName, String commonPath, String mainFilePath, String jaFilePath, String zhFilePath ->
                    htmlFileTablel10n.addDataMap([
                            "jarName"               : jarName,
                            "moduleNameInBundle"    : ModuleInfo.moduleNameMap[jarName].moduleName(),
                            "moduleDisplayCategory" : ModuleInfo.moduleNameMap[jarName].moduleDisplayCategory(),
                            "moduleShortDescription": ModuleInfo.moduleNameMap[jarName].moduleShortDescription(),
                            "moduleLongDescription" : ModuleInfo.moduleNameMap[jarName].moduleLongDescription(),
                            "commonPath"            : commonPath,
                            "main file path"        : mainFilePath,
                            "ja localised file path": jaFilePath,
                            "zh localised file path": zhFilePath
                    ])
            }
        })
        xlReport.create()
    }

    private List generatePropertiesFilesAndAddDetailsInReport(Set<Set<String>> jarNames, List<Map<String, String>> mainWithl10n, List<Map<String, String>> ja, List<Map<String, String>> zh) {
        iterateThroughEachMainFileWithRelatedL10nFiles(jarNames, mainWithl10n, ja, zh) {
            String jarName, String commonPath, String mainFilePath, String jaFilePath, String zhFilePath ->
                def enProps = (mainFilePath.toProperties() as Properties)
                def jaProps = jaFilePath ? (jaFilePath.toProperties() as Properties) : new Properties()
                def zhProps = zhFilePath ? (zhFilePath.toProperties() as Properties) : new Properties()
                def nonLocalisedJaKeys = (enProps.keySet() - (jaProps.keySet())).findAll { enProps[it]?.trim()?.length() > 0 }.findAll { !ModuleInfo.IGNORABLE_KEYS.contains(it) }
                def nonLocalisedZhKeys = (enProps.keySet() - (zhProps.keySet())).findAll { enProps[it]?.trim()?.length() > 0 }.findAll { !ModuleInfo.IGNORABLE_KEYS.contains(it) }
                if ((nonLocalisedJaKeys.size() == 0 && nonLocalisedZhKeys.size() == 0) || !ModuleInfo.getPriority(jarName)) return
                ModuleInfo.moduleNameMap[jarName].createFileFrom(mainFilePath, enProps, nonLocalisedJaKeys + nonLocalisedZhKeys)
                propertiesFileTablel10n.addDataMap([
                        "priority"                                                 : ModuleInfo.getPriority(jarName),
                        "jarName"                                                  : jarName,
                        "moduleNameInBundle"                                       : ModuleInfo.moduleNameMap[jarName].moduleName(),
                        "moduleDisplayCategory"                                    : ModuleInfo.moduleNameMap[jarName].moduleDisplayCategory(),
                        "moduleShortDescription"                                   : ModuleInfo.moduleNameMap[jarName].moduleShortDescription(),
                        "moduleLongDescription"                                    : ModuleInfo.moduleNameMap[jarName].moduleLongDescription(),
                        "commonPath"                                               : commonPath,
                        "main file path"                                           : mainFilePath,
                        "is module metadata bundle file"                           : ModuleInfo.moduleNameMap[jarName].isMetaDataBundle(mainFilePath),
                        "total number of non localised keys"                       : (nonLocalisedJaKeys + nonLocalisedZhKeys).size(),
                        "ja localised file path"                                   : jaFilePath,
                        "total number of non localised ja keys"                    : nonLocalisedJaKeys.size(),
                        "total number of non localised ja space separated elements": nonLocalisedJaKeys.collect { enProps[it].toString().toWords().size() }.sum(),
                        "zh localised file path"                                   : zhFilePath,
                        "total number of non localised zh keys"                    : nonLocalisedZhKeys.size(),
                        "total number of non localised zh space separated elements": nonLocalisedZhKeys.collect { enProps[it].toString().toWords().size() }.sum(),
                ])

                (nonLocalisedJaKeys + nonLocalisedZhKeys).each {
                    propertiesFileTablel10nKeyWiseDetails.addDataMap([
                            "priority"                      : ModuleInfo.getPriority(jarName),
                            "jarName"                       : jarName,
                            "moduleNameInBundle"            : ModuleInfo.moduleNameMap[jarName].moduleName(),
                            "main file path"                : mainFilePath,
                            "is module metadata bundle file": ModuleInfo.moduleNameMap[jarName].isMetaDataBundle(mainFilePath),
                            "key"                           : it,
                            "en value"                      : enProps[it],
                            "ja localised file path"        : jaFilePath,
                            "zh localised file path"        : zhFilePath,
                    ])
                }

        }
    }
}

class ExcelReport {
    final Workbook workbook

    ExcelReport() {
        this.workbook = new XSSFWorkbook()
    }

    ExcelReport(String path) {
        this.workbook = new XSSFWorkbook(new File(path))
    }

    static def getValue(Cell cell) {
        if (cell) {
            return switch (cell) {
                case { Cell c -> c.getCellType() == CellType.BOOLEAN } -> cell.getBooleanCellValue()
                case { Cell c -> c.getCellType() == CellType.NUMERIC } -> cell.getNumericCellValue()
                default -> {
                    cell.getStringCellValue()
                }
            }
        } else {
            return null;
        }
    }

    static def read(String filePath = "./out/report_discuss.xlsx") {
        def report = new ExcelReport(filePath)
        return {
            def x
            x = { String sheetName, Closure<Void> c ->
                report.readTableFromSheet(sheetName, c)
                return x
            }
            return { String sheetName, Closure<Void> c ->
                x(sheetName, c)
            }
        }()
    }


    def readTableFromSheet(String sheetName, Closure fn) {
        def sheet = workbook.getSheet(sheetName)
        Map<Integer, String> header = [:]
        sheet.each { row ->
            if (!header) {
                row.eachWithIndex { cell, index ->
                    header[index] = cell.getStringCellValue()
                }
            } else {
                def rowDataMap = [:]
                header.each { k, v ->
                    row.each {
                        rowDataMap[v] = getValue(row.getCell(k))
                    }
                }
                fn(rowDataMap)
            }
        }
    }

    static def addTableWithHeaders(List<String> headers, Sheet sheet, int headerRowIndex) {
        def headerRow = sheet.createRow(headerRowIndex)
        headers.eachWithIndex { v, i ->
            headerRow.createCell(i).setCellValue(v)
        }
    }

    def addTable(String sheetName) {
        def sheet = workbook.createSheet(sheetName)
        def lastFilledRowIndex = 0;
        List<String> headerList = null
        def addHeader = { List<String> header ->
            if (headerList) {
                return
            }
            headerList = header
            addTableWithHeaders(header, sheet, 0)
        }

        return [
                addHeader : addHeader,
                /***
                 * adds row to sheet
                 */
                addData   : { List<String> row ->
                    lastFilledRowIndex = lastFilledRowIndex + addTableWithData([row], sheet, lastFilledRowIndex)
                },
                /***
                 * adds row to sheet with key being the header name
                 */
                addDataMap: { Map<String, String> map ->
                    addHeader(map.keySet().toList())
                    lastFilledRowIndex = lastFilledRowIndex + addTableWithData([map.values().toList()], sheet, lastFilledRowIndex)
                }
        ]
    }

    static def addTableWithData(List<List<String>> tableData, Sheet sheet, int lastFilledRowIndex) {
        tableData.eachWithIndex { list, i ->
            def row = sheet.createRow(lastFilledRowIndex + 1 + i)
            list.eachWithIndex { ele, j ->
                row.createCell(j).setCellValue(ele)
            }
        }
        return tableData.size()
    }

    void create() {
        String targetFile = "./out/report.xlsx"
        File file = new File(targetFile)
        file.delete()
        try (FileOutputStream fileOut = new FileOutputStream(file)) {
            workbook.write(fileOut);
        } catch (IOException e) {
            e.printStackTrace();
        } finally {
            try {
                workbook.close()
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
        System.out.println("Excel report created successfully!");
    }
}











