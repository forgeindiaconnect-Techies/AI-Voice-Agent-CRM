import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

console.log('[Pre-build Cleanup] Starting build environment cleanup...');

// Helper to pause execution
function sleep(ms) {
  try {
    const Atomics = globalThis.Atomics;
    const SharedArrayBuffer = globalThis.SharedArrayBuffer;
    if (Atomics && SharedArrayBuffer) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    } else {
      const start = Date.now();
      while (Date.now() - start < ms) {}
    }
  } catch {
    const start = Date.now();
    while (Date.now() - start < ms) {}
  }
}

// 1. Terminate any running Electron/App processes
if (process.platform === 'win32') {
  const processNames = [
    'ForgeCRM.exe',
    'Forge CRM Desktop.exe',
    'Forge CRM Desktop 0.1.0.exe',
    'Forge CRM.exe',
    'electron.exe'
  ];

  let killedAny = false;
  for (const proc of processNames) {
    try {
      execSync(`taskkill /F /IM "${proc}" /T`, { stdio: 'ignore' });
      console.log(`[Pre-build Cleanup] Terminated process: ${proc}`);
      killedAny = true;
    } catch {
      // Process not running
    }
  }

  if (killedAny) {
    console.log('[Pre-build Cleanup] Pausing 1s for Windows file handle release...');
    sleep(1000);
  }
}

// Helper to force clean directory using native commands and fallback
function forceCleanDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;

  console.log(`[Pre-build Cleanup] Cleaning: ${dirPath}`);

  // On Windows, strip read-only attributes first
  if (process.platform === 'win32') {
    try {
      execSync(`attrib -R -A -S -H "${dirPath}\\*.*" /S /D`, { stdio: 'ignore' });
    } catch {}

    try {
      execSync(`cmd /c rmdir /s /q "${dirPath}"`, { stdio: 'ignore' });
      console.log(`[Pre-build Cleanup] Force removed with rmdir: ${dirPath}`);
      return;
    } catch (err) {
      console.warn(`[Pre-build Cleanup] rmdir notice: ${err.message}`);
    }
  }

  // Node fs fallback
  try {
    fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
    console.log(`[Pre-build Cleanup] Removed directory: ${dirPath}`);
  } catch (err) {
    console.warn(`[Pre-build Cleanup] Notice: ${err.message}`);
  }
}

// 2. Clean build output directories (dist, dist-electron & release/win-unpacked)
const dirsToClean = [
  path.join(frontendDir, 'dist'),
  path.join(frontendDir, 'dist-electron'),
  path.join(frontendDir, 'release', 'win-unpacked')
];

for (const dir of dirsToClean) {
  forceCleanDir(dir);
}

console.log('[Pre-build Cleanup] Environment clean & ready for build.');
