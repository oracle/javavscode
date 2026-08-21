const fs = require('fs');
const path = require('path');

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

const createTelemetryConfig = () => {
  const defaultConfig = {
    telemetryRetryConfig: {
      maxRetries: 6,
      baseCapacity: 256,
      baseTimer: 5000,
      maxDelayMs: 100000,
      backoffFactor: 2,
      jitterFactor: 0.25
    },
    telemetryApi: {
      baseUrl: null,
      baseEndpoint: "/vscode/java/sendTelemetry",
      version: "/v1"
    },
    metadata: {
      consentSchemaVersion: "v1"
    }
  }

  const envConfig = Object.freeze({
    telemetryRetryConfig: {
      maxRetries: process.env.TELEMETRY_MAX_RETRIES,
      baseCapacity: process.env.TELEMETRY_BASE_CAPACITY,
      baseTimer: process.env.TELEMETRY_BASE_TIMER,
      maxDelayMs: process.env.TELEMETRY_MAX_DELAY,
      backoffFactor: process.env.TELEMETRY_BACKOFF_FACTOR,
      jitterFactor: process.env.TELEMETRY_JITTER_FACTOR
    },
    telemetryApi: {
      baseUrl: process.env.TELEMETRY_API_BASE_URL,
      baseEndpoint: process.env.TELEMETRY_API_ENDPOINT,
      version: process.env.TELEMETRY_API_VERSION
    }, 
    metadata: {
      consentSchemaVersion: process.env.CONSENT_SCHEMA_VERSION
    }
  });

    Object.entries(defaultConfig).forEach(([parent, configs]) => {
      if (parent in envConfig) {
        Object.entries(configs).forEach(([key, _]) => {
          if (envConfig[parent]?.[key]) {
            defaultConfig[parent][key] = envConfig[parent][key];
          }
        });
      }
    });

  fs.writeFileSync("telemetryConfig.json", JSON.stringify(defaultConfig, null, 4));
  console.log("Telemetry config generated successfully.");
}

(async () => {
  const args = process.argv.slice(2);
  try {
    if (args.includes("--artifactory-check")) {
      checkAritfactoryUrl();
    } else {
      // Build additional code
      createTelemetryConfig();
      console.log("build complete");
    }
    if (args.includes("--watch")) {
      process.stdin.resume();
      process.stdin.on("data", input => {
        console.log(input.toString());
      });
      process.stdin.on("end", async () => {
        console.log("watch complete");
      });
    }
  } catch (err) {
    process.stderr.write(err.message);
    process.exit(1);
  }
})();
