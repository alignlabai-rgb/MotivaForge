# MotivaForge - プロジェクト引継ぎドキュメント
作成日: 2026-06-13

---

## 1. プロジェクト概要

**目的**: スマホのホーム画面に設置するPWA（Progressive Web App）モチベーション管理ダッシュボード

**GitHubリポジトリ**: https://github.com/alignlabai-rgb/MotivaForge  
**デプロイ先**: GitHub Pages（静的ホスティング）

**ユーザー**: マラソン選手 / AI・アプリ開発に取り組む

---

## 2. 実現したい機能（全体像）

1. **大会カウントダウン** - 目標大会までの残り日数表示
2. **体重トラッキング** - 今日の体重ログ＋目標体重への残りkg表示
3. **思想家フラッシュカード** - ランダム表示（メイン実装対象） ← データ生成済み
4. **ポモドーロタイマー** - 学習・トレーニング用（将来拡張）
5. **プッシュ通知** - Firebase Cloud Messaging (FCM)で思想家カードを通知

---

## 3. 思想家フラッシュカード仕様（コア機能）

### 表示フォーマット
```
P-276
イマヌエル・カント
Kant, Immanuel

【本質】
世界は対象に合わせてそのまま分かるのではない。
カントは、認識する側の形式が経験を成り立たせると示した。
```

### データ
- **人数**: 710人（固定・増減なし）
- **パターン**: 本質・問い・論点 の3種類
- **合計**: 710 × 3 = **2130パターン**がランダム表示

### 各パターンの内容
| パターン | 内容 |
|---------|------|
| 【本質】 | impactフィールドの全文 |
| 【問い】 | impactの最初の一文（句点まで） |
| 【論点】 | 「論点: ○○なのか、それとも××なのか」形式 |

### データファイル（✅ 生成済み）
`C:\Users\dzbk\OneDrive\デスクトップ\Contents\MotivaForge\data\thinkers.json`
- **サイズ**: 339.6 KB
- **件数**: 710件
- **構造**:
```json
{
  "num": 276,
  "name": "イマヌエル・カント",
  "en_name": "Kant, Immanuel",
  "essence": "世界は対象に合わせてそのまま分かるのではない。カントは...",
  "question": "世界は対象に合わせてそのまま分かるのではない。",
  "debate": "論点: 善い行為は結果で決まるのか、それとも理性が命じる義務で決まるのか。"
}
```

### データの元ソース
- `C:\Users\dzbk\OneDrive\デスクトップ\Contents\Thinkers-700-reorg\02_canonical\thinkers-data.js`
  → impactフィールドを本質・問いに使用
- `C:\Users\dzbk\OneDrive\デスクトップ\Contents\Thinkers-700-reorg\02_canonical\index.html`
  → debateGuideOverridesオブジェクト（717件）から論点を抽出

### 再生成スクリプト
`C:\Users\dzbk\.gemini\antigravity\brain\d3f99ff2-1879-47a0-814f-4b471f5dadfb\scratch\extract_thinkers.js`
→ Node.jsで実行すると thinkers.json を再生成できる

---

## 4. フォルダ構成（予定）

```
MotivaForge/
├── PROJECT_HANDOFF.md  ← このファイル
├── index.html          ← メインアプリ（未作成）
├── style.css           ← スタイル（未作成）
├── app.js              ← メインロジック（未作成）
├── sw.js               ← Service Worker（未作成）
├── manifest.json       ← PWAマニフェスト（未作成）
├── firebase-messaging-sw.js ← FCM用SW（未作成）
├── data/
│   ├── thinkers.json   ← ✅ 生成済み（710人×3パターン）
│   ├── races.json      ← ✅ 生成済み（2026年全23大会）
│   └── quotes.json     ← 未作成（将来拡張用）
└── icons/
    └── （PWAアイコン各サイズ）← 未作成
```

---

## 5. 技術スタック

| 項目 | 技術 |
|------|------|
| フロントエンド | Vanilla HTML / CSS / JavaScript |
| PWA | Service Worker + Web App Manifest |
| ストレージ | IndexedDB（体重ログ等）|
| プッシュ通知 | Firebase Cloud Messaging (FCM) |
| ホスティング | GitHub Pages |
| データ形式 | JSON（静的ファイル）|

---

## 6. 大会データ（✅ 受領・JSON化済み）

`C:\Users\dzbk\OneDrive\デスクトップ\Contents\MotivaForge\data\races.json`

**全23大会・2026年通年**のデータが格納済み。

### statusの値
| 値 | 意味 |
|----|----- |
| `completed` | 参加済み |
| `ready` | 準備済み |
| `confirmed` | エントリー確定 |
| `needs_transport` | 交通機関調整必要 |
| `needs_entry` | エントリー要対応 |

