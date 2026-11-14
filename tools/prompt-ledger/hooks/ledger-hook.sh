#!/usr/bin/env bash
# Forwards a Claude Code hook payload (stdin) to the Prompt Ledger CLI.
# Exits quietly when the CLI hasn't been built, so a fresh clone never sees hook errors.
# Build the CLI with: tools/prompt-ledger/scripts/build-cli.sh

dir="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../../.." && pwd)}"
bin="$dir/tools/prompt-ledger/.bin/ledger"
[ -x "$bin.exe" ] && bin="$bin.exe"

if [ -x "$bin" ]; then
  exec "$bin" hook
fi
exit 0
