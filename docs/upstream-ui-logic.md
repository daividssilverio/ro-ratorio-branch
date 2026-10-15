# Where the original keeps data and rules inside its page code

ROラトリオHUB grew as one page: much of what a setting *is* (which choices it has, what they are called, who may use it) exists only in the code that builds the page's controls, not in a data table. This project keeps such knowledge as plain data or plain functions in `packages/core` (the view model), and the screens in `packages/web` only render it (the view). No upstream page code runs in the app, the CLI or the engine adapter.

This file is the list of those places. Each row says where the original has it, where we hold it, and how it is kept in step. The `upstream-ui-split` skill walks this list on every upstream bump.

## Held as extracted data

`packages/core/src/panels/upstream-panels.json` is written by `pnpm --filter @ro-ratorio-branch/core run panels`. The extractor (`packages/core/src/engine-adapter/panel-extraction/extract-upstream-panels.ts`) is a development tool: it lets the original's panel-building code run once against elements that are never shown and writes down the controls it creates. A test fails when the file no longer matches what the pinned upstream builds.

| What | In the original | In ours |
| --- | --- | --- |
| Own buffs of a job: range and labels of each | `engine/ui/BuffJobSpecificSelf.js`, `Click_PassSkillSW()`: a default range per skill, an on/off list, and some thirty special cases, a few of them per job | `selfBuffs` and `selfBuffsOfJob` in the JSON, read by `catalog.selfBuffsOfJob()` |
| Support buffs whose values are not levels (Adrenaline Rush: OFF / 通常AR / フルAR / スクロール) | `engine/chara/CCharaConf*.js`, `BuildUpSelectAreaSubForSpecial()` | `supportBuffChoices` in the JSON, merged into `catalog.supportBuffs()` |
| Guild skills, gospel and stat-swap boosts: label, heading, range and choices of each | The `TPL_BUFF_GUILD` template in `ro4/m/calcx.html`, filled by `Click_Skill4SW()` in `engine/ui/BuffGuildAndGospel.js` | `guildBuffs` in the JSON, offered through `catalog.positionalBuffs()` and checked by the build converter |
| Consumables and food | A literal table inside `Click_Skill7SW()` in `engine/ui/BuffItemAndFood.js` | `itemBuffs` in the JSON, the same way |
| Other settings (pet, manuals, party, adopted, login bonus) | The `TPL_BUFF_OTHER` template in `ro4/m/calcx.html`, filled by `Click_Skill8SW()` in `engine/ui/BuffOtherCategory.js` | `otherBuffs` in the JSON, the same way |
| The dropdowns of the performance customisation whose values are not plain numbers | `engine/chara/CCharaConfCustom*.js`, `BuildUpSelectAreaSubForSpecial()` | `customizationChoices` in the JSON, merged into `catalog.customizations()` |
| The dropdowns of the monster settings whose values are not plain numbers | `engine/monster/mobconfplayer.js`, `mobconfdebuf.js`, `mobconfbuf.js`: each builds its whole panel in one function | `targetSettingChoices` in the JSON, merged into `catalog.targetSettings()` |
| How far gear is refined (+10) and transcended (★4) | `ro4/m/calcx.html`: the options written into the refine and transcendence dropdowns | `gearLimits` in the JSON, checked by the build converter and used by the gear editor |

The original has no name or ID for the buffs of the last three panels: a buff is its position in the panel's list (`n_A_PassSkill4`, `n_A_PassSkill7`, `n_A_PassSkill8`), its controls are named after that position (`A7_Skill9`), and its saves store the list as it is. A build keys these buffs by the same position.

What the extraction leaves out or flattens:

- A control the page keeps switched off is not extracted (the quest experience setting of the other panel), so a build cannot set it either.
- One switch of the other panel has a second wording for the taekwon line (`BuffOtherCategory.js` writes it from the job); the data holds the wording every other job sees.
- The item panel's "add attack methods" switch adds the scroll skills to the attacks a character can use (see "The attacks of a character").
- Setting a character as adopted lowers the highest base stat (`GetStatusMax()`), which `catalog.limitsOfJob(jobId, isAdopted)` follows. The original also puts every base stat back to 1 at that moment; ours reports the stats that are now too high and leaves them for the user to lower.

