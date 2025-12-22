#!/usr/bin/env bash
set -euo pipefail

SESSION_NAME="glitch_home_server"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"

kill_listeners_on_port() {
  local port="$1"

  if ! command -v lsof >/dev/null 2>&1; then
    echo "找不到 lsof，無法自動釋放 port ${port}。" >&2
    return 1
  fi

  local pids
  pids="$(lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null | sort -u || true)"
  if [[ -z "${pids}" ]]; then
    echo "port ${port}：未被佔用"
    return 0
  fi

  echo "port ${port}：結束佔用 PID：${pids//$'\n'/ }"
  local pid
  for pid in ${pids}; do
    kill "${pid}" 2>/dev/null || true
  done

  local end=$((SECONDS + 3))
  while ((SECONDS < end)); do
    if [[ -z "$(lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null || true)" ]]; then
      echo "port ${port}：已釋放"
      return 0
    fi
    sleep 0.2
  done

  echo "port ${port}：SIGTERM 無效，改用 SIGKILL..."
  pids="$(lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null | sort -u || true)"
  for pid in ${pids}; do
    kill -9 "${pid}" 2>/dev/null || true
  done

  sleep 0.2
  if [[ -n "$(lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null || true)" ]]; then
    echo "port ${port}：仍無法釋放（可能權限不足）。" >&2
    return 1
  fi

  echo "port ${port}：已釋放"
}

echo "repo：${repo_root}"

if command -v tmux >/dev/null 2>&1; then
  if tmux has-session -t "${SESSION_NAME}" 2>/dev/null; then
    echo "停止 tmux session：${SESSION_NAME}"
    tmux kill-session -t "${SESSION_NAME}"
  else
    echo "tmux session 不存在：${SESSION_NAME}"
  fi
else
  echo "找不到 tmux（略過 session 停止）" >&2
fi

# 額外保險：把常用埠位的 LISTEN 程序也清掉（專用機假設）
kill_listeners_on_port 8000 || true
kill_listeners_on_port 5173 || true
kill_listeners_on_port 5858 || true

echo "已停止 glitch home 相關服務"
