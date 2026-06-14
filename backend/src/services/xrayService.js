const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

let xrayProcess = null;
let xrayStatus = 'stopped'; // stopped | running | error

function getConfig() {
  return {
    xrayPath:   process.env.XRAY_PATH        || '/usr/local/bin/xray',
    configPath: process.env.XRAY_CONFIG_PATH || '/etc/xray/config.json',
  };
}

function status() {
  return {
    running: xrayStatus === 'running',
    status:  xrayStatus,
    pid:     xrayProcess ? xrayProcess.pid : null,
  };
}

async function start() {
  if (xrayProcess) throw new Error('Xray is already running');

  const { xrayPath, configPath } = getConfig();

  if (!fs.existsSync(xrayPath)) {
    logger.warn(`Xray binary not found at ${xrayPath} — skipping start`);
    xrayStatus = 'error';
    return;
  }

  return new Promise((resolve, reject) => {
    xrayProcess = spawn(xrayPath, ['run', '-config', configPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    xrayStatus = 'running';
    logger.info(`Xray started (pid ${xrayProcess.pid})`);

    xrayProcess.stdout.on('data', d => logger.info(`[xray] ${d.toString().trim()}`));
    xrayProcess.stderr.on('data', d => logger.warn(`[xray] ${d.toString().trim()}`));

    xrayProcess.on('close', code => {
      logger.info(`Xray exited with code ${code}`);
      xrayProcess = null;
      xrayStatus = code === 0 ? 'stopped' : 'error';
    });

    xrayProcess.on('error', err => {
      logger.error(`Xray error: ${err.message}`);
      xrayProcess = null;
      xrayStatus = 'error';
      reject(err);
    });

    setTimeout(resolve, 500); // give it 500ms to start
  });
}

function stop() {
  if (!xrayProcess) return;
  xrayProcess.kill('SIGTERM');
  xrayProcess = null;
  xrayStatus = 'stopped';
  logger.info('Xray stopped');
}

async function restart() {
  stop();
  await new Promise(r => setTimeout(r, 300));
  await start();
}

module.exports = { start, stop, restart, status };
