# Proposal: target monster in the calc model

Status: not submitted. Verified on upstream `6cfd20f`. Target branch: `dev`.

## Problem

`calcFromModel(model)` cannot choose its target. The model has no monster field; `StAllCalcCore()` reads the target from the page's monster selector (`engine/status/stallcalc.js:1398`, `CMonsterMapAreaComponentManager.GetMonsterId()`). Without the page, the selector holds its initial value, so every headless calculation runs against monster 1904 (Jガーディアン-P).

The selector's own setter does not work headless either:

```js
CMonsterMapAreaComponentManager.ChangeSelect(0, 0, 837, true);
// TypeError: Cannot read properties of undefined (reading '0')
//   at CCustomSelectMapMap.RebuildSelectDataSubDataFilter (engine/monster/CCustomSelectMapMap.js:103)
//   at CCustomSelectMapBase.RebuildSelectDataSub (engine/monster/CCustomSelectMapBase.js:60)
//   at CCustomSelectBase.ChangeSelectedDataId (engine/monster/CCustomSelectBase.js:216)
```

`ChangeSelectedDataId` rebuilds the category, map and monster `<select>` lists, and the category lookup at line 90 of `CCustomSelectMapMap.js` returns `undefined` when those lists were never built by `RebuildControls()`.

## Proposed change

Make the monster an explicit input, the same way `status.jobId` was promoted:

1. `engine/runtime/calc-model.js`: add `monsterId: undefined` to `createEmptyModel()`.
2. `engine/status/stallcalc-hydrate.js`: `ExtractModelFromDom()` sets `model.monsterId = CMonsterMapAreaComponentManager.GetMonsterId()`.
3. `engine/status/stallcalc.js`: `StAllCalcCore(speedPot, attackMethodConfArray, monsterId)` uses the argument instead of calling the selector.
4. `engine/runtime/calc-headless.js`: `calcFromModel` and `calcCoreFromModel` pass `model.monsterId`.
5. A headless test that two calls with different `monsterId` values return different `mobData`.

This sketch has not been run against upstream's test suite. Whether the field belongs at the top level or in a `monster` section (next to the `mobConf*` arrays) is the maintainers' call.

## Workaround carried here

`packages/core/src/engine-adapter/ratorio-engine.ts` writes `customSelectMonster.selectedDataId` directly before each calculation, after checking the ID against `MonsterObjNew`. It touches no upstream file. Remove it when the model field exists.
