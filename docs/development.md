# 初回リリース実装の開発手順

## 範囲

招待制ログイン、会社・部隊・共有先設定、案件の下書きと公開、項目別の閲覧制御、商材台帳、個別相談を実装しています。AIマッチングと集計ダッシュボードは初回リリースの対象外です。TypeSafe AI／Jevを将来導入する場合も、権限と公開可否は通常のコードで判定します。

## ローカル起動

Node.js 22.13.0以上とpnpm 11.25.0を使用します。

```bash
pnpm install --frozen-lockfile
pnpm build
```

新規ローカルD1には次の順番でマイグレーションを適用します。既存のプロトタイプDBには `0001` だけを適用してください。

```bash
pnpm exec wrangler d1 execute DB --config dist/server/wrangler.json --local --file drizzle/0000_sour_ricochet.sql --yes
pnpm exec wrangler d1 execute DB --config dist/server/wrangler.json --local --file drizzle/0001_charming_doctor_strange.sql --yes
```

`dist/server/.dev.vars` に24文字以上のランダムな `BOOTSTRAP_TOKEN` を設定します。このファイルはGit管理対象外です。

```text
BOOTSTRAP_TOKEN=<ランダムな秘密値>
```

```bash
pnpm start
```

最初の画面で全体管理者を作成します。作成後は `BOOTSTRAP_TOKEN` を削除してください。管理者は会社・部隊を登録し、招待リンクを作成します。招待メールの自動送信はありません。リンクは対象者に個別に渡します。有効期限は7日です。

## 検証

```bash
pnpm test
pnpm build
```

型検査は `pnpm exec tsc --noEmit`、変更箇所のlintは `pnpm exec oxlint app/page.tsx app/api/app/route.ts lib` で実行できます。リポジトリ全体のlintには、元からある未使用UI部品の指摘も含まれます。

## 本番へ移す前に

- 実際のD1に `0001` マイグレーションを適用し、バックアップと適用結果を確認する。
- 外部パートナーもアクセスできる設置先とURLを決める。現行のオーナー限定サイトは本番のアクセス方式に使えない。
- 強い初期設定トークンを安全に登録し、全体管理者の作成後に削除する。
- 3部隊・10人で、一覧の項目非表示、部隊別OFF、個別相談の撤回を受け入れ確認する。
