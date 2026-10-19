# ROラトリオ Branch

ラトリオ・ブランチ — based on [ROラトリオHUB](https://roratorio-hub.github.io/ratorio/).

A planner for Ragnarok Online Japan that answers one question: **which upgrade gives the most DPS, or the fastest kill, for the least zeny?** It runs the ROラトリオHUB damage engine unchanged and adds a way to compare upgrade paths side by side.

Fan-made and non-commercial.

## Status

The engine runs headless, builds and upgrade trees are JSON files, a command-line tool calculates them, and the web app has all five screens: Build, Tree, Ranking, Locker and Share.

| Part | State |
| --- | --- |
| Engine adapter, build format, `rocalc calc` | Working, checked against the upstream page |
| Upgrade tree, comparison, ranking, `rocalc compare` | Working |
| Web app: Tree, Compare and Ranking screens (phone-first, installable) | Working |
| Gear locker, build editor, loadouts, stored in the browser | Working, including random options, learned skills, self buffs, support buffs, timed effects, speed potion, weapon endow, ammunition and shadow gear |
| Parity with the original calculator | Everything a ROラトリオHUB save holds is carried, and the settings a save does not hold too, except a hand-entered monster (the engine's model has no place for it), the auto-spell "easy setup" button and automatic base level |
| Sharing: build codes, share links, JSON backup, ratorio save URLs in and out | Working, checked against the upstream page |
| Forgiving search (typos, kana, romaji, readings of kanji, English words, aliases) and search by effect with damage previews | Working |
| English menu, furigana, English names of game things | Working; English names are put together from a glossary and marked with a question mark until someone checks them |
| Extras: a link from a name to the official tool's search, pictures from an image pack you load yourself (the app ships none), build codes read from a gist | Working |
| `rocalc search` and the MCP server for agents: ten tools, from search and calculation to ranking the choices for a slot or a socket ([guide](docs/mcp-guide.md), [日本語](docs/mcp-guide.ja.md)) | Working |

## How accurate is it

The engine is upstream's, pinned to one commit and never modified. Nine reference builds (two Mechanics, an Arch Mage, a Summoner and five builds of a real Spirit Handler) are calculated from JSON build files and must match the numbers the upstream page shows, to the last digit. Those tests run on every change and on every upstream update.

## Try it

You need [mise](https://mise.jdx.dev/), which installs the pinned Node and pnpm.

```bash
git clone --recurse-submodules <this repository>
cd ro-ratorio-branch
mise install
mise exec -- pnpm install
mise exec -- pnpm --silent rocalc calc packages/core/src/build/golden-builds/mechanic-arms-cannon.build.json
```

The last command prints:

```json
{
  "targetMonsterId": 850,
  "averageDamagePerAttack": 911001,
  "averageDamagePerSecond": 6507149,
  "averageTimeToKill": { "seconds": 2.1, "attacks": 15 }
}
```

A failure is one JSON document on standard error. Exit code 1 means the build was rejected, 2 means wrong usage.

## Build files

A build file is one character and one scenario (the attack and its target). IDs are ROラトリオHUB's own numbers.

```json
{
    "formatVersion": 1,
    "character": {
        "jobId": 51,
        "baseLevel": 200,
        "jobLevel": 70,
        "baseStats": { "str": 110, "agi": 110, "vit": 100, "int": 100, "dex": 110, "luk": 78 },
        "learnedSkills": { "554": 5 },
        "equipment": {
            "rightHand": { "itemId": 4411, "refine": 9, "transcendence": 4, "sockets": [null, 659, 1381, 1297] }
        }
    },
    "scenario": { "skillId": 554, "skillLevel": 5, "skillOptions": [1], "targetMonsterId": 850 }
}
```

The full format is the JSON Schema in [`packages/core/schema/build.v1.schema.json`](packages/core/schema/build.v1.schema.json). Complete examples are in [`packages/core/src/build/golden-builds`](packages/core/src/build/golden-builds).

Not expressible yet: guild, food and miscellaneous buffs, shadow gear, auto-spell, costume, gear random options, arrows and weapon element.

## Upgrade trees

A tree file is a root character, one shared scenario and a list of nodes. Each node holds only its changes against its parent, plus an optional cost for that step.

```bash
mise exec -- pnpm --silent rocalc compare packages/core/src/tree/example-trees/mechanic-upgrades.tree.json
```

The result lists every node with its damage, its gain over the root, what differs from its parent, its cumulative cost, and four rankings: damage gain, time to kill, cost, and damage gain per million zeny.

- A change to a gear piece names the item it was made for. If that slot later holds another item, the node is reported as **stale** and left out of the rankings; it is never silently applied to the new item.
- A path with an unpriced step has no cumulative cost and ranks last for cost and value for money.
- Gains along a path are measured step by step and depend on the order, because bonuses multiply.

The format is in [`packages/core/schema/tree.v1.schema.json`](packages/core/schema/tree.v1.schema.json), with an example in [`packages/core/src/tree/example-trees`](packages/core/src/tree/example-trees).

## Finding IDs

Build files name items, cards, monsters and skills by ROラトリオHUB's own numbers. `rocalc search` finds them the way the app's search boxes do: by part of the name, its reading, romaji, English words, an alias or a typing mistake.

```bash
mise exec -- pnpm --silent rocalc search sensha --kind cardOrEnchant --limit 2
```

## For agents

To set it up and ask Claude for upgrades, follow the guide: [English](docs/mcp-guide.md), [日本語](docs/mcp-guide.ja.md).

`packages/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io/) server over standard input and output. It keeps nothing between calls: the agent holds its builds and trees as JSON in the formats above, and every tool takes the document it works on.

| Tool | What it does |
| --- | --- |
| `search` | Finds names and their ratorio IDs, like `rocalc search` |
| `calc` | Calculates one build, like `rocalc calc` |
| `apply_change` | Adds an upgrade step to a tree as a node and says what it does |
| `import_build` | Reads a ROラトリオHUB save URL, an app link or build code, a build or tree file, or the app's JSON backup |
| `export_build` | Gives a build or tree as a link that opens it in the app, a build code, and for a build a ROラトリオHUB save URL |
| `rank_slot_candidates` | Ranks every item the job can wear in one slot by the damage per second it gives, optionally by name or effect, with a link that opens the best as branches in the app |
| `rank_socket_choices` | The same for one socket of the piece worn in a slot: every card or enchant it takes, optionally only those with an effect you need (詠唱妨害不可, 石化 resistance…) |
| `read_listing` | Reads a market listing copied from the official tool as a gear piece, and puts it into the comparison as a branch with the damage before and after |
| `compare_nodes` | Says what differs between two builds of a tree: gear, stats, bonuses, damage |
| `rank_leaves` | Ranks the finished upgrade paths by damage gain, kill time, cost or value for money |

Start it with `mise exec -- pnpm --silent rocalc-mcp` from the repository. To register it with Claude Code for every folder (`mise -C` takes the Node version of this repository wherever the server is started):

```bash
claude mcp add --scope user ro-ratorio-branch -- mise -C <path to this repository> exec -- pnpm --silent rocalc-mcp
```

A typical use: paste the ROラトリオHUB save URL or the app's build code of a character and ask which garment gives the most damage. The agent reads it with `import_build`, ranks the garments with `rank_slot_candidates`, and gives back a link that opens the best ones in the app as branches of a tree. Candidates come without cards and keep the refine of the piece they replace, so the gains are measured against the current piece without its cards too. Sockets go one at a time: rank one, put the chosen enchant into the build, then rank the next, which takes in what the others hold. The prices are yours to weigh.

Both ranking tools can start from a node of a tree instead of a build: share the tree from the app, say which node ("starting from branch-3"; the node panel shows each node's ID), and the branches come back under that node. Opened in the app with 現在のツリーに子ノードとして追加, they join the tree you have open. `rank_slot_candidates` can also try the best items at other refines (`refineLevels`, for example +7 and +9) and at the levels where their own effects start (「精錬値が6以上の時」), as child branches of each item; `highestRefine` keeps to what you can reach, such as the safe +4. `rank_socket_choices` with `emptyOtherSockets` ranks on the piece without any enchants yet.

## Web app

```bash
mise exec -- pnpm web
```

This opens the app on a local address. The first time, it starts with a novice wearing a コットンシャツ and a ナイフ, both in the locker; make your own character from there. Everything you change is stored in the browser.

- **Build** edits the character a tree starts from: levels, stats, the piece in each slot, learned skills and buffs, the attack and the target. The result updates as you type. A gear set or a stat allocation can be saved as a loadout, put back on later, or added to the tree as a branch to compare it.
- **Locker** holds every gear piece once, owned or only considered, with its refine, cards, random options, price and note. A character and a tree node point at a piece, so editing it changes it everywhere, and the locker warns when a job may not wear something.
- **Share** exports the open tree as a short build code or a link, a single build as a ROラトリオHUB save URL, and everything as a JSON backup. A build code can be handed to a new gist, and the address of a gist can be pasted to import what it holds. It imports all of those from a paste or a dropped file, showing what it found before anything changes.

To compare an upgrade, press "＋ 分岐" on the Build screen (or "分岐を作る" under the tree): a node is added that changes nothing yet, and the build editor opens on it. What you change there (gear, cards, refine, stats, buffs) is what the node holds, and the damage shows against what it builds on as you go. The mini tree at the top of the Build screen lists every node on one line and switches the editor between them and the root. A node can be branched off again, renamed (double tap its line in the mini tree), removed, folded into the node it builds on ("… に統合"), and committed ("コミット"): its build becomes the root and the rest of the tree is counted from there. Committing never changes the pieces in your locker; ロッカーに反映 on a node, or the Locker screen, does that.

The import button in the Tree header still loads a tree file directly. The Tree screen lists every node with its gain over the root; selecting one opens the comparison (gear, stats, effect text, and the step-by-step path); the Ranking screen orders the end points by damage gain, kill time, value for money or cost, and lets you enter a missing cost.

The layout adapts: bottom tabs and a Compare sheet on a phone; top navigation, tables and Compare beside the tree on a wider screen.

Gear seen on the market can be pasted in as text ("出品テキストを貼り付けて入力"): the item with its refine on the first line, then its cards and random options, one per line, in the game's own wording.

Changes can be taken back and made again with the two arrows at the top right, or Ctrl/⌘+Z and Shift+Ctrl/⌘+Z: the last 50 of the visit.

`mise exec -- pnpm web:build` writes a static site to `packages/web/dist` that works from any folder of a static host and installs as an offline app.

## Repository

| Path | What |
| --- | --- |
| `vendor/ratorio` | The upstream engine as a git submodule, read-only |
| `packages/core` | Engine adapter, build and tree formats, converter, tree evaluation, diffs, ranking |
| `packages/cli` | `rocalc` |
| `packages/mcp` | The MCP server, `rocalc-mcp` |
| `packages/web` | The web app (React, Vite) |
| `docs/diagrams` | How the pieces fit, as Mermaid diagrams |
| `docs/upstream` | Changes proposed to upstream, with the workaround carried here |
| `docs/upstream-bump.md` | How to move to a newer upstream commit |

## Development

```bash
mise exec -- pnpm test
mise exec -- pnpm typecheck
```

Git hooks in `.githooks` check each commit for personal details (paths, user names, e-mail addresses, secrets). `pnpm install` enables them.

## Lineage and thanks

ROラトリオ → [ROラトリオ避難所](https://roratorio-hinanjo.net/roro/main/main.html) → [ROラトリオHUB](https://github.com/roratorio-hub/ratorio) → ROラトリオ Branch.

All damage calculation here is the work of the people behind those three projects. This project adds tooling around their engine and does not replace it.

## License and rights

ROラトリオ Branch は、ROラトリオHUB のダメージ計算をそのまま使って、「どの装備更新が、いちばん少ない費用で、いちばん効果があるか」を枝分かれで比べるための補助ツールです。計算はすべて ROラトリオHUB（そしてその前身の ROラトリオ、ROラトリオ避難所）と、データを提供された有志の方々の成果で、本ツールは比較と装備管理の部分だけを付け加えています。計算結果は ROラトリオHUB で開いて確かめることができます。ROラトリオHUB 公式のものではありません。本ツールについてのお問い合わせは、ROラトリオHUB の開発者様ではなく、[このリポジトリの Issues](https://github.com/daividssilverio/ro-ratorio-branch/issues) へお願いいたします。

ROラトリオ Branch is a helper built on ROラトリオHUB's damage calculation, used unchanged. The calculation is the work of ROラトリオHUB, its predecessors ROラトリオ and ROラトリオ避難所, and the volunteers who provided data; this tool adds the comparison and gear management. It is not part of ROラトリオHUB: please send questions about it to this repository's issues, not to ROラトリオHUB's developers. ROラトリオHUB's maintainers were asked before publication and welcomed it, name included.

The code is under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0), inherited from ROラトリオHUB (Copyright (c) 2023 usachoco). [`LICENSE`](LICENSE) (Japanese: [`LICENSE_jp`](LICENSE_jp)) carries this project's copyright and, unchanged, ROラトリオHUB's required notice: its credits to ROラトリオ, ROラトリオ避難所 and the volunteers who provided data, and the Ragnarok Online rights text. Personal and other non-commercial use only. The web app ships the same file as `LICENSE.txt` and links it from every screen. It also bundles IBM Plex Sans, IBM Plex Mono and Noto Sans JP, under the SIL Open Font License 1.1; their licences ship as `FONT-LICENSES.txt`.

Ragnarok Online is the property of its owners. This project follows GungHo's [guideline for the use of copyrighted works](https://ragnarokonline.gungho.jp/support/play-manner/copyright.html): it is non-commercial, and it contains and fetches no game images, sprites or client files.

© Gravity Co., Ltd. & Lee MyoungJin(studio DTDS). All rights reserved.
© GungHo Online Entertainment, Inc. All Rights Reserved.
当コンテンツの再利用（再転載・配布など）は、禁止しています。
