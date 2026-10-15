# Proposal: assign support-buff slot IDs without the page

Status: not submitted. Verified on upstream `6cfd20f`. Target branch: `dev`.

## Problem

Headless, `calcFromModel()` returns `NaN` for almost every status value, whatever the model contains. With a fully filled model, `charaData` holds 28 `NaN` entries (status ATK, MaxHP, MaxSP, HIT, FLEE, CRI, MATK, ...), and DPS and cast time are `NaN`.

Upstream's headless test (`tests/engine/calc-headless-node.test.ts`) only asserts that the call does not throw, so it passes.

## Root cause

The slot numbers `CCharaConfIchizi.CONF_ID_*` are assigned inside `InitData()`, which runs from the constructor (`engine/chara/CCharaConfIchizi.js:24-199`). The same holds for `CCharaConfNizi`, `CCharaConfSanzi`, `CCharaConfYozi` and `CCharaConfDebuff`.

Only the page constructs them (`engine/status/stallcalc-shell.js:426-454`). `HydrateFromModel()` creates the five `CCharaConfCustom*` wrappers when they are missing (`engine/status/stallcalc-hydrate.js:841-853`) but not these five.

So headless, `CCharaConfIchizi.CONF_ID_BLESSING` is `undefined`, and the first use poisons the totals:

```js
// engine/status/stplus-calc.js:2332
wSPC_STR += g_confDataIchizi[CCharaConfIchizi.CONF_ID_BLESSING]; // += undefined → NaN
```

STR, INT, DEX and LUK become `NaN`, and everything derived from them follows.

## Proposed change

Either of these fixes it:

- **Smallest:** in `HydrateFromModel()`, give the five support-buff classes the same `ensureConfWrapper(...)` treatment the `CCharaConfCustom*` classes already get.
- **Cleaner:** assign the `CONF_ID_*` numbers when the module loads, so they do not depend on an instance existing.

Plus one assertion in the headless test that a minimal model with base stats returns finite numbers.

## Workaround carried here

`assignSupportBuffSlotIds()` in `packages/core/src/engine-adapter/ratorio-engine.ts` constructs one throwaway instance of each of the five classes after loading the engine. It touches no upstream file. Remove it when either fix lands.
