# Proposal: count shadow gear random options without the page's panel

Status: not submitted. Verified on upstream `6cfd20f`. Target branch: `dev`.

## Problem

`HydrateFromModel()` takes shadow gear from `model.shadowEquip`: item IDs and refine go into `g_itemIdArray` / `g_refinedArray`, and random options into the same table regular gear uses (`SetEquipRndOptTable()`). The item effects are then applied by `engine/status/equipped-sp.js`, which reads `g_itemIdArray` directly.

The random options are not. `GetRndOptTotalValue()` (`engine/equip/hmrndopt.js`) adds the six shadow regions only inside `if (isShadowEquipAvailable())`, and that is true only after the page has called `registerShadowEquipController()` (`engine/equip/CShadowEquipControllerDataBridge.js`). Headless nothing registers, so a shadow piece's own effect counts and its random options silently do not.

## What a headless caller does today

It registers an object that stands in for the panel before the first calculation:

```js
registerShadowEquipController({ rebuildAll() {}, getEquippedID: () => 0, getRefined: () => 0, getRndOptInfoArray: () => [] });
```

With that, a flat ATK option on a shadow weapon raises a plain attack's damage, and a following calculation without it returns the earlier number.

## Proposed change

The gate protects nothing in the calculation: the table holds zeros for shadow regions that have no options. Drop the two `if (isShadowEquipAvailable())` conditions in `GetRndOptTotalValue()`, or replace them with a check on the data (`g_itemIdArray[eqpRgnId]`), so that what is counted depends on the model and not on whether a UI object exists.

## What this removes on our side

`standInForTheShadowGearPanel()` in `packages/core/src/engine-adapter/ratorio-engine.ts`.
