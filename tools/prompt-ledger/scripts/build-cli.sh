#!/usr/bin/env bash
# Publishes the `ledger` CLI to tools/prompt-ledger/.bin, where the Claude Code hook looks for it.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) rid=win-x64 ;;
  Darwin) [ "$(uname -m)" = arm64 ] && rid=osx-arm64 || rid=osx-x64 ;;
  *) [ "$(uname -m)" = aarch64 ] && rid=linux-arm64 || rid=linux-x64 ;;
esac

dotnet publish "$root/src/PromptLedger.Cli" -c Release -r "$rid" --self-contained false \
  -p:ReadyToRun=true -o "$root/.bin" --nologo
echo "ledger CLI published to $root/.bin"
