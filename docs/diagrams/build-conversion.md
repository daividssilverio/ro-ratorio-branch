# From a build file to a result

A build file names things (slots, skill IDs, buff names). The engine wants positions in arrays. The converter is the only place that translates, and it asks the adapter where each named thing lives.

```mermaid
flowchart LR
  File["build.json<br/>character + scenario"] --> Parse["parseBuild<br/>shape and bounds"]
  Parse -- "InvalidBuildError<br/>path, kind, rule" --> Stop1["rejected"]
  Parse --> Build["Build (typed)"]
  Build --> Convert["convertBuildToCalcModel"]
  Layout["engine.calcModelLayout<br/>slot → position<br/>buff name → section + position"] --> Convert
  Baseline["engine.createBaselineCalcModel(jobId)"] --> Convert
  Convert -- "BuildConversionError<br/>unknown item, skill not for job, ..." --> Stop2["rejected"]
  Convert --> Model["RatorioCalcModel"]
  Build -- "scenario.targetMonsterId" --> Calc
  Model --> Calc["engine.calculateBattleResult"]
  Calc --> Summary["BattleSummary<br/>damage, DPS, time to kill"]
```

- **Two kinds of rejection.** `parseBuild` checks what can be known from the file alone. The converter checks what only the engine's data can answer, such as whether a job has a skill.
- **Why the layout comes from the adapter:** the positions are upstream constants, and only the adapter may read upstream. The converter never sees a raw position it did not get from the layout.

## How the golden builds prove it

```mermaid
flowchart LR
  Page["upstream page<br/>with a saved build"] -- "extract-reference-build.browser.js" --> Reference["*.reference.json<br/>the page's own calc model + shown numbers"]
  Reference -- "write-golden-build.ts<br/>(layout in reverse)" --> BuildFile["*.build.json"]
  BuildFile --> Converted["convertBuildToCalcModel"]
  Reference --> Expected["calcModelOfReferenceBuild"]
  Converted -- "must be equal" --- Expected
```

The build file is derived from the reference once; the test then converts it forward again and requires the page's exact model, and the page's damage and DPS.