## Held as rewritten rules

These are rules the original has only inside its page-building code: who is offered what. Each is rewritten as a plain function of the engine catalog, on top of tables and functions upstream does export. Nothing is extracted, so nothing can be compared automatically; instead `packages/core/src/engine-adapter/upstream-rules/upstream-rules.json` records a fingerprint of every upstream function a rule was rewritten from, and a test fails when one of them changes, naming the rule to re-read. The table is generated from that file by `pnpm --filter @ro-ratorio-branch/core run upstream-rules`.

<!-- rewritten-rules:start (generated from upstream-rules.json; do not edit by hand) -->
| What | In the original | In ours | Pinned by |
| --- | --- | --- | --- |
| Which gear a slot offers a job | `engine/equip/equip.js`, `RebuildArmsRightSelect()`<br>`engine/equip/equip.js`, `RebuildArmsLeftSelect()`<br>`engine/equip/equip.js`, `RebuildArmorsSelect()`<br>`engine/equip/CShadowEquipController.js`, `rebuildAll()` | `catalog.itemsForSlot()` | `engine-catalog.test.ts` |
| Which slots an item fits | `engine/equip/equip.js`, `RebuildArmorsSelect()`<br>`engine/equip/CShadowEquipController.js`, `rebuildAll()` | `catalog.slotsOfItem()` | `engine-catalog.test.ts` |
| Which jobs hold a weapon in the left hand, of which kinds, and next to which right-hand weapon | `engine/equip/equip.js`, `OnChangeArmsTypeRight()`<br>`engine/equip/equip.js`, `OnChangeArmsTypeLeft()` | `catalog.leftHandItemKindsOfJob()` | `left-hand.test.ts` |
| Which costumes a job is offered for its lower headgear | `engine/equip/hmcostume.js`, `BuildUpCostumeSlotsCostume()` | `catalog.costumesOfJob()` | `costume.test.ts` |
| The stat points a character has earned and spent | `engine/chara/hmjob.js`, `CalcStatusPoint()` | `catalog.statPointsOf()` | `engine-catalog.test.ts` |
| Which cards and enchants each socket of an item takes | `engine/equip/hmcard.js`, `RebuildCardSelect()`<br>`engine/equip/hmcard.js`, `BuildUpCardSlotsMIG()`<br>`engine/equip/CShadowEquipController.js`, `#changeShadowItem()` | `catalog.socketChoicesOfItem()` | `socket-choices.test.ts` |
| Which random options an item rolls at each position, and in which range | `engine/equip/hmrndopt.js`, `RebuildRndOptSelect()`<br>`engine/equip/hmrndopt.js`, `SetUpRndOptKind()`<br>`engine/equip/hmrndopt.js`, `SetUpRndOptValue()` | `catalog.randomOptionsOfItem()` | `random-options.test.ts` |
| Which ammunition a job is offered | `engine/equip/equip.js`, `OnChangeArmsTypeRight()` | `catalog.arrowsOfJob()` | `weapon-element-and-arrow.test.ts` |
| Level and stat limits of a job; trait stats for fourth jobs only | `engine/equip/equip.js`, `changeJobSettings()`<br>`engine/chara/hmjob.js`, `RebuildStatusSelect()` | `catalog.limitsOfJob()` | `engine-catalog.test.ts` |
| Which learned skills worn gear and cards do something more for | `engine/skill/learnedskill.js`, `IsLearnedSkillTarget()` | `catalog.learnedSkillsGearRewards()` | `engine-catalog.test.ts` |
<!-- rewritten-rules:end -->

A second check comes from the other side: `packages/core/src/sharing/saves-made-on-the-original.test.ts` takes every save listed in `savesMadeOnTheOriginal` and requires that the catalog would have offered every value in it. A save made on the page is proof the page offered it, so a rule that is too strict fails there. Adding a save from a job or a feature the others do not cover widens that check by one line.

Every other method of the catalog only reads a table or calls a function upstream exports; the same file lists them under `dataReaders`, and a test fails for a catalog method that is in neither list.

