# いまひま

Vite + React + TanStack Router の SPA と、Cloudflare Workers 上の Hono API の開発用基盤です。
仕様: [Notion](https://app.notion.com/p/3f271dd9822680efa9aae5768b8076b7?source=copy_link)

## 必要環境と起動

Node.js 24 と npm が必要です。Cloudflare のアカウントや認証情報はローカル開発には不要です。

```sh
npm ci
npm run dev
```

表示された URL を開いてください。ホームで `/api/health` に接続し、検索ページへの移動を確認できます。

## コマンド

- `npm run dev`: 開発サーバー
- `npm run build`: 本番用ビルド（ルート定義も生成）
- `npm run preview`: ビルドして本番相当のローカルプレビューを起動
- `npm run check`: ルート定義を生成してから型チェック
- `npm run lint`: ESLint
- `npm test`: API のテスト
- `npm run cf-typegen`: Wrangler の型定義を生成
- `npm run deploy`: ビルドして Cloudflare Workers にデプロイ（別途アカウント設定が必要）

## 構成

- `src/routes/`: ファイルベースの画面ルート。`src/routeTree.gen.ts` は自動生成されます。
- `worker/`: Hono API。外部 API のキー等はここでのみ扱います。
- `shared/`: クライアントとサーバーで共有する型。

現在は環境構築のみで、検索、地点情報、天気、認証、データベース、Google Places / Routes 連携は未実装です。将来の秘密情報はクライアントへ含めず、Workers の秘密情報として設定してください。

Workers の互換日付は、ローカル実行に使用する workerd が対応する `2026-10-19` に設定しています。
