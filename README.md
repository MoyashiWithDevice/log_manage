# SIEM Log Management System

AI分析機能、日本語翻訳、PDF出力機能を備えたセキュリティログ管理システム

## 機能

- 📊 **ログ可視化**: システムログのリアルタイム表示と時系列グラフ
- 🤖 **AI分析**: Gemini APIを使用したログの自動分析
- 🌐 **日本語翻訳**: DeepL APIによる分析結果の日本語翻訳
- 📄 **PDF出力**: Markdownフォーマットを保持したPDFレポート生成
- 🔍 **フィルタリング**: レベル、プロセス、メッセージによる高度な検索
- 📈 **ダッシュボード**: ホスト別のログ統計とトレンド分析

## 技術スタック

### Backend
- FastAPI
- Python 3.8+
- Google Generative AI (Gemini)
- DeepL API
- Pandas

### Frontend
- React 18
- Vite
- Tailwind CSS
- Recharts
- React Markdown
- jsPDF

## セットアップ手順

### 1. 前提条件

- Python 3.8以上
- Node.js 16以上
- npm または yarn

### 2. リポジトリのクローン

```bash
cd c:/Users/pijon/Desktop/コーディング技法/log_manage
```

### 3. バックエンドのセットアップ

```bash
# バックエンドディレクトリに移動
cd backend

# 仮想環境の作成（推奨）
python -m venv venv

# 仮想環境の有効化
# Windows:
venv\Scripts\activate
# Mac/Linux:
# source venv/bin/activate

# 依存パッケージのインストール
pip install -r requirements.txt
```

### 4. 環境変数の設定

プロジェクトルートに `.env` ファイルを作成し、以下の内容を設定：

```env
GEMINI_API_KEY=your_gemini_api_key_here
DEEPL_API_KEY=your_deepl_api_key_here

# ログファイル・ログディレクトリを格納する親ディレクトリ
# 相対パスまたは絶対パスで指定可能
LOG_BASE_DIR=../logs
```

**環境変数の説明:**

| 環境変数 | 説明 | 例 |
|---------|------|-----|
| `GEMINI_API_KEY` | Gemini APIのキー | `AIzaSy...` |
| `DEEPL_API_KEY` | DeepL APIのキー | `xxxxx:fx` |
| `LOG_BASE_DIR` | ログファイルの親ディレクトリ | `../logs`, `/var/log`, `C:/logs` |
| `LOG_DIRECTORIES` | ログディレクトリ（カンマ区切り、`LOG_BASE_DIR`からの相対パス可） | `host1,host2,host3` |
| `LOG_RECURSIVE` | サブディレクトリを再帰的にスキャン | `true` / `false` |
| `SERVER_PORT` | APIサーバーのポート番号 | `8000` |
| `GEMINI_MODEL` | 使用するGeminiモデル | `gemini-2.0-flash-exp` |

**`LOG_BASE_DIR`の動作:**
- 設定された場合、`config.yaml`の`logs.directories`や`LOG_DIRECTORIES`環境変数で指定されたパスが相対パスであれば、`LOG_BASE_DIR`からの相対パスとして解決されます
- 絶対パスで指定されたディレクトリはそのまま使用されます
- 例: `LOG_BASE_DIR=/var/log`で`directories: ["./syslog"]`の場合、`/var/log/syslog`が使用されます

