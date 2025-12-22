#!/usr/bin/env bash
set -euo pipefail

SESSION_NAME="glitch_home_server"
BACKEND_WAIT_SECONDS="${BACKEND_WAIT_SECONDS:-25}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"

quote_s() {
  local s="$1"
  printf "'%s'" "${s//\'/\'\"\'\"\'}"
}

require_dir() {
  local dir="$1"
  if [[ ! -d "$dir" ]]; then
    echo "找不到目錄：$dir" >&2
    exit 1
  fi
}

kill_listeners_on_port() {
  local port="$1"

  if ! command -v lsof >/dev/null 2>&1; then
    echo "找不到 lsof，無法自動釋放 port ${port}（請安裝 lsof 或手動清掉佔用程序）。" >&2
    exit 1
  fi

  local pids
  pids="$(lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null | sort -u || true)"
  if [[ -z "${pids}" ]]; then
    echo "port ${port}：未被佔用"
    return 0
  fi

  echo "port ${port}：發現佔用 PID：${pids//$'\n'/ }，嘗試結束..."

  local pid
  for pid in ${pids}; do
    kill "${pid}" 2>/dev/null || true
  done

  local end=$((SECONDS + 5))
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
    echo "port ${port}：仍無法釋放（可能權限不足或程序卡死）。" >&2
    exit 1
  fi

  echo "port ${port}：已釋放"
}

if ! command -v tmux >/dev/null 2>&1; then
  echo "找不到 tmux，請先安裝 tmux。" >&2
  exit 1
fi

require_dir "${repo_root}/backend"
require_dir "${repo_root}/frontend"
require_dir "${repo_root}/player-desktop"

if tmux has-session -t "${SESSION_NAME}" 2>/dev/null; then
  tmux kill-session -t "${SESSION_NAME}"
fi

kill_listeners_on_port 8000
kill_listeners_on_port 5173

tmux new-session -d -s "${SESSION_NAME}" -n "glitch-home"

tmux set-option -t "${SESSION_NAME}" remain-on-exit on

pane_backend="$(tmux list-panes -t "${SESSION_NAME}" -F '#{pane_id}' | head -n 1)"
pane_right="$(tmux split-window -h -t "${pane_backend}" -P -F '#{pane_id}')"
pane_player="$(tmux split-window -h -t "${pane_right}" -P -F '#{pane_id}')"

tmux select-layout -t "${SESSION_NAME}" even-horizontal

backend_dir="$(quote_s "${repo_root}/backend")"
frontend_dir="$(quote_s "${repo_root}/frontend")"
player_dir="$(quote_s "${repo_root}/player-desktop")"

backend_cmd="cd ${backend_dir} && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000"

if command -v curl >/dev/null 2>&1; then
  backend_probe="curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1"
else
  backend_probe="python3 -c 'import urllib.request; urllib.request.urlopen(\"http://127.0.0.1:8000/health\", timeout=1).read()' >/dev/null 2>&1"
fi

wait_backend="echo '[glitch-home] 等待後端就緒...'; end=$((SECONDS+${BACKEND_WAIT_SECONDS})); while true; do if ${backend_probe}; then echo '[glitch-home] 後端已就緒'; break; fi; if (( SECONDS >= end )); then echo '[glitch-home] 等待後端逾時，仍繼續啟動（可能會報錯）'; break; fi; sleep 0.5; done"

frontend_cmd="cd ${frontend_dir} && ${wait_backend} && npm run dev"
player_cmd="cd ${player_dir} && ${wait_backend} && npm run dev"

tmux send-keys -t "${pane_backend}" "${backend_cmd}" C-m
tmux send-keys -t "${pane_right}" "${frontend_cmd}" C-m
tmux send-keys -t "${pane_player}" "${player_cmd}" C-m

echo "已在背景啟動 tmux session：${SESSION_NAME}"
echo "Attach：tmux attach -t ${SESSION_NAME}"
