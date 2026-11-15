// Stops every Veru server, including ones left behind by a closed terminal or a crashed run.
// Usage: npm stop   (works on Windows, macOS and Linux; uses only Node built-ins)
//
// It finds whatever is listening on the app's ports and ends that process tree. Anything that
// isn't one of ours (dotnet, the API executables, node) is reported and left alone.
import { execFileSync } from 'node:child_process';
import { statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// `npm stop` touches this so the `npm start` window can say "stopped by npm stop" rather than "crashed".
const STOP_MARKER = join(tmpdir(), 'veru-stop-requested');
export function stopRequestedRecently() {
  try {
    return Date.now() - statSync(STOP_MARKER).mtimeMs < 15_000;
  } catch {
    return false;
  }
}

export const PORTS = {
  5173: 'App UI (Vite)',
  5080: 'Market data API',
  5180: 'Prompt Ledger API',
  5181: 'Prompt Ledger standalone UI',
};

const OURS = /^(dotnet|veru\.api|promptledger\.api|node)(\.exe)?$/i;
const isWindows = process.platform === 'win32';

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (err) {
    return err.stdout ?? ''; // lsof/netstat exit non-zero when nothing matches
  }
}

/** Map of PID -> ports it listens on, for the ports we own. */
function listeners() {
  const found = new Map();
  const add = (pid, port) => {
    if (!pid || pid === 0 || pid === process.pid) return;
    if (!found.has(pid)) found.set(pid, new Set());
    found.get(pid).add(port);
  };
  if (isWindows) {
    for (const line of run('netstat', ['-ano', '-p', 'tcp']).split(/\r?\n/).concat(run('netstat', ['-ano', '-p', 'tcpv6']).split(/\r?\n/))) {
      const m = line.trim().match(/^TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)$/i);
      if (m && PORTS[m[1]]) add(Number(m[2]), Number(m[1]));
    }
  } else {
    for (const port of Object.keys(PORTS)) {
      for (const pid of run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']).split(/\s+/)) add(Number(pid), Number(port));
    }
  }
  return found;
}

function processName(pid) {
  if (isWindows) {
    const row = run('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH']).trim();
    return row.startsWith('"') ? row.split('","')[0].slice(1) : '';
  }
  return run('ps', ['-p', String(pid), '-o', 'comm=']).trim().split('/').pop();
}

function kill(pid) {
  if (isWindows) run('taskkill', ['/PID', String(pid), '/T', '/F']);
  else {
    try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ }
  }
}

/** Stops our servers. Returns true when every app port is free afterwards. */
export function stopAll({ quiet = false } = {}) {
  const log = quiet ? () => {} : console.log;
  const found = listeners();
  if (found.size === 0) {
    log('Veru is not running. Nothing to stop.');
    return true;
  }
  let blocked = false;
  for (const [pid, ports] of found) {
    const name = processName(pid);
    const what = [...ports].map((p) => `${PORTS[p]} (port ${p})`).join(', ');
    if (name && !OURS.test(name)) {
      console.warn(`Port in use by another program, left running: ${name} (PID ${pid}) on ${what}. Close it yourself to free the port.`);
      blocked = true;
      continue;
    }
    log(`Stopping ${what}, PID ${pid}`);
    kill(pid);
  }
  // Give the OS a moment to release the sockets, then confirm.
  const deadline = Date.now() + 5000;
  let left = listeners();
  while (left.size > 0 && Date.now() < deadline) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    left = listeners();
  }
  if (!isWindows) for (const pid of left.keys()) { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
  if (!blocked) log('Veru stopped.');
  return !blocked;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { writeFileSync(STOP_MARKER, String(Date.now())); } catch { /* only affects the message */ }
  process.exitCode = stopAll() ? 0 : 1;
}