**APIキーの取得方法:**
- **Gemini API**: [Google AI Studio](https://makersuite.google.com/app/apikey) でAPIキーを取得
- **DeepL API**: [DeepL API](https://www.deepl.com/pro-api) で無料または有料プランに登録

### 5. 設定ファイルのカスタマイズ

`backend/config/config.yaml` を編集して、ログディレクトリやその他の設定をカスタマイズできます：

```yaml
logs:
  # ログファイル・ログディレクトリを格納する親ディレクトリ（ベースディレクトリ）
  # 相対パスまたは絶対パスで指定可能
  # directoriesで指定した相対パスは、このbase_dirからの相対パスとして解決されます
  # 環境変数 LOG_BASE_DIR で上書き可能
  base_dir: "../logs"
  
  # ログファイルのディレクトリ（複数指定可能）
  # base_dirが設定されている場合、相対パスはbase_dirからの相対パスとして解決
  # 絶対パスはそのまま使用
  directories:
    - "."
    # - "/var/log/syslog"  # 追加のディレクトリ（絶対パス）
  
  # 再帰的にサブディレクトリをスキャン
  recursive: false
  
  # 含めるファイルパターン
  include_patterns:
    - "*.log"
    - "*.txt"
  
  # 除外するファイルパターン
  exclude_patterns:
    - "*.gz"
    - "*.zip"
    - "*backup*"
```

**主要な設定項目:**

- `logs.base_dir`: ログファイルの親ディレクトリ（環境変数 `LOG_BASE_DIR` で上書き可能）
- `logs.directories`: ログファイルのディレクトリパス（複数指定可能、`base_dir`からの相対パス可）
- `logs.recursive`: サブディレクトリを再帰的にスキャンするか（`true`/`false`）
- `logs.include_patterns`: 含めるファイルのパターン（glob形式）
- `logs.exclude_patterns`: 除外するファイルのパターン（glob形式）
- `logs.max_file_size_mb`: 処理する最大ファイルサイズ（MB）
- `logs.host_detection`: ホスト名の検出方法（`filename`/`directory`/`auto`）
- `server.port`: APIサーバーのポート番号
- `server.cors.origins`: CORS許可オリジン
- `ai.gemini.model`: 使用するGeminiモデル
- `ai.max_logs_to_analyze`: AI分析する最大ログ件数

**`logs.base_dir`の動作:**
- `base_dir`が設定されている場合、`directories`で指定された相対パスは`base_dir`からの相対パスとして解決されます
- 絶対パスで指定されたディレクトリはそのまま使用されます
- 環境変数`LOG_BASE_DIR`が設定されている場合、`config.yaml`の`base_dir`よりも優先されます
- 例: `base_dir: "/var/log"`で`directories: [".", "syslog"]`の場合、`/var/log`と`/var/log/syslog`が使用されます

### 6. フロントエンドのセットアップ

```bash
# フロントエンドディレクトリに移動
cd ../frontend

# 依存パッケージのインストール
npm install
```

### 7. ログデータの配置

`backend/logs/` ディレクトリにホスト別のログファイルを配置：

```
backend/logs/
├── host1.log
├── host2.log
└── host3.log
```

**ログフォーマット例:**
```
2024-01-15 10:23:45 INFO systemd: Started Session 123 of user root.
2024-01-15 10:24:12 WARN kernel: Memory pressure detected
2024-01-15 10:25:33 ERROR sshd: Failed password for invalid user admin
```

## 起動方法

### バックエンドの起動

```bash
# backendディレクトリで実行
cd backend
uvicorn main:app --reload --port 8000
```

バックエンドは `http://localhost:8000` で起動します。

### フロントエンドの起動

```bash
# frontendディレクトリで実行（別のターミナル）
cd frontend
npm run dev
```

フロントエンドは `http://localhost:5173` で起動します。

### アクセス

ブラウザで `http://localhost:5173` を開いてアプリケーションを使用できます。

## 使用方法

### 1. ホストの選択
- ダッシュボード上部のドロップダウンからホストを選択

### 2. ログの閲覧
- フィルター機能でログレベル、プロセス、メッセージを絞り込み
- カラムヘッダーをクリックしてソート
- ページネーションで大量のログを効率的に閲覧

### 3. AI分析
- 「Analyze with AI」ボタンをクリック
- Gemini APIが最大50件のログを分析
- Markdownフォーマットで結果を表示

### 4. 日本語翻訳
- 分析結果が表示されたら「日本語で表示」ボタンをクリック
- DeepL APIが英語の分析結果を日本語に翻訳

### 5. PDF出力
- 「PDF出力」ボタンをクリック
- Markdownフォーマットを保持したPDFレポートをダウンロード
- ファイル名: `SIEM-Analysis-Report-YYYYMMDD-HHMMSS.pdf`

## API エンドポイント

### Backend API

- `GET /hosts` - 利用可能なホスト一覧を取得
- `GET /logs/{host}?limit=1000` - 指定ホストのログを取得
- `GET /stats/{host}` - ホストの統計情報を取得
- `POST /analyze` - ログのAI分析を実行
- `POST /translate` - テキストを日本語に翻訳

## トラブルシューティング

### バックエンドが起動しない
- Python仮想環境が有効化されているか確認
- `requirements.txt` のパッケージが全てインストールされているか確認
- `.env` ファイルが正しく設定されているか確認

### フロントエンドが起動しない
- Node.jsのバージョンが16以上か確認
- `npm install` が正常に完了したか確認
- ポート5173が他のプロセスで使用されていないか確認

### AI分析が動作しない
- `.env` に正しい `GEMINI_API_KEY` が設定されているか確認
- APIキーの使用制限に達していないか確認
- バックエンドのログでエラーメッセージを確認

### 翻訳が動作しない
- `.env` に正しい `DEEPL_API_KEY` が設定されているか確認
- DeepL APIの無料枠を超えていないか確認

### PDFが正しくダウンロードされない
- ブラウザのダウンロード設定を確認
- ブラウザコンソールでエラーメッセージを確認
- 分析結果が表示されているか確認

## 開発

### バックエンドの開発

```bash
cd backend
# 自動リロード付きで起動
uvicorn main:app --reload --port 8000
```

### フロントエンドの開発

```bash
cd frontend
# 開発サーバーを起動（HMR有効）
npm run dev
```

### ビルド

```bash
cd frontend
npm run build
```

ビルド成果物は `frontend/dist/` に生成されます。

## ライセンス

MIT License

## 作成者

SIEM Log Management System Development Team
