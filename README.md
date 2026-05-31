# page-deploy

Cloudflare Pages へ静的ファイルをデプロイする API ゲートウェイ。

プロジェクト単位の API Key（`dep_live_*`）で認証し、Cloudflare API Token はサーバー側のみが保持します。

## セットアップ

```bash
pnpm install
cp .env.example .env
# CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / SESSION_SECRET を設定
```

`SESSION_SECRET` は 32 文字以上のランダム文字列にしてください。

## 起動

```bash
pnpm build
pnpm start
# 開発時
pnpm dev
```

起動時に `admin_users` が空の場合、管理ユーザーが 1 件作成されます。`ADMIN_PASSWORD` 未設定時は生成パスワードが stderr に一度だけ表示されます。

- 公開 API: `PORT`（既定 `3000`）
- 管理 API: `ADMIN_PORT`（既定 `3001`、`ADMIN_HOST` でバインド）

## 管理 API（別ポート）

### ログイン

```bash
curl -c cookies.txt -X POST "http://127.0.0.1:3001/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<your-password>"}'
```

### プロジェクト作成

```bash
curl -b cookies.txt -X POST "http://127.0.0.1:3001/admin/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "my-site",
    "cfAccountId": "<CLOUDFLARE_ACCOUNT_ID>",
    "cfProjectName": "my-pages-site",
    "productionBranch": "main"
  }'
```

レスポンスの `id`（UUID）がデプロイ API の `:projectId` です。

### API Key 発行

```bash
curl -b cookies.txt -X POST "http://127.0.0.1:3001/admin/projects/<project-uuid>/api-keys" \
  -H "Content-Type: application/json" \
  -d '{"name":"ci-deploy"}'
```

レスポンスの `apiKey.plaintext` は **一度だけ** 表示されます。以降は再取得できません。

## デプロイ API

```http
POST /v1/projects/:projectId/deployments
Authorization: Bearer dep_live_<keyId>_<secret>
Content-Type: multipart/form-data
```

| フィールド | 内容 |
|-----------|------|
| `branch` | デプロイ先ブランチ（wrangler `--branch` に渡す） |
| `file` | 繰り返し可。各パートの `filename` にサイト内の相対パスを指定 |

`:projectId` は管理 API で作成したプロジェクトの UUID です。wrangler の `--project-name` には DB に登録した `cfProjectName` が使われます。

### アップロード上限

グローバル既定は環境変数で設定します。API Key ごとに `maxUploadBytes` / `maxFileCount` を上書きできます。

| 変数 | 既定 | 内容 |
|------|------|------|
| `MAX_UPLOAD_BYTES` | 50MB | ファイル合計サイズ |
| `MAX_FILE_COUNT` | 1000 | ファイル数 |
| `MAX_SINGLE_FILE_BYTES` | 10MB | 1 ファイルあたり |
| `MAX_MULTIPART_FIELDS` | 4 | テキストフィールド数 |
| `MAX_MULTIPART_FIELD_SIZE` | 256 | テキストフィールド 1 件の最大バイト |

### 例

```bash
curl -f -X POST "http://localhost:3000/v1/projects/<project-uuid>/deployments" \
  -H "Authorization: Bearer dep_live_..." \
  -F "branch=main" \
  -F "file=@index.html;filename=index.html"
```

### レスポンス例（成功）

```json
{
  "status": "success",
  "projectId": "<project-uuid>",
  "branch": "main",
  "previewUrl": "https://xxx.pages.dev",
  "fileCount": 1,
  "totalBytes": 1234
}
```

### ヘルスチェック

```bash
curl http://localhost:3000/health
```

## 制約

- デプロイは `node_modules/.bin/wrangler` のみ使用
- Worker / Pages Functions 関連ファイルは拒否
- multipart でファイルを直接送信（ZIP 非対応）
