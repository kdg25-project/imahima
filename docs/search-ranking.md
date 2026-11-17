# 検索ランキング（Issue #5）

## 根拠と適用範囲

| 区分 | 内容 |
| --- | --- |
| 参照文書に明記された要求 | [Issue #5](https://github.com/kdg25-project/imahima/issues/5) の2モード、カテゴリ、天気・距離等による推薦、外部障害時502。徒歩経路は [Issue #4](https://github.com/kdg25-project/imahima/issues/4)、関連する検索表示は [Issue #9](https://github.com/kdg25-project/imahima/issues/9) を参照する。広いMVP要件は [Notion仕様](https://app.notion.com/p/3f271dd9822680efa9aae5768b8076b7) を参照する。 |
| 今回ユーザーが直接承認した方針 | 徒歩片道の2倍による往復見積り、滞在時間・カテゴリ優先・天気補正の方針、30℃境界、欠損時の扱い、並び順、外部障害分類。既存チーム合意の記録ではない。 |
| 今回実装で具体化した提案 | 距離250/500/1000m閾値、travelの具体式、rating floor、小数第2位丸め、5秒timeout、最大4並列は上記方針に沿う**今後チーム確認用の提案**であり、ユーザーが逐一明示承認した数値ではない。 |
| 外部仕様 | 天気コードは [Open-Meteo weather variables](https://open-meteo.com/en/docs#weather_variable_documentation) のWMOコードを用いる。 |

## 1. 入力と候補取得

`mode=nearby` と `mode=free-time`、既存の `any` と8カテゴリ（`cafe`、`food`、`shopping`、`entertainment`、`sightseeing`、`park`、`study`、`rest`）を扱う。`category` 省略時は `any`、`radius` は既存どおり既定1000m・0より大きく50000以下の有限値である。

`free-time` の `duration` は必須で、空白・非有限・0以下は400。`nearby` は渡されても `duration` をランキングに使用しない。既存のPlacesカテゴリマッピング（例: `study` が library と cafe を検索）を保持し、正規化後のカテゴリ文字列だけで候補を再除外しない。

## 2. 距離、徒歩時間、空き時間

| 項目 | 計算・欠損時 |
| --- | --- |
| `distance` | PR20どおりHaversineによる直線距離の整数m。有効な座標がなければ `null`。徒歩実測とは表現しない。 |
| `walkingDistanceMeters` / `walkingDurationSeconds` | Google Routes APIの片道WALK。経路または有効な座標がなければ `null`。 |
| `T` | `ceil(walkingDurationSeconds / 60)` 分。1秒でも1分。 |
| `availableStayMinutes` | `free-time` のみ `D - 2T`。`nearby` は `null`。帰りは別検索せず、片道の2倍による見積りである。 |
| 最低滞在時間 | food=30、cafe=15、park=5、その他と未知カテゴリ=15分。`2T + minimumStay > D` を除外し、等号は採用。 |

`free-time` は無効/欠落座標・経路なし、または経路不存在の候補を除外する。`nearby` はその候補を残して該当フィールドと未確定のスコア要素を `null` / 0 とする。全候補が除外されても天気と `places: []` を200で返す。Routesを必要としない候補だけならMaps APIキー未設定でも検索を500にはしない。

## 3. スコアと並び順

`clamp(x)=min(1,max(0,x))`。返却する `score` は次の合計を小数第2位に丸めた値で、同じ値を並び順に使う。

| 要素 | 値 |
| --- | --- |
| カテゴリ | 明示指定40、`any`は0 |
| 直線距離 | <=250m:15、<=500m:10、<=1000m:5、その他/unknown:0 |
| 徒歩時間 | nearby: `20*clamp(1-T/30)`、free-time: `20*clamp((D-2T)/D)`、unknown:0 |
| 天気 | 次節の補正。重複加算しない。 |
| 営業中 | `openNow === true` のとき5、それ以外0。全時間共通であり夜専用の規則ではない。 |
| 評価 | 有限の0〜5のみ `floor(rating)`、それ以外0 |

理論範囲は `any` が -15〜60、明示カテゴリが25〜100。並び順は score降順、徒歩秒昇順（unknownは最後）、直線距離昇順（unknownは最後）、`id` のcode point昇順（nullは最後）、元の取得順である。日本語locale依存の比較はしない。

例: `D=60`、food、`T=8`、distance=420m、wet、営業中、rating=4.2 は `40+10+14.67+15+5+4=88.67`、`availableStayMinutes=44`。同じfoodで `D=30` は最低30分を確保できず除外する。

## 4. 天気補正と理由

wetは precipitation>0 または weatherCode `{51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,97,99}`。wetを最優先し、それ以外でtemperature>=30をhot、さらに code 0/1かつ降水0をsunny、その他をneutralとする。未知コードでも降水があればwet、降水0ならneutral（ただし30℃以上はhot）である。

| カテゴリ | wet | hot | sunny |
| --- | ---: | ---: | ---: |
| cafe / food / study | +15 | +10 | 0 |
| park | -15 | -10 | +10 |
| shopping / entertainment / sightseeing / rest | 0 | 0 | 0 |

mixedカテゴリは施設単位の屋内外を推測せず中立。reasonは確定した根拠だけを固定順で返す。例: `カテゴリ「food」で検索`、`直線距離の目安 420m`、`徒歩 8分`、`往復は片道徒歩時間の2倍で見積もり、現地で過ごせる目安 44分`、`雨天を考慮したカテゴリ補正 +15点`、`営業中`、`評価 4.2`。unknownを0分や屋内と表現しない。

## 5. 外部障害と実行上限

Weather、Places、Routesへの各要求は5秒でAbortSignalをabortし、呼び出し元のキャンセルも伝播する。Routesは同時に最大4件ずつ実行する。Routes APIの経路不存在は内部で区別し、`/api/routes` は従来どおり404、検索ではnearbyのnullまたはfree-time除外となる。一方、通信・5xx・JSON/形式異常・timeoutは検索で502。Weather/Placesの外部障害も502、キー未設定等のサーバ設定・想定外の内部例外は500である。

## 6. テストと未決定事項

単体テストはdurationの欠落、1秒の切り上げ、最低滞在の等号、全除外、weather集合・降水優先・30℃境界・mixed中立、score例、同点安定ソート、timeout時のabortとtimer cleanupを検証する。統合テストはWeather/Places/Routesの失敗502と、既存 `/api/routes` の404契約を検証する。

夜間専用の補正、施設ごとの真の屋内外判定、復路を別経路として取得することは今回未決定である。今回の `2T` は往復の近似であって、復路を実測済みという意味ではない。
