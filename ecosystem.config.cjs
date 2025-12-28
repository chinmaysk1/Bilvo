// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "utility-worker",
      script: "./src/scripts/utility-link-worker.mjs",
      interpreter: "node",
      node_args: "--import tsx",
      // Set your production environment variables here
      env: {
        DATABASE_URL:
          "postgresql://postgres.zprjkwwcdhixjlovgvwy:@Chinmaysk1@aws-1-us-east-1.pooler.supabase.com:5432/postgres",
        UTILITY_PASSWORD_SECRET:
          "72ff925ad0c04511a8ed3af4829ede9b704f9ef1800558d24333cd29f0898132",
        // Add any other keys your script needs (encryption keys, etc.)
        UTILITY_WORKER_POLL_MS: "3000",
        DEBUG: "true",
      },
      // Restarts the worker if it crashes
      exp_backoff_restart_delay: 100,
      // Ensures logs are saved to files so you can check them later
      out_file: "./logs/worker-out.log",
      error_file: "./logs/worker-error.log",
      merge_logs: true,
    },
  ],
};
