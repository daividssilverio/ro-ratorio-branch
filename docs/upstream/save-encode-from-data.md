# Proposal: decode a save into the plain save model

Status: not submitted. Verified on upstream `6cfd20f`. Target branch: `dev`.

## What upstream already has

Writing a save from data needs no page: `createEmptySaveModel()` (`engine/savedata/save-model.js`) is a plain model of everything a save holds, and `buildSaveDataUnits(model)` (`engine/savedata/savedata-collect.js`) builds every unit from it without reading a control or a global. Our writer fills that model and encodes the units it gets back, in ascending type order, as `CSaveDataManager.encodeToURL()` does after its own `doCompaction()`.

An earlier version of this file asked for exactly that and described a workaround (filling each unit class by hand); the workaround is gone.

## Problem

The other direction has no plain form. `CSaveDataManager.parseDataText()` decodes the units, and `encodeToJSON()` gives each unit's properties, but turning those into the save model is done only by the private `#applyDataToControls*()` methods, which write straight into the page's globals and controls.

A headless reader therefore repeats three pieces of that logic:

1. **Runs of numbers with their own sign** (`#applyDataToControlsConfig`): walk the unit class's `propNames` after the control flag, take one flag bit per property, and apply a `…Sign` property to the value that follows it. Used by the customisation units and `MOB_CONF_PLAYER2`.
2. **Customisation slots**: apply `applyMigArrayToConf()` with each of the seven mapping tables of `conf-mig-mapping.js`, in the order `applyDataToControls()` does.
3. **Gear**: follow the regions units to the `EQUIPABLE` units by definition ID.

## Proposed change

A function that is to loading what `buildSaveDataUnits()` is to saving:

```js
/** @returns {object} a model shaped like createEmptySaveModel(), filled from decoded units */
export function saveModelFromUnits(saveDataUnitArray) { … }
```

`CSaveDataManager.applyDataToControls()` would then be "decode to the model, apply the model to the page", and `toCalcModel(saveModel)` (`engine/runtime/save-to-calc-model.js`) would work on a save URL without a page.

## What this removes on our side

`packages/core/src/engine-adapter/ratorio-save.ts` could drop `configValuesOf()`, `customizationValuesOf()` and its walk from regions to gear units, and read the model's fields instead.
