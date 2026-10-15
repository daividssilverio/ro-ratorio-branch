# Proposal: carry gear random options in the calc model

Status: not submitted. Verified on upstream `6cfd20f`. Target branch: `dev`.

## Problem

The calc model carries random options for shadow gear (`shadowEquip.rndOpt`) but not for the eleven regular equipment regions. For those, the engine reads `g_equipRndOptTable` (`engine/equip/rndopttype.h.js`) through `GetRndOptValue()` (`engine/equip/hmrndopt.js`), and only the page's controls write that table. A headless caller has no model field for them, and because nothing in `calcFromModel()` clears the table, whatever an earlier calculation left in it is counted again.

## What a headless caller does today

Before every `calcFromModel()` it calls `SetEquipRndOptTable(regionId, position, optionId, value)` for all `RND_OPT_SLOT_COUNT` positions of all eleven regular regions, writing `0, 0` where a piece has no option. With that, an ATK option on a weapon raises Arms Cannon damage as expected, a second piece with the same option adds to it, and a following calculation without options returns the earlier number exactly.

## Proposed change

Give the model the field shadow gear already has, and hydrate it the same way:

```js
// calc-model.js, in createEmptyModel()
/** 装備部位ごとに [[rndOptId, rndOptValue], ...] の配列（EQUIP_REGION_ID_* で添字アクセス） */
equipRndOpt: [],
```

```js
// stallcalc-hydrate.js, in HydrateFromModel()
for (let eqpRgnId = 0; eqpRgnId < EQUIP_REGION_ID_COUNT; eqpRgnId++) {
    const rndOptInfoArray = model.equipRndOpt[eqpRgnId] ?? [];
    for (let idx = 0; idx < RND_OPT_SLOT_COUNT; idx++) {
        const [rndOptId, rndOptValue] = rndOptInfoArray[idx] ?? [0, 0];
        SetEquipRndOptTable(eqpRgnId, idx, rndOptId, rndOptValue);
    }
}
```

Writing every position, also the empty ones, is what makes the model the whole input. `ExtractModelFromDom()` would fill the field from `GetEquipRndOptTableKind()` / `GetEquipRndOptTableValue()`.

## What this removes on our side

`writeRandomOptions()` in `packages/core/src/engine-adapter/ratorio-engine.ts`, and the third argument of `calculateBattleResult()`.
