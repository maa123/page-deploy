# page-deploy

Cloudflare Pages へ静的ファイルをデプロイする API ゲートウェイ。

## セットアップ

```bash
pnpm install
cp .env.example .env
# CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / API_KEY を設定
```

## 起動

```bash
pnpm build
pnpm start
# 開発時
pnpm dev
```

## デプロイ API

```http
POST /v1/projects/:projectId/deployments
Content-Type: multipart/form-data
X-API-Key: <API_KEY>
```

| フィールド | 内容 |
|-----------|------|
| `branch` | デプロイ先ブランチ（wrangler `--branch` に渡す） |
| `file` | 繰り返し可。各パートの `filename` にサイト内の相対パスを指定 |

`projectId` は Cloudflare Pages のプロジェクト名（`--project-name`）として使用されます。

### アップロード上限

| 変数 | 既定 | 内容 |
|------|------|------|
| `MAX_UPLOAD_BYTES` | 50MB | ファイル合計サイズ |
| `MAX_FILE_COUNT` | 1000 | ファイル数 |
| `MAX_SINGLE_FILE_BYTES` | 10MB | 1 ファイルあたり |
| `MAX_MULTIPART_FIELDS` | 4 | テキストフィールド数 |
| `MAX_MULTIPART_FIELD_SIZE` | 256 | テキストフィールド 1 件の最大バイト |

### 例

```bash
curl -f -X POST "http://localhost:3000/v1/projects/my-pages-site/deployments" \
  -H "X-API-Key: your-api-key" \
  -F "branch=main" \
  -F "file=@index.html;filename=index.html"
```

### レスポンス例（成功）

```json
{
  "status": "success",
  "projectId": "my-pages-site",
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
- ZIP は受け付けない（multipart でファイルを直接送信）
