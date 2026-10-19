# Asking Claude for upgrades: the MCP server

[日本語](mcp-guide.ja.md)

ROラトリオ Branch has an [MCP](https://modelcontextprotocol.io/) server: a small program on your computer that lets Claude calculate damage on the ROラトリオHUB engine. You paste a build and ask in plain words, for example which garment gives you the most damage. Claude runs the numbers and gives you back a link that opens the best choices in the app, as branches of an upgrade tree.

This is an unofficial, non-commercial fan-made tool. It borrows ROラトリオHUB's engine and is not part of ROラトリオHUB. Questions go to [this repository's issues](https://github.com/daividssilverio/ro-ratorio-branch/issues).

## What you need

- [Git](https://git-scm.com/)
- [mise](https://mise.jdx.dev/getting-started.html), which installs the right Node.js and pnpm for you
- [Claude Code](https://code.claude.com/docs/en/overview), or another app that can use MCP servers

## Set it up (once)

```bash
git clone --recurse-submodules https://github.com/daividssilverio/ro-ratorio-branch.git
cd ro-ratorio-branch
mise trust
mise install
mise exec -- pnpm install
```

Then register it with Claude Code. Replace the path with where you cloned it:

```bash
claude mcp add --scope user ro-ratorio-branch -- mise -C /path/to/ro-ratorio-branch exec -- pnpm --silent rocalc-mcp
```

Check it with `claude mcp list`: `ro-ratorio-branch` should say connected.

### Other apps (Claude Desktop and the like)

Add the server to the app's MCP settings. For Claude Desktop that is `claude_desktop_config.json` (Settings → Developer → Edit Config). Apps opened from the desktop often do not see the programs your terminal sees, so give the full path to mise (`which mise` on macOS and Linux, `where mise` on Windows):

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

Restart the app afterwards.

## Use it

1. Get your character as text: a ROラトリオHUB save URL, or from the app's Share screen, a link or a build code.
2. Paste it to Claude and ask. You can ask in English or Japanese:
   - "Which garment gives this build the most damage? <URL>"
   - "Rank the enchants for the third socket of my armor. Only ones that give uninterruptible casting."
   - "Same, but I can only refine to +4 safely. Also try +7."
   - "Put this listing into the comparison: <listing copied from the official tool>"
   - "Starting from branch-3 of this tree, which shoes are best? <app link>"
3. Open the link Claude gives you. In the app, 現在のツリーに子ノードとして追加 adds the results to the tree you already have open.

Things to know:

- Paste text, not screenshots. Game images are not to be given to AI tools.
- Damage is per second against the monster in your build. Prices are yours to weigh: the server does not know the market.
- Candidates come without cards and keep the refine of the piece they replace. Enchants are ranked one socket at a time.
- Everything is calculated on your computer. Only what you paste and Claude's answers go through Claude.

## Keep it up to date

```bash
cd /path/to/ro-ratorio-branch
git pull --recurse-submodules
mise install
mise exec -- pnpm install
```

The full list of tools is in the [README](../README.md#for-agents).
