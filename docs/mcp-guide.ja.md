# Claude に装備更新を相談する：MCP サーバー

[English](mcp-guide.md)

ROラトリオ Branch には [MCP](https://modelcontextprotocol.io/) サーバーがあります。お使いのパソコンで動く小さなプログラムで、Claude が ROラトリオHUB のエンジンでダメージを計算できるようになります。ビルドを貼り付けて「どの肩装備が一番火力が上がる？」のように普通の言葉で聞くと、Claude が計算し、良い候補をアプリの比較ツリーの枝として開くリンクを返します。

非公式・非営利のファンメイドツールです。ROラトリオHUB のエンジンをお借りしていますが、ROラトリオHUB の一部ではありません。ご質問は[このリポジトリの Issues](https://github.com/daividssilverio/ro-ratorio-branch/issues) へお願いします。

## 必要なもの

- [Git](https://git-scm.com/)
- [mise](https://mise.jdx.dev/getting-started.html)（必要な Node.js と pnpm を自動で入れてくれます）
- [Claude Code](https://code.claude.com/docs/ja/overview)、または MCP サーバーを使える他のアプリ

## 準備（最初の一回だけ）

```bash
git clone --recurse-submodules https://github.com/daividssilverio/ro-ratorio-branch.git
cd ro-ratorio-branch
mise trust
mise install
mise exec -- pnpm install
```

次に Claude Code に登録します。パスはクローンした場所に置き換えてください。

```bash
claude mcp add --scope user ro-ratorio-branch -- mise -C /path/to/ro-ratorio-branch exec -- pnpm --silent rocalc-mcp
```

`claude mcp list` で `ro-ratorio-branch` が connected と表示されれば完了です。

### 他のアプリ（Claude Desktop など）

アプリの MCP 設定にサーバーを追加します。Claude Desktop の場合は `claude_desktop_config.json`（Settings → Developer → Edit Config）です。デスクトップから起動したアプリはターミナルと同じプログラムを見つけられないことが多いので、mise はフルパスで書いてください（macOS・Linux は `which mise`、Windows は `where mise` で分かります）。

```json
{
  "mcpServers": {
    "ro-ratorio-branch": {
      "command": "/full/path/to/mise",
      "args": ["-C", "/path/to/ro-ratorio-branch", "exec", "--", "pnpm", "--silent", "rocalc-mcp"]
    }
  }
}
```

保存したらアプリを再起動してください。

## 使い方

1. キャラクターをテキストで用意します。ROラトリオHUB のセーブ URL か、アプリの共有画面のリンクまたはビルドコードです。
2. Claude に貼り付けて質問します。日本語でも英語でも大丈夫です。
   - 「このビルドで一番火力が上がる肩装備は？ <URL>」
   - 「鎧の3番目のエンチャントをランキングして。詠唱妨害不可がつくものだけ」
   - 「安全に精錬できるのは +4 まで。+7 も試して」
   - 「この露店の出品を比較に入れて：<公式ツールからコピーした出品>」
   - 「このツリーの branch-3 から、一番いい靴は？ <アプリのリンク>」
3. Claude が返したリンクを開きます。アプリで「現在のツリーに子ノードとして追加」を選ぶと、開いているツリーに結果が加わります。

ご注意：

- スクリーンショットではなくテキストを貼ってください。ゲームの画像は AI ツールに渡さないでください。
- ダメージはビルドで設定したモンスターに対する秒間ダメージです。相場はサーバーには分からないので、価格の判断はご自身でお願いします。
- 候補はカードなしで、入れ替える装備の精錬値のまま比べます。エンチャントは1スロットずつランキングします。
- 計算はすべてお使いのパソコンで行われます。Claude に送られるのは、貼り付けた内容と Claude の回答だけです。

## 更新

```bash
cd /path/to/ro-ratorio-branch
git pull --recurse-submodules
mise install
mise exec -- pnpm install
```

ツールの一覧は [README](../README.md#for-agents)（英語）にあります。
