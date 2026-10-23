#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20 or newer is required."
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if (( NODE_MAJOR < 20 )); then
  echo "Node.js 20 or newer is required. Found $(node --version)."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required."
  exit 1
fi

if [ ! -f .env.local ]; then
  cp .env.example .env.local

  if command -v openssl >/dev/null 2>&1; then
    AUTH_SECRET_VALUE="$(openssl rand -hex 32)"
    if grep -q '^AUTH_SECRET=' .env.local; then
      sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=${AUTH_SECRET_VALUE}|" .env.local
    else
      printf '\nAUTH_SECRET=%s\n' "$AUTH_SECRET_VALUE" >> .env.local
    fi
  fi
fi

for setting in \
  "LOCAL_LLM_URL=http://127.0.0.1:11434" \
  "LOCAL_LLM_MODEL=qwen2.5:0.5b" \
  "LOCAL_LLM_TIMEOUT_MS=60000"
do
  key="${setting%%=*}"
  if ! grep -q "^${key}=" .env.local; then
    printf '%s\n' "$setting" >> .env.local
  fi
done

API_KEY="$(grep '^COMPOSIO_API_KEY=' .env.local | cut -d= -f2- || true)"
if [ -z "$API_KEY" ] || [ "$API_KEY" = "ak_your_project_key" ]; then
  echo "Update COMPOSIO_API_KEY in .env.local with your Composio project key, then rerun: npm run setup"
  exit 1
fi

npm install

if ! command -v ollama >/dev/null 2>&1; then
  curl -fsSL https://ollama.com/install.sh | sh
fi

if ! pgrep -x ollama >/dev/null 2>&1; then
  nohup ollama serve >/tmp/ollama.log 2>&1 &
  sleep 3
fi

ollama pull qwen2.5:0.5b

npm run preload:force
npm run build

echo
echo "Setup complete."
echo "Start the app with: npm run dev"
echo "Then open http://localhost:3000"