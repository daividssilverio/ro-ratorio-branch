# Engine adapter

`packages/core/src/engine-adapter` is the only place that imports `vendor/ratorio`. Everything else sees `RatorioEngine`, `RatorioCalcModel`, `RatorioBattleResult` and `BattleSummary`.

```mermaid
sequenceDiagram
  participant Caller as Caller (test, later CLI / worker)
  participant Adapter as ratorio-engine.ts
  participant Globals as browser-globals.ts
  participant Engine as vendor/ratorio (calc-headless.js)

  Caller->>Adapter: loadRatorioEngine()
  Adapter->>Globals: installBrowserGlobals()
  Note over Globals: happy-dom Window → globalThis<br/>Node's own globals are kept
  Adapter->>Engine: dynamic import (after the globals exist)
  Engine-->>Adapter: calcFromModel, createEmptyModel, constants
  Adapter->>Engine: construct the five support-buff settings classes once
  Adapter->>Engine: set the four buff-panel flags to open
  Adapter-->>Caller: RatorioEngine (one per process)
  Caller->>Adapter: createBaselineCalcModel(jobId)
  Adapter-->>Caller: RatorioCalcModel with every scalar filled in
  Caller->>Adapter: calculateBattleResult(calcModel, targetMonsterId)
  Adapter->>Engine: write the monster selector's stored ID
  Adapter->>Engine: calcFromModel(model)
  Engine-->>Caller: CBattleCalcResultAll as RatorioBattleResult
  Caller->>Adapter: summarizeBattleResult(battleResult)
  Adapter-->>Caller: BattleSummary (numbers, or null time to kill)
```

- **Why the import is dynamic:** the engine reads `document` and friends while its modules load, so the globals must exist first. A static import would run before them.
- **Why one engine per process:** the engine keeps module-level state, and the module cache gives one copy anyway. The loader returns the same promise on every call.
- **Why the adapter reaches into engine state:** headless, the engine cannot pick a target monster, returns `NaN` until five settings classes have been constructed, and skips buff arrays while their panels count as closed. All three are worked around here and proposed upstream in `docs/upstream/`.
- **Why models start from a baseline:** upstream's empty model leaves its scalars undefined, and the engine then answers 0 or `NaN` without an error. The baseline is a naked level-1 character the engine can already calculate; callers only overwrite fields.
