#!/usr/bin/env node
import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const processes = [];
let shuttingDown = false;

function spawnProcess(args, label) {
  const child = spawn(npmCommand, args, {
    stdio: 'inherit',
    env: process.env,
  });

  processes.push({ child, label });

  child.on('exit', (code) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    processes.forEach((proc) => {
      if (proc.child.pid !== child.pid && proc.child.exitCode === null) {
        proc.child.kill('SIGINT');
      }
    });
    process.exitCode = code ?? 0;
  });

  child.on('error', (error) => {
    console.error(`[${label}] erro ao iniciar:`, error);
    initiateShutdown(1);
  });
}

function initiateShutdown(code = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  processes.forEach(({ child }) => {
    if (child.exitCode === null) {
      child.kill('SIGINT');
    }
  });
  process.exitCode = code;
}

process.on('SIGINT', () => initiateShutdown(0));
process.on('SIGTERM', () => initiateShutdown(0));

spawnProcess(['run', 'dev:api'], 'backend');
spawnProcess(['run', 'client:dev'], 'frontend');
