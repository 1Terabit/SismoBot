module.exports = {
  apps: [
    {
      name: "sismobot",
      script: "dist/index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
      env: {
        NODE_ENV: "production",
      },
      // Restart if the process crashes, with exponential backoff
      exp_backoff_restart_delay: 1000,
      // Log configuration
      error_file: "./logs/sismobot-error.log",
      out_file: "./logs/sismobot-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
  ],
};
