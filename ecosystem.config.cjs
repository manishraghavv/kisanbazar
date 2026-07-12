// ─────────────────────────────────────────────────────────────
//  PM2 Ecosystem Configuration — Multi-Vendor Agri-Commerce
// ─────────────────────────────────────────────────────────────
//
// Manages two processes:
//   1. backend  — Node.js Express API server (port 3000)
//   2. frontend — Next.js SSR app (port 3001, proxied via Nginx)
//
// Usage:
//   pm2 start ecosystem.config.cjs
//   pm2 save
//   pm2 status
//   pm2 logs          # tail all logs
//   pm2 restart all   # restart both processes
// ─────────────────────────────────────────────────────────────

module.exports = {
  apps: [
    // ── Backend (Express API) ─────────────────────────────
    {
      name: 'backend',
      cwd: './backend',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_file: './backend/.env',
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      log_file: '../logs/backend-combined.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
      kill_timeout: 10000,
      listen_timeout: 5000,
      shutdown_with_message: true,
      max_restarts: 10,
      restart_delay: 2000,
      min_uptime: '10s',
    },

    // ── Frontend (Next.js SSR) ────────────────────────────
    {
      name: 'frontend',
      cwd: './frontend',
      script: 'node_modules/.bin/next',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      env_file: './frontend/.env',
      error_file: '../logs/frontend-error.log',
      out_file: '../logs/frontend-out.log',
      log_file: '../logs/frontend-combined.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
      kill_timeout: 15000,
      listen_timeout: 10000,
      shutdown_with_message: true,
      max_restarts: 10,
      restart_delay: 2000,
      min_uptime: '10s',
    },
  ],

  // ── Global deployment config ────────────────────────────
  deploy: {
    production: {
      user: process.env.EC2_USERNAME || 'ubuntu',
      host: process.env.EC2_HOST || '',
      ref: 'origin/main',
      repo: 'git@github.com:your-org/multi-vendor.git',
      path: '/home/ubuntu/app',
      'pre-deploy': 'git fetch --all && git reset --hard origin/main',
      'post-deploy':
        'npm install --prefix backend && ' +
        'npm install --prefix frontend && ' +
        'npm run prisma:generate --prefix backend && ' +
        'npm run build --prefix backend && ' +
        'npm run build --prefix frontend && ' +
        'pm2 reload ecosystem.config.cjs --env production',
      'pre-setup': 'echo "Setting up deployment environment..."',
    },
  },
};
