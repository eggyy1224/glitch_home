#!/usr/bin/env bash

set -euo pipefail

export CODEX_HOME="$(cd "$(dirname "$0")" && pwd)/.codex"

exec codex "$@"

