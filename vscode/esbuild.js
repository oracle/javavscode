const { build } = require("esbuild");
const fs = require('fs');
const path = require('path');

const baseConfig = {
  bundle: true,
  minify: process.env.NODE_ENV === "production",
  sourcemap: process.env.NODE_ENV !== "production",
};

const scriptConfig = {
  ...baseConfig,
  target: "es2020",
  format: "esm",
  entryPoints: ["./src/propertiesView/script.ts"],
  outfile: "./out/script.js",
};

const watchConfig = {
    watch: {
      onRebuild(error, result) {
        console.log("[watch] build started");
        if (error) {
          error.errors.forEach(error =>
            console.error(`> ${error.location.file}:${error.location.line}:${error.location.column}: error: ${error.text}`)
          );
        } else {
          console.log("[watch] build finished");
        }
      },
    },
  };

const NON_NPM_ARTIFACTORY = new RegExp(
  String.raw`"resolved"\s*:\s*"http[s]*://(?!registry.npmjs.org)[^"]+"`,
  "g"
);

const checkAritfactoryUrl = () => {
  const data = fs.readFileSync(path.resolve(__dirname, 'package-lock.json'), { encoding: 'utf-8' });
  if (NON_NPM_ARTIFACTORY.test(data)) {
    throw new Error("Found references to the internal registry in the file package-lock.json. Please fix it");
  } else {
    console.log('No internal artifactory references found.');
  }
}

  (async () => {
    const args = process.argv.slice(2);
    try {
      if (args.includes("--watch")) {
        // Build and watch source code
        console.log("[watch] build started");
        await build({
          ...scriptConfig,
          ...watchConfig,
        });
        console.log("[watch] build finished");
      } else if(args.includes("--artifactory-check")){
        checkAritfactoryUrl();
      } else {
        // Build source code
        await build(scriptConfig);
        console.log("build complete");
      }
    } catch (err) {
      process.stderr.write(err.message);
      process.exit(1);
    }
  })();