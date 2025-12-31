// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "utility-worker",
      script: "./src/scripts/utility-link-worker.mjs",
      interpreter: "node",
      node_args: "--import tsx",

      env: {
        UTILITY_WORKER_POLL_MS: "3000",
        DEBUG: "true",
      },

      exp_backoff_restart_delay: 100,
      out_file: "./logs/worker-out.log",
      error_file: "./logs/worker-error.log",
      merge_logs: true,
    },
  ],
};
