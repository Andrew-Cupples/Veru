// Starts Veru: checks prerequisites, installs packages on first run, clears any servers left over
// from an earlier run, starts everything, waits until it is healthy, then opens the browser.
// Everything is reached through one address: http://localhost:5173
//
// Usage: npm start   (Ctrl+C in this window, or `npm stop` from any other, shuts it all down)
//
// The servers are launched directly (dotnet and node, never through npm.cmd), so Ctrl+C on Windows
// doesn't stop to ask "Terminate batch job (Y/N)?".
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { stopAll, stopRequestedRecently } from './stop.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP_URL = 'http://localhost:5173';
const isWindows = process.platform === 'win32';
const color = process.stdout.isTTY ? (code, s) => `\x1b[${code}m${s}\x1b[0m` : (_, s) => s;
const step = (msg) => console.log(color(36, `[veru] ${msg}`));
const fail = (msg) => {
  console.error(color(31, `\n[veru] ${msg}\n`));
  process.exit(1);
};

// 1. Prerequisites
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 22) fail(`Node 22 or newer is required (found ${process.version}). Install it from https://nodejs.org`);

let sdks = '';
try {
  sdks = execFileSync('dotnet', ['--list-sdks'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch {
  fail('The .NET SDK was not found. Install the .NET 10 SDK from https://dotnet.microsoft.com/download/dotnet/10.0, then open a new terminal.');
}
if (!/^10\./m.test(sdks)) fail(`The .NET 10 SDK is required. Installed SDKs:\n${sdks || '  (none)'}\nInstall it from https://dotnet.microsoft.com/download/dotnet/10.0`);

// 2. Packages: install on first run, or when package-lock.json changed since the last install
const lock = join(root, 'package-lock.json');
const installed = join(root, 'node_modules', '.package-lock.json');
if (!existsSync(installed) || statSync(lock).mtimeMs > statSync(installed).mtimeMs) {
  step('Installing packages (first run only, takes a minute)...');
  const npmCli = process.env.npm_execpath;
  const npm = npmCli?.endsWith('.js')
    ? spawn(process.execPath, [npmCli, 'install', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit' })
    : spawn('npm', ['install', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit', shell: true });
  if ((await new Promise((r) => npm.on('exit', r))) !== 0) fail('npm install failed; see the output above.');
}

// 3. Clear anything still running from a previous session (the usual cause of "port already in use")
if (!stopAll({ quiet: true })) fail('A port Veru needs is taken by another program (see above). Close it and run `npm start` again.');

// 4. Start the three servers. The UI's dev server on :5173 forwards /api calls to the two APIs.
const servers = [
  { name: 'market', code: 32, cmd: 'dotnet', args: ['run', '--project', 'backend/src/Veru.Api', '--launch-profile', 'http'], health: 'http://localhost:5080/health' },
  { name: 'ledger', code: 34, cmd: 'dotnet', args: ['run', '--project', 'tools/prompt-ledger/src/PromptLedger.Api', '--launch-profile', 'http'], health: 'http://localhost:5180/health' },
  { name: 'web   ', code: 35, cmd: process.execPath, args: [join(root, 'node_modules', 'vite', 'bin', 'vite.js')], cwd: join(root, 'web'), health: APP_URL },
];

step('Starting the market data API, the Prompt Ledger API and the UI...');
let stopping = false;
const running = servers.map((s) => {
  const child = spawn(s.cmd, s.args, { cwd: s.cwd ?? root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '1' } });
  const tag = color(s.code, `[${s.name}]`);
  for (const stream of [child.stdout, child.stderr]) {
    createInterface({ input: stream }).on('line', (line) => console.log(`${tag} ${line}`));
  }
  child.exited = new Promise((r) => child.on('exit', (code) => r(code)));
  child.on('error', (err) => console.error(`${tag} failed to start: ${err.message}`));
  child.exited.then((code) => {
    if (stopping) return;
    if (stopRequestedRecently()) shutdown('Stopped by `npm stop`.');
    else shutdown(`The ${s.name.trim()} server stopped unexpectedly (exit code ${code}); stopping everything. See its output above.`, 1);
  });
  return child;
});

async function shutdown(reason, exitCode = 0) {
  if (stopping) return;
  stopping = true;
  step(reason);
  // Ctrl+C already reached the servers (they share this console); ask any that didn't get it.
  for (const c of running) if (c.exitCode === null) c.kill(isWindows ? undefined : 'SIGINT');
  await Promise.race([Promise.all(running.map((c) => c.exited)), new Promise((r) => setTimeout(r, 8000))]);
  stopAll({ quiet: true }); // anything that ignored the request, e.g. an API process `dotnet run` left behind
  step('Stopped.');
  process.exit(exitCode);
}
process.on('SIGINT', () => shutdown('Stopping...'));
process.on('SIGTERM', () => shutdown('Stopping...'));

// 5. Wait until all three answer, then open the app
const started = Date.now();
for (const s of servers) {
  while (!stopping) {
    try {
      if ((await fetch(s.health)).ok) break;
    } catch { /* not up yet */ }
    if (Date.now() - started > 180_000) {
      await shutdown(`The ${s.name.trim()} server didn't become ready within 3 minutes; stopping. See its output above.`, 1);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!stopping) {
  console.log(color(36, `\n[veru] Ready: ${APP_URL}   (press Ctrl+C here, or run \`npm stop\`, to shut down)\n`));
  if (!process.env.VERU_NO_BROWSER) {
    const [cmd, args] = isWindows ? ['cmd', ['/c', 'start', '""', APP_URL]] : process.platform === 'darwin' ? ['open', [APP_URL]] : ['xdg-open', [APP_URL]];
    spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  }
}
