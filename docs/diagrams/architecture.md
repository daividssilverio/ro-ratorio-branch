# Architecture

One TypeScript core holds all logic. The web UI, CLI and MCP server are thin front doors, and only the engine adapter touches the ratorio engine.

```mermaid
flowchart LR
  Ratorio["ratorio engine<br/>vendor/ratorio, pinned"] --> Adapter

  subgraph Core["packages/core (TypeScript, no UI)"]
    Adapter["Engine adapter<br/>only module importing ratorio"]
    Tree["Build · tree · diff<br/>patches, stale nodes, ranking"]
    Schema["JSON Schema<br/>builds, trees, locker, build code"]
    Adapter --> Tree
    Tree --> Schema
  end

  TextIndex["scripts/build-text-index<br/>search keys, EN names, furigana"] --> Search["Search<br/>main thread or own worker"]

  Core --> Workers["Engine hosts<br/>one engine copy each<br/>(hidden frame today, Web Worker later)"] --> Web["packages/web<br/>PWA, phone-first, offline"]
  Search --> Web
  Core --> CLI["packages/cli<br/>rocalc"]
  Core --> MCP["packages/mcp<br/>MCP server"]
  Search --> CLI
  Search --> MCP
```

- **Why engine hosts in the browser:** the engine keeps module-level state and is not re-entrant, so each host holds its own engine copy and takes one build at a time through a calculator pool. A host is a hidden same-origin frame for now, because the engine needs a DOM while it loads and a Web Worker has none (`docs/upstream/dom-free-import.md`). Frames share the main thread, so branches do not recompute in parallel yet; outcomes are remembered per build, so an edit recalculates only the edited node and the nodes below it.
- **Why search is separate:** a tree recompute keeps the calculation workers busy; search on its own thread stays responsive while typing.
- **CLI and MCP** run in Node and call the core directly, behind the happy-dom globals shim.

## Tree evaluation

```mermaid
flowchart TB
  Root["Root build<br/>character + loadout"] --> Apply["Apply changes along the path"]
  Node["Node: change list"] --> Apply
  Apply --> Valid{"Every change<br/>still applies?"}
  Valid -- no --> Stale["Stale: shown, excluded from ranking"]
  Valid -- yes --> Model["Build → ratorio calc model"]
  Scenario["Scenario<br/>skill, level, target monster"] --> Model
  Model --> Calc["calcFromModel in a worker"] --> Result["DPS, kill time,<br/>stats and bonuses for diffs"]
```
