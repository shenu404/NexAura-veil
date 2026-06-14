const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const logFile = path.join(LOG_DIR, 'app.log');

function timestamp() {
  return new Date().toISOString();
}

function write(level, msg) {
  const line = `[${timestamp()}] [${level}] ${msg}`;
  console.log(line);
  fs.appendFile(logFile, line + '\n', () => {});
}

const logger = {
  info:  (msg) => write('INFO',  msg),
  warn:  (msg) => write('WARN',  msg),
  error: (msg) => write('ERROR', msg),
  debug: (msg) => write('DEBUG', msg),
};

module.exports = logger;