### 直近の未完了レース（2026-06-13時点）
| 大会名 | 日程 | 距離 | status |
|--------|------|------|--------|
| 両神山麓トレイルラン | 06-21 | 20.7km | ready |
| 津南ウルトラマラソン | 07-05 | 80km | ready |
| みちのく津軽ジャーニーラン | 07-18〜20 | 262km | needs_transport |
| 富士山頂往復マラニック | 07-31〜08-01 | 112km | confirmed |
| 富士山麓一周フットレース | 08-21〜22 | 100km | confirmed |
| 下北〜函館ジャーニーラン | 08-29〜30 | 101km | needs_transport |
| うつくしまジャーニーラン | 09-19〜21 | 250km | needs_entry |
| 能登の国ジャーニーラン | 10-03〜04 | 151km | needs_entry |
| 伊豆半島一周フットジャーニー | 10-10〜12 | 230km | confirmed |
| 東京グレートレース250KM | 11-06〜08 | 250km | confirmed |
| 錦秋の奥武蔵秩父JR | 11-14〜15 | 145km | needs_entry |
| 橘湾岸スーパーマラニック秋 | 11-20〜22 | **320km** | confirmed |
| 水戸街道ジャーニーラン | 11-28〜29 | 127km | needs_entry |

### JSONフォーマット
```json
{
  "id": "race_2026_11",
  "name": "第14回 日本百名山・両神山麓トレイルラン",
  "date_start": "2026-06-21",
  "date_end": "2026-06-21",
  "distance_km": 20.7,
  "distance_label": "20.7km",
  "time_limit": "5時間30分",
  "status": "ready",
  "notes": "BUS手配済み",
  "multi_stage": false
}
```

---

## 7. UIデザイン方針

- **カラーテーマ**: ダークモード基調（#0b0d10系）
- **アクセントカラー**: ゴールド (#f2c572) + ブルー (#38bdf8)
- **フォント**: Inter + Noto Sans JP
- **スタイル**: ガラスモーフィズム、グラデーション、マイクロアニメーション
- **対応デバイス**: モバイルファースト（ホーム画面に追加して使用）

---

## 8. 実装ステップ（残作業）

### Step 1: 静的ファイル作成 ← 次にやること
- [ ] manifest.json 作成
- [ ] index.html 作成（タブUI: ホーム / 思想家 / タイマー）
- [ ] style.css 作成（デザインシステム）
- [ ] app.js 作成（思想家ランダム表示、大会カウントダウン）

### Step 2: PWA対応
- [ ] sw.js 作成（オフラインキャッシュ）
- [ ] PWAアイコン生成（192x192, 512x512）

### Step 3: 大会データ組み込み
- [ ] ユーザーから大会データ受領
- [ ] races.json 作成
- [ ] カウントダウン表示実装

### Step 4: Firebase / プッシュ通知
- [ ] Firebaseプロジェクト作成（console.firebase.google.com）
- [ ] FCM設定（firebase-messaging-sw.js）
- [ ] 通知トリガー（GitHub Actions or Cloud Functions）
- [ ] 思想家カードをプッシュ通知として送信

### Step 5: GitHubへデプロイ
- [ ] リポジトリにファイルをプッシュ
- [ ] GitHub Pages有効化（Settings > Pages > main branch）

---

## 9. 次のセッションへの引継ぎ指示

新しいセッションを開始する場合、以下をAIに伝えてください：

```
MotivaForgeというPWAダッシュボードを作っています。
C:\Users\dzbk\OneDrive\デスクトップ\Contents\MotivaForge\ フォルダにプロジェクトを作ってください。
PROJECT_HANDOFF.md に全詳細が書いてあります。
data\thinkers.json（710人の思想家データ、339KB）はすでに生成済みです。
次のステップはStep 1のindex.html・style.css・app.jsの作成です。
大会データはまだ受け取っていないのでracesはダミーデータで先に実装してください。
```

---

## 10. ユーザー補足情報

- 音声入力（Aqua Voice）を使用しているため、文字起こしに誤りがある場合あり
- AI・アプリ開発を学習中
- マラソン選手：大会目標 + 体重管理がモチベーションの軸
- 将来的に心理学者などの別コンテンツカテゴリを追加したい（現在は思想家のみ）
- `C:\Users\dzbk\OneDrive\デスクトップ\Contents\` 配下にコンテンツデータが集中している

---

## 11. セッション情報

- **会話ID**: d3f99ff2-1879-47a0-814f-4b471f5dadfb
- **ログパス**: `C:\Users\dzbk\.gemini\antigravity\brain\d3f99ff2-1879-47a0-814f-4b471f5dadfb\.system_generated\logs\transcript.jsonl`
