# Proposal: apply model buffs regardless of panel state

Status: not submitted. Verified on upstream `6cfd20f`. Target branch: `dev`.

## Problem

Headless, four model arrays are silently ignored: `passiveSkill`, `buff4`, `buff7` and `buff8`. `HydrateFromModel()` copies each one only when its buff panel is open on the page:

| Model field | Guard | Where |
| --- | --- | --- |
| `passiveSkill` | `n_Skill1SW` | `engine/status/stallcalc-hydrate.js:763` |
| `buff4` | `n_Skill4SW` | `engine/status/stallcalc-hydrate.js:771` |
| `buff7` | `n_Skill7SW` | `engine/status/stallcalc-hydrate.js:806` |
| `buff8` | `n_Skill8SW` | `engine/status/stallcalc-hydrate.js:812` |

The four flags start as `false` and are set by the panels' click handlers. The model leaves them out on purpose (see the header of `engine/runtime/calc-model.js`), which is right for a page but leaves a headless caller with no way to say "these values count".

## Reproduction

Meister, base level 200, job level 50, all six base stats 100, no equipment. Arms Cannon level 5 with a plain cannonball (`attackMethod.optionValueArray = [0]`) against monster 837 (魔神の使徒・シナイム). Madogear on (`passiveSkill`), Madogear License 5 (`learnedSkill`).

| Panel flag `n_Skill1SW` | ABR Dual Cannon in `passiveSkill` | Average damage per attack |
| --- | --- | --- |
| `false` (headless default) | off or on | 0 |
| `true` | off | 3,416 |
| `true` | on | 6,832 |

With the flag off, the Madogear and ABR Dual Cannon entries never reach `n_A_PassSkill`, so the skill deals nothing.

## Proposed change

One of:

- carry the four flags in the model (for example `model.buffPanelOpen = { jobSpecific, guild, item, other }`), filled by `ExtractModelFromDom()`; or
- have `calcFromModel()` treat the four arrays as authoritative and skip the guards on the headless path.

The exported setters `setN_Skill1SW`, `setN_Skill4SW`, `setN_Skill7SW` and `setN_Skill8SW` already exist, so a headless caller can work around this today.

## Workaround carried here

`openBuffPanels()` in `packages/core/src/engine-adapter/ratorio-engine.ts` calls the four setters once after loading the engine. It touches no upstream file. Remove it when either change lands.
