# いまひま

Vite + React + TanStack Router の SPA と、Cloudflare Workers 上の Hono API の開発用基盤です。
仕様: [Notion](https://app.notion.com/p/3f271dd9822680efa9aae5768b8076b7?source=copy_link)

## 必要環境と起動

Node.js 24 と npm が必要です。Cloudflare のアカウントや認証情報はローカル開発には不要です。

```sh
npm ci
npm run dev
```

表示された URL を開いてください。ホームの「この条件で探す」から、Figma表示確認用の検索結果・詳細へ移動できます。接続確認は開発用の `/?preview=states` にあります。

## コマンド

- `npm run dev`: 開発サーバー
- `npm run build`: 本番用ビルド（ルート定義も生成）
- `npm run preview`: ビルドして本番相当のローカルプレビューを起動
- `npm run check`: ルート定義を生成してから型チェック
- `npm run lint`: ESLint
- `npm test`: API・共通UI・ルートのテスト
- `npm run cf-typegen`: Wrangler の型定義を生成
- `npm run deploy`: ビルドして Cloudflare Workers にデプロイ（別途アカウント設定が必要）

## 構成

- `src/routes/`: ファイルベースの画面ルート。`src/routeTree.gen.ts` は自動生成されます。
- `worker/`: Hono API。外部 API のキー等はここでのみ扱います。
- `shared/`: クライアントとサーバーで共有する型。

現在は環境構築のみで、検索、地点情報、天気、認証、データベース、Google Places / Routes 連携は未実装です。将来の秘密情報はクライアントへ含めず、Workers の秘密情報として設定してください。

Workers の互換日付は、ローカル実行に使用する workerd が対応する `2026-10-19` に設定しています。

## 共通UI基盤（Issue #7）

参照はFigmaの[ホーム 200:244](https://www.figma.com/design/TwAPQ8OFQhLYWBtZw05WkZ/?node-id=200-244)、[検索結果 35:105](https://www.figma.com/design/TwAPQ8OFQhLYWBtZw05WkZ/?node-id=35-105)、[詳細 132:454](https://www.figma.com/design/TwAPQ8OFQhLYWBtZw05WkZ/?node-id=132-454)です。別のホーム案を混ぜず、取得時点の200:244（空き時間→エリア→カテゴリの順）を使用しています。

### デザインと部品

- `src/style.css`: 色・文字・余白・角丸・各部品の寸法。402px幅を基準に、狭い端末では可変幅、広い端末では402pxの画面を中央表示します。
- `src/components/ui/`: 60pxの矢印付き主要ボタン、35pxの小型主要ボタン、枠付き条件変更ボタン、カテゴリ選択、時間スライダー、タグ、アイコン。InterとNoto Sans JPをFontsourceから同梱しています。
- `src/assets/icons/`: Figmaから取得したSVG。アイコン固有の縦横比・寸法を保ちます。カテゴリの四角アイコンはFigmaの矩形プリミティブをCSSで表現しています。
- `src/components/places/`: 写真3枚のカード・コンパクト行・距離と時間の情報行・詳細見出しとタグ・区切り線付き詳細行・検索結果と詳細の画面枠。データ・写真・地図領域・操作をpropsで受け取る表示部品です。APIレスポンス型や取得処理は定義しません。
- `src/components/feedback/`: 読込・エラー・空・再試行。API取得と状態判定は呼び出し側が担当します。

OSステータスバー62pxをWeb UIから除外したため、各領域の縦位置は原則Figmaから62px上へ移動しています。ホームのブランド名は上部に読みやすく配置しています。代理の人物写真は取得・同梱せず、詳細ヒーローは同じ寸法の写真スロットにしています。

### 確認方法

`npm run dev`で起動した開発環境では次の表示を確認できます。

| URL | 内容 |
| --- | --- |
| `/` | Figmaと同じ配置のホーム。選択は画面内の表示だけを更新 |
| `/search?preview=design` | Figmaと同じカード・写真列・候補一覧の表示例 |
| `/places/preview?preview=design` | Figmaと同じタグ・情報行・地図枠・経路ボタンの表示例 |
| `/?preview=states` | 共通状態UIと既存health接続確認・再試行 |

ホームの検索ボタンは開発時のみ表示例へ進みます。サンプルの店舗情報・写真・静止地図は`src/components/dev/`に隔離し、本番ビルドには含めません。静止地図は見た目の確認専用で、地図機能ではありません。地図拡大と経路開始の操作は無効です。

本番の`/search`と`/places/$placeId`は同じ画面枠に空表示を渡し、未取得の店舗データを補完しません。`preview`クエリは開発時のみ有効です。

### 画面担当向けの使い方

```tsx
// 状態判定とAPI取得は画面側で行う
if (loading) return <LoadingState title="スポットを探しています" />
if (error) return <ErrorState onRetry={refetch} retrying={retrying} />
if (places.length === 0) return <EmptyState action={<Button onClick={changeConditions}>条件を変更</Button>} />

// 取得済みの表示データだけを渡す。未提供の料金・時間等は省略
<PlaceCard place={{ name, photos, category, distanceLabel }} action={detailLink} />
<DetailSummary name={name} tags={tags} rating={rating} />
<DetailRow icon="clockDetail">{openingHours}</DetailRow>

// 時間とカテゴリの状態は呼び出し側が管理
<TimeRange labels={labels} value={position} onChange={setPosition} />
<ChoiceChip selected={selected} onClick={toggle} icon={<CategoryGlyph />}>カフェ</ChoiceChip>

// ボタンは既定type="button"。送信だけtype="submit"を指定
<Button arrow>この条件で探す</Button>
<Link to="/" className={buttonClassName('secondary', 'small')}>条件を変更</Link>
```

### 後続Issueとの分担

現在地・地点入力は#8、検索条件の正式仕様とAPIへの引き渡し・天気は#9、検索結果の取得と条件保持は#10、操作可能な地図は#11、詳細取得・検索文脈を保った復帰・外部経路は#12です。ホームのカテゴリ名と時間目盛はFigmaの表示ラベルであり、APIのカテゴリ値・時間範囲・刻みの契約ではありません。

### 検証

`npm run check`（ビルド＋型チェック）、`npm run lint`、`npm test`で検証します。共通部品の操作、再試行、ルート遷移、任意データの欠損をテストしています。

2026-10-29に402px幅の実画面をFigmaの各領域と照合し、ホームの各入力領域・検索ボタン、検索結果の写真列・カード見出し・他候補、詳細シート・地図枠・経路ボタンの配置と寸法を調整しました。比較時の意図した差分はOSステータスバーの除外、ブランド名の上部配置、代理人物写真の非使用、未接続操作の無効化です。

主要領域の測定値（402px幅、上端からのY座標。Figmaからステータスバー62pxを除外した値と1px以内で一致）:

| 領域 | X / Y | 幅 / 高さ |
| --- | --- | --- |
| ホーム：時間入力 | 16 / 170 | 370 / 124 |
| ホーム：地点選択 | 16 / 326 | 370 / 90 |
| ホーム：カテゴリ | 16 / 448 | 370 / 227 |
| ホーム：検索ボタン | 16 / 707 | 370 / 60 |
| 検索結果：写真列 | 26 / 437 | 350 / 114 |
| 検索結果：他候補リスト | 26 / 696 | 350 / 101 |
| 詳細：地図枠 | 31 / 555 | 340 / 148 |
| 詳細：経路ボタン | 31 / 732 | 340 / 50 |

Node.js 24で型チェック・lint・ビルドと52テストが成功しています。Chromeで320px・402px・1440pxのプレビュー／通常ルート／404に横スクロールがないこと、Tab・Enter・Space・矢印キー、フォーカス、長文、動きを減らす設定を確認済みです。本番出力にサンプル画像・店舗名・開発パネルが含まれないことも確認しています。
