#!/bin/bash

# ログ管理アプリケーション起動スクリプト
# バックエンドとフロントエンドを同時に起動します

# スクリプトのディレクトリを取得（ルートディレクトリ）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 終了時にバックグラウンドプロセスをクリーンアップ
cleanup() {
    echo ""
    echo "サーバーを停止しています..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "==================================="
echo "ログ管理アプリケーションを起動します"
echo "==================================="

# バックエンドを起動（バックグラウンド）
echo ""
echo "[Backend] uvicorn サーバーを起動中... (port 8000)"
cd "$SCRIPT_DIR/backend"
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# フロントエンドを起動（バックグラウンド）
echo "[Frontend] Vite 開発サーバーを起動中..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "==================================="
echo "両方のサーバーが起動しました"
echo "停止するには Ctrl+C を押してください"
echo "==================================="

# 両方のプロセスが終了するまで待機
wait $BACKEND_PID $FRONTEND_PID