The socket rule leans on two things upstream exports, so only the deciding part is rewritten: `CardSortOBJ` (the card lists per kind of socket, as the page orders them) and `RebuildCardSelectSubCollectEnchListData()` (the enchants of one enchant list per socket, which touches no page). What is rewritten is who gets which: an item's own enchants take over the sockets they are made for; apart from those, armor takes a card in its first socket only, a weapon in all four, the lower headgear and shadow gear none; and two items take a card of their slot in the last socket. The original does not count an item's card slots, so neither does ours.

The left hand: `IsDualArmsJob()` is upstream's own answer to who wields two weapons. Which kinds each group gets is a literal dropdown in `OnChangeArmsTypeRight()` (daggers, one-handed swords and one-handed axes for the assassin line; daggers for the ninja jobs), and so is the right-hand kind that takes the left hand away (katar, fuuma shuriken). The original switches the shield off while a left-hand weapon kind is chosen; here the converter rejects the two together, and `wearLockerPiece()` takes one off when the other is put on.

Timed effects need no rule: `CTimeItemAreaComponentManager.RebuildControls()` fills each of its twenty rows from `ITEM_SP_TIME_OBJ_SORT`, the same list for every character, and a row does not look at the others, so one effect can be set several times (the engine counts them). The catalog reads that list, in its order. A few entries of `ITEM_SP_TIME_OBJ` are not in it; the converter rejects those as not offered.

Two literals of the limits builder are repeated in `engine-catalog.ts` because upstream exports no constant for them: trait stats appear from base level 200 (`lowestBaseLevelOfAFourthJob`) and go up to 120 (`highestTraitStat`).

## Settings upstream keeps as tables

The performance customisation (`CCharaConfCustom*`), the monster settings (`MobConf*OBJ`) and the auto-spells (`AutoSpellSkill`, `AUTO_SPELL_PROB_ARRAY`) are data tables with a label, a control kind and a range per row, like the support buff panels. The adapter reads them at load (`engine-adapter/named-settings.ts`, `auto-spells.ts`); only the labels of their special dropdowns need extracting. The "as player" table exports the values of two of its settings under the same prefix as the settings themselves; `settingSlotsOf()` tells them apart.

## The attacks of a character

Which attacks a character has is not a table: it follows from its job, from skills its gear and cards give it, from the item panel's scroll switch and from its auto-spells, and each attack has its own levels and options (a cannonball, a number of hits, a distance), some of which depend on the job or on learned skills. Upstream works all of that out in one function, `CAttackMethodAreaComponentManager.GetEffectiveAttackMethodDataArray()`, from engine state; it returns objects, not controls.

The adapter calls it after a calculation and turns the result into plain data (`engine-adapter/attack-methods.ts`): attacks with a source (`job`, `gear`, `autoSpell`), a list of levels, and the chain of options that follows. `calculateBuildInDetail()` checks the scenario's attack against it and fills in the defaults of options the scenario leaves out; `attackMethodsOfBuild()` gives the list to the editor. This is the one place where the adapter reads a list from a component manager at run time rather than from a table or an extracted file, because the list depends on what the character wears.

## An empty slot

The original never leaves an armor slot empty: it holds a stand-in item ("頭上段 装備なし" and its like, `ITEM_ID_NOEQUIP_*` in `engine/equip/item.dat.js`), and a weapon hand holds bare hands. Saves carry those stand-ins. Here an empty slot is simply absent from a build: the converter writes the stand-in into the model, the save importer drops it, and the catalog does not offer it (`calcModelLayout.emptyItemIdOfSlot`).

## Not carried yet

| What | In the original |
| --- | --- |
| The auto-spell "easy setup" button, which fills the auto-spell rows from what is worn | `engine/skill/calcautospell.js`, `OnClickEasySetUpAutoSpell()`: the equipped auto-spell lists plus a dozen item and card special cases |
| A hand-entered monster | `engine/monster/CMobConfInput.js`; the calc model has no field for it |
| Raising the base level automatically until the stats are paid for, and the optional cap that refuses a stat the points do not cover | `engine/chara/hmjob.js`, `CalcStatusPoint()`: ours shows the budget and leaves the level and the stats alone |

When one of these is taken on, it gets a row in one of the two tables above, and extracted data goes into `upstream-panels.json` through the extractor.
