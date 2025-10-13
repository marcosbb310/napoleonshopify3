import {
  defineConfig
} from "../../../../chunk-Y4F6JYMW.mjs";
import "../../../../chunk-JAQFRGM5.mjs";
import {
  init_esm
} from "../../../../chunk-OOYLPNSB.mjs";

// trigger.config.ts
init_esm();
var trigger_config_default = defineConfig({
  // Your Napoleonshopify3 project ref
  project: "proj_nxpixyqfcgkpqzhsfemo",
  // Directories containing your tasks
  dirs: ["./src/trigger"],
  // Retry configuration
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1e3,
      maxTimeoutInMs: 1e4,
      factor: 2,
      randomize: true
    }
  },
  // Max duration of a task in seconds (1 hour)
  maxDuration: 3600,
  build: {}
});
var resolveEnvVars = void 0;
export {
  trigger_config_default as default,
  resolveEnvVars
};
//# sourceMappingURL=trigger.config.mjs.map
