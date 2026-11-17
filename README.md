# いまひま

Vite + React + TanStack Router の SPA と、Cloudflare Workers 上の Hono API の開発用基盤です。
仕様: [Notion](https://app.notion.com/p/3f271dd9822680efa9aae5768b8076b7?source=copy_link)

## 必要環境と起動

Node.js 24 と npm が必要です。Cloudflare のアカウントや認証情報はローカル開発には不要です。

```sh
npm ci
npm run dev
```

表示された URL を開き、ホームで検索地点・カテゴリ・モードを選んで「この条件で探す」を押してください。検索結果から詳細へ進み、お気に入りはブラウザー内に保存されます。

### Google Maps API（任意）

キーが未設定でも画面枠と外部 Google Maps リンクは表示されますが、検索・詳細・徒歩時間の実データ取得はエラー状態になります。キーや Google の短命な写真 URL を画面へ直接出す実装にはしません。

- Worker の `.dev.vars` に `GOOGLE_PLACES_API_KEY` を設定します。これは Places API (New) の検索・詳細・写真用**サーバー秘密情報**です。詳細・写真では既存の `GOOGLE_MAPS_API_KEY` も後方互換として読めますが、新規設定では `GOOGLE_PLACES_API_KEY` を使ってください。
- Worker の `.dev.vars` に `GOOGLE_MAPS_API_KEY` を設定します。これは徒歩経路を計算する Routes API 用の**サーバー秘密情報**です。Places 用のキーとは分離し、本番ではそれぞれ Workers の Secret として設定します。
- ブラウザー地図は `.env.local` の `VITE_GOOGLE_MAPS_API_KEY` を使います。これは Maps JavaScript API 専用の公開キーで、Google Cloud 側で HTTP リファラー制限を必ず設定します。Worker のキーを `VITE_` で公開してはいけません。
- Google Cloud で Places API (New)、Routes API、Maps JavaScript API を必要なキーごとに有効化します。写真は `GET /api/place-photos?name=places/.../photos/...&maxWidthPx=800` が一度だけ安全に中継し、保存・キャッシュしません。
- 写真の提供者表示は API が返した attribution をそのまま表示します。写真リソース名・メタデータ・画像バイトを localStorage やアプリのキャッシュへ保存しません。

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

現在のMVPは、地点検索・天気・Places検索/詳細・徒歩経路・Google Maps表示・ブラウザー内のお気に入りを実装しています。認証・サーバー側データベース・共有お気に入りは対象外です。秘密情報はクライアントへ含めず、Workers の秘密情報として設定してください。

検索結果は `GET /api/search` が一度に返す天気・徒歩経路・ランキングを使用します。画面側で順位を再計算しません。`nearby` の `walkMinutes` は既存画面の徒歩圏内条件との互換用の任意パラメータで、指定時は徒歩経路があり指定分以内の候補だけを、サーバーのおすすめ順を保ったまま返します。既存画面の「運動」は今回の互換拡張として API カテゴリ `exercise` に対応しています。

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

`npm run dev`で起動した開発環境では次の画面を確認できます。Google APIを使う経路は、キーを設定してからホームの操作で開いてください。

| URL | 内容 |
| --- | --- |
| `/` | 検索地点、カテゴリ、空き時間を選ぶホーム |
| `/search` | ホームから渡された条件での検索結果。直接開く場合は地点の緯度・経度を含む検索パラメータが必要 |
| `/places/:placeId` | 検索結果またはお気に入りから開く施設詳細と外部経路リンク |
| `/favorites` | ブラウザー内に保存した Place ID を再取得して表示する一覧 |

ホームの検索ボタンは、選択した地点と条件を`/search`へ渡して実データを取得します。Google Maps JavaScript APIのキーを設定した場合は地図を表示し、未設定時は外部Google Mapsリンクへ切り替わります。`src/components/dev/`は開発用の表示確認にだけ使います。

本番の`/search`と`/places/$placeId`は、Google APIから取得した値だけを表示します。お気に入りにはPlace IDと保存日時だけを保存し、施設名・住所・写真などのGoogleデータは保存しません。`preview`クエリは開発時のみ表示確認に使えます。

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
