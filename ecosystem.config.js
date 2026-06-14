// PM2 ecosystem config
module.exports = {
  apps: [{
    name:        'nexaura-veil',
    script:      'src/index.js',
    cwd:         '/opt/nexaura-veil/backend',
    instances:   1,
    autorestart: true,
    watch:       false,
    max_memory_restart: '256M',
    env: {
      NODE_ENV: 'production',
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file:  './logs/pm2-error.log',
    out_file:    './logs/pm2-out.log',
    merge_logs:  true,
  }]
}
