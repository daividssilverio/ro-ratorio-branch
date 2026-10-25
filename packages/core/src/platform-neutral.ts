export type { Build, Character, Equipment, GearPiece, RandomOption, Scenario } from "./build/build-format.ts";
export { buildFormatVersion, buildJsonSchema } from "./build/build-format.ts";
export { attackMethodsOfBuild, calculateBuild, resolveAttack } from "./build/calculate-build.ts";
export { type AttackMethod, type AttackOptionChoice, type AttackOptionList, type AttackSource, chosenOptionsOf, isOfferedByOption, nextOptionAfter } from "./engine-adapter/attack-methods.ts";
export { BuildConversionError, type BuildConversionIssue, convertBuildToCalcModel, isAdopted, weaponElementOf, slotTakesRefine, slotTakesTranscendence } from "./build/convert-build.ts";
export { type BuildIssue, InvalidBuildError, parseBuild } from "./build/parse-build.ts";
export type { BaseStatName, EquipmentSlot, TraitStatName } from "./character-vocabulary.ts";
export type { BattleSummary, TimeToKill } from "./engine-adapter/battle-summary.ts";
export type { RatorioEngine } from "./engine-adapter/ratorio-engine.ts";
export { InvalidTreeError, parseTree, type TreeIssue } from "./tree/parse-tree.ts";
export type { Change, ChangeKind, Tree, TreeNode } from "./tree/tree-format.ts";
export { treeFormatVersion, treeJsonSchema } from "./tree/tree-format.ts";
export { applyChange, type ChangeApplication, type StaleReason } from "./tree/apply-change.ts";
export {
    type BuildCalculator,
    type BuildOutcome,
    buildOf,
    calculatorOn,
    outcomeOf,
    evaluateTree,
    type NodeEvaluation,
    type TreeEvaluation,
} from "./tree/evaluate-tree.ts";
export { type NodeResolution, resolveTree, type StaleChange } from "./tree/resolve-tree.ts";
export { type BuildCalculation, calculateBuildInDetail } from "./build/calculate-build.ts";
export type { EngineNames, ItemDescription } from "./engine-adapter/engine-names.ts";
export type { CatalogEntry, EngineCatalog, JobLimits, MonsterElementKind, MonsterInfo, MonsterRace, MonsterSize, SkillLevelSetting, StatPointBudget } from "./engine-adapter/engine-catalog.ts";
export type { SupportBuffSection, SupportBuffSetting } from "./engine-adapter/calc-model-layout.ts";
export { type AutoSpellValue, highestAutoSpellLevel } from "./engine-adapter/auto-spells.ts";
export { type CustomizationSection, customizationSections, isOfferedBySetting, type NamedSetting, type TargetSettingSection, targetSettingSections } from "./engine-adapter/named-settings.ts";
export type { PanelChoice, PositionalBuffPanel, PositionalBuffSetting } from "./panels/panel-definitions.ts";
export { positionalBuffPanels } from "./panels/panel-definitions.ts";
import { panelDefinitions } from "./panels/panel-definitions.ts";
/** How far the original lets gear be refined and transcended. */
export const gearLimits = panelDefinitions.gearLimits;
export type { StatSnapshot } from "./engine-adapter/stat-snapshot.ts";
export {
    type CharacterInputDiff,
    type CharacterSection,
    diffEvaluations,
    type EvaluationDiff,
    type GearSlotDiff,
    type NumberDiff,
} from "./tree/diff-evaluations.ts";
export type { ReadyNodeEvaluation } from "./tree/evaluate-tree.ts";
export { breakDownPath, type PathStep, pathToNode } from "./tree/path-breakdown.ts";
export { type RankedNode, type RankingMetric, rankingMetrics, rankNodes, type ValueForMoney } from "./tree/rank-nodes.ts";
export { compareTree, describeEvaluation, type NodeComparison, type TreeComparison } from "./tree/compare-tree.ts";
export { createCalculatorPool } from "./calculation/calculator-pool.ts";
export { canonicalJson, rememberOutcomes } from "./calculation/remember-outcomes.ts";
export { commitNodeToLocker, type CommitSkipReason, type LockerCommit } from "./workspace/commit-to-locker.ts";
export { InvalidWorkspaceError, parseWorkspace, type WorkspaceIssue } from "./workspace/parse-workspace.ts";
export { characterOf, gearPieceOf, treeOf, UnknownWorkspaceEntryError } from "./workspace/resolve-workspace.ts";
export type {
    EquipLockerPieceChange,
    LockerPiece,
    Workspace,
    WorkspaceChange,
    WorkspaceCharacter,
    WorkspaceTree,
    WorkspaceTreeNode,
} from "./workspace/workspace-format.ts";
export { workspaceFormatVersion, workspaceJsonSchema } from "./workspace/workspace-format.ts";
export { decodeShareCode, encodeShareCode, InvalidShareCodeError, type ShareCodeFlaw, type SharedContent } from "./sharing/share-code.ts";
export { publishedAppAddress, shareCodeInFragment, shareLinkOf } from "./sharing/share-link.ts";
export {
    type ImportRecognition,
    type ImportRefusal,
    type ImportSource,
    type RecognizedImport,
    recognizeImport,
    type SaveReadOutcome,
    saveReadingOn,
} from "./sharing/recognize-import.ts";
export { buildWearingItem, buildWithSocketFilled } from "./build/wear-item.ts";
export { type GraftedNodes, graftNodes } from "./tree/graft-nodes.ts";
export {
    type ChoiceRanking,
    type ChoiceRankingOptions,
    buildOfNode,
    type DamageOfBuild,
    NoPieceInSlotError,
    type RankedChoice,
    type RefineOption,
    refineLevelsStartingEffects,
    rankSlotCandidates,
    rankSocketChoices,
    type SlotChoice,
    type SlotRanking,
    type SlotRankingOptions,
    type SocketRanking,
    type SocketRankingOptions,
    UnusableNodeError,
    withRankingUnder,
} from "./agent/choice-ranking.ts";
export {
    addCharacterToWorkspace,
    addEmptyTreeToWorkspace,
    addTreeToWorkspace,
    type AddedCharacter,
    type AddedTree,
    emptyWorkspace,
    firstUnusedId,
} from "./workspace/add-to-workspace.ts";
export type { RatorioSaveContent, RatorioSaveReader, RatorioSaveWriter } from "./engine-adapter/ratorio-save.ts";
export { ratorioPageUrl } from "./engine-adapter/ratorio-save.ts";
export { exportRatorioSave, type NotExportedPart, type RatorioSaveExport } from "./sharing/export-ratorio-save.ts";
export { UnreadableRatorioSaveError, type UnreadableSaveFlaw } from "./engine-adapter/ratorio-save.ts";
export { importRatorioSave, type NotImportedPart, type RatorioSaveImport } from "./sharing/import-ratorio-save.ts";
export { changesBetween, type ChangesBetween, type InexpressibleDifference } from "./tree/changes-between.ts";
export {
    addLockerPiece,
    type AddedLockerPiece,
    type LockerPieceRemoval,
    type LockerPieceUsage,
    lockerPieceUsage,
    removeLockerPiece,
    replaceCharacter,
    replaceLockerPiece,
    replaceTreeScenario,
    removeTreeNode,
    removeCharacter,
    descendantCountOf,
    wearLockerPiece,
} from "./workspace/edit-workspace.ts";
export {
    equipmentSlots,
    baseStatNames,
    traitStatNames,
    socketsPerGearPiece,
    randomOptionsPerGearPiece,
    isShadowSlot,
    shadowEquipmentSlots,
    socketCountOfSlot,
} from "./character-vocabulary.ts";
export {
    addBranchToTree,
    type AddedBranch,
    applyGearLoadout,
    applyStatLoadout,
    gearLoadoutChanges,
    removeGearLoadout,
    removeStatLoadout,
    renameGearLoadout,
    renameStatLoadout,
    saveGearLoadout,
    type SavedLoadout,
    saveStatLoadout,
    statLoadoutChanges,
} from "./workspace/loadouts.ts";
export type { GearLoadout, StatLoadout } from "./workspace/workspace-format.ts";
export { forgivenEdits, type MatchedText, type MatchKind, matchKinds, prepareEntries, type PreparedEntry, type ReadingSegment, type SearchableEntry, searchEntries, type SearchHit, type SearchOptions, type SearchResult, type TermMatch } from "./search/forgiving-search.ts";
export { canonicalizeRomaji, foldText, hasKanaOrKanji, romanizeKana, toKatakana } from "./search/kana.ts";
export { type EnglishGlossary, type EnglishName, type EnglishPart, englishPartsOf } from "./text/english-names.ts";
export { type EffectHit, type EffectSearch, type PreparedEffects, prepareEffects, searchEffects } from "./search/effect-search.ts";
export { type TextKind, textKinds } from "./text/text-kinds.ts";
export { type ComparedSide, compareNodePair, type NodePairComparison, rankLeaves, withNode } from "./agent/tree-operations.ts";
export { type AddedNode, addEmptyTreeNode, type NodeEdit, type NodeEditStored, startNodeEdit, storeNodeEdit } from "./workspace/node-edit.ts";
export { foldNodeIntoParent, makeNodeTheRoot, type NodeFolded } from "./workspace/fold-node.ts";
export { type GearListing, type GearListingLine, type GearListingOptions, type ListingLineProblem, type ListingLineReading, readGearListing } from "./gear-listing/read-gear-listing.ts";
