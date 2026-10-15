import {
    type GearPiece,
    type Build,
    addCharacterToWorkspace,
    addEmptyTreeToWorkspace,
    addLockerPiece,
    type BaseStatName,
    baseStatNames,
    type BuildConversionIssue,
    type EquipmentSlot,
    isAdopted,
    removeCharacter,
    replaceCharacter,
    replaceTreeScenario,
    type Scenario,
    shadowEquipmentSlots,
    type TraitStatName,
    traitStatNames,
    wearLockerPiece,
    type WorkspaceCharacter,
} from "@ro-ratorio-branch/core/platform-neutral";
import { Fragment, useMemo, useState } from "react";
import { attackEntriesOf, attackOfScenario, attackRowsOf, scenarioWithAttack, scenarioWithAttackRow } from "./attack-view-model.ts";
import { blankCharacter, type EquipmentRow, equipmentRowsOf } from "./build-editor-model.ts";
import { CommittedNumberField, CommittedTextField } from "./CommittedFields.tsx";
import { formatInteger, formatSeconds, formatSignedPercent } from "./format.ts";
import { GearPieceEditor } from "./GearPieceEditor.tsx";
import { ChevronDownIcon, ChevronRightIcon, PlusIcon, WarningIcon } from "./Icons.tsx";
import { itemNameIn, slotGlyphs, slotLabels, rootLabel } from "./labels.ts";
import { LoadoutsCard } from "./LoadoutsCard.tsx";
import { lockerPiecesForSlot } from "./locker-view-model.ts";
import { Overlay } from "./Overlay.tsx";
import { EntryPicker, Picker } from "./Picker.tsx";
import { RightsFooter } from "./RightsFooter.tsx";
import { countOfParts, setCountsOfTabs, settingsTabs } from "./settings-editor-model.ts";
import { TargetSettingsEditor } from "./TargetSettingsEditor.tsx";
import { SettingsEditor } from "./SettingsEditor.tsx";
import { useAttackMethods, useJobSettings, useSkillsGearRewards, useStatPoints, useWorkspaceGearData, type WorkspaceGearData } from "./use-engine-data.ts";
import { engineHost, type TreeWorkspace } from "./use-tree-workspace.ts";
import { t } from "./text/ui-text.ts";
import { EnglishName } from "./text/EnglishName.tsx";
import { GearListingDialog } from "./GearListingDialog.tsx";
import type { InexpressibleDifference } from "@ro-ratorio-branch/core/platform-neutral";
import type { ReactNode } from "react";
import { ConfirmedAction, NodeMergeButtons, RemoveNodeButton } from "./NodeActions.tsx";
import { Picture } from "../image-pack/Picture.tsx";
import { buildWearingItem } from "./damage-preview-model.ts";
import type { PickerPreview } from "./use-damage-previews.ts";

/** Used until the job's own limits have loaded. */
const widestLimits = { lowest: 0, highest: 999 };
const highestSkillLevel = 100;

type OpenPicker = "attackSkill" | "targetMonster" | "targetSettings" | "newCharacterJob" | "skillsAndBuffs";

/** The build editor: the open tree's root character, what it wears, and what it attacks. Every change recalculates the tree. */
/** The node of the tree an editor is open on, in place of the root. */
export interface EditedNode {
    readonly label: string;
    /** What the node builds on, as the tree names it. */
    readonly parentLabel: string;
    /** The damage per second of what the node builds on, when that is known. */
    readonly parentDamagePerSecond: number | null;
    /** What the last change tried to set that a node cannot hold. */
    readonly refused: readonly InexpressibleDifference[];
    /** How many nodes build on this one and would go with it. */
    readonly descendantCount: number;
    onRename(label: string): void;
    onRemove(): void;
    /** Whether the node builds directly on the root. */
    readonly buildsOnRoot: boolean;
    /** Folds the node into the node it builds on. */
    onFold(): void;
    /** Makes the node's build the root's. */
    onMakeRoot(): void;
}

interface BuildScreenProps {
    /** The workspace as the editor works on it: the stored one for the root, a view of one node otherwise. */
    readonly workspace: TreeWorkspace;
    readonly isWide: boolean;
    /** Shown first: the tree at a glance, to choose which build the editor shows. */
    readonly treeStrip?: ReactNode;
    /** Given when the editor is open on a node. What belongs to the root alone (its name, its levels, its loadouts, the other characters) is then left out. */
    readonly editedNode?: EditedNode;
}

/**
 * The build editor: a build of the open tree (its root, or one of its
 * nodes), what it wears, and what it attacks. Every change recalculates
 * the tree.
 */
export function BuildScreen({ workspace, isWide, treeStrip, editedNode }: BuildScreenProps) {
    const gearData = useWorkspaceGearData(workspace.workspace);
    const statPoints = useStatPoints(workspace.tree.root);
    const skillIdsGearRewards = useSkillsGearRewards(workspace.tree.root);
    const attackMethods = useAttackMethods(workspace.tree.root, workspace.tree.scenario.targetMonsterId);
    const jobSettings = useJobSettings(workspace.workspace.characters[workspace.workspace.trees[workspace.activeTreeId]?.characterId ?? ""]?.jobId ?? -1);
    const [expandedSlot, setExpandedSlot] = useState<EquipmentSlot | null>(null);
    const [slotBeingChosen, setSlotBeingChosen] = useState<EquipmentSlot | null>(null);
    const [openPicker, setOpenPicker] = useState<OpenPicker | null>(null);

    const { trees, characters } = workspace.workspace;
    const openTree = trees[workspace.activeTreeId];
    const characterId = openTree?.characterId ?? "";
    const character = characters[characterId];
    if (openTree === undefined || character === undefined) {
        return null;
    }
    const { descriptions } = gearData;
    const scenario = openTree.scenario;

    const updateScenario = (nextScenario: Scenario) => workspace.updateWorkspace(replaceTreeScenario(workspace.workspace, workspace.activeTreeId, nextScenario));
    const attackOfTheScenario = attackMethods === null ? undefined : attackOfScenario(attackMethods, scenario);
    const updateCharacter = (nextCharacter: WorkspaceCharacter) => workspace.updateWorkspace(replaceCharacter(workspace.workspace, characterId, nextCharacter));
    const traitStats = character.traitStats ?? { pow: 0, sta: 0, wis: 0, spl: 0, con: 0, crt: 0 };
    const limits = (isAdopted(character) ? jobSettings?.limitsWhenAdopted : jobSettings?.limits) ?? null;
    const hasTraitStats = limits === null || limits.traitStat !== null || character.traitStats !== undefined;

    const treeCountOfCharacter = Object.values(trees).filter((tree) => tree.characterId === characterId).length;
    const isOnlyCharacterWithTrees = Object.values(trees).every((tree) => tree.characterId === characterId);
    function removeOpenCharacter() {
        const removal = removeCharacter(workspace.workspace, characterId);
        const [treeToOpen] = Object.keys(removal.workspace.trees);
        if (treeToOpen !== undefined) {
            workspace.takeWorkspace(removal.workspace, treeToOpen);
        }
    }

    async function addCharacterOfJob(jobId: number, jobName: string) {
        const host = await engineHost();
        const [firstAttackSkill] = await host.listCatalog({ what: "attackSkillsOfJob", jobId });
        const { limits: limitsOfNewJob } = await host.listJobSettings(jobId);
        const addedCharacter = addCharacterToWorkspace(workspace.workspace, blankCharacter(jobId, limitsOfNewJob?.baseLevel.lowest ?? 1), jobName);
        const addedTree = addEmptyTreeToWorkspace(
            addedCharacter.workspace,
            addedCharacter.characterId,
            { skillId: firstAttackSkill?.id ?? scenario.skillId, skillLevel: 1, targetMonsterId: scenario.targetMonsterId },
            jobName,
        );
        workspace.takeWorkspace(addedTree.workspace, addedTree.treeId);
    }

    const treeSwitcher = (
        <div className="build-switcher">
            <label className="field-label">
                {t("ツリー")}
                <select className="text-field" value={workspace.activeTreeId} onChange={(event) => workspace.openTree(event.target.value)}>
                    {Object.entries(trees).map(([treeId, tree]) => (
                        <option key={treeId} value={treeId}>
                            {tree.name} · {characters[tree.characterId]?.name ?? tree.characterId}
                        </option>
                    ))}
                </select>
            </label>
            <button type="button" className="btn" onClick={() => setOpenPicker("newCharacterJob")}>
                <PlusIcon />
                {t("新しいキャラ")}
            </button>
        </div>
    );

    const characterCard = (
        <section className="card build-card">
            <div className="piece-head">
                <div className="ico large" aria-hidden="true">
                    職
                </div>
                <div className="piece-title">
                    <b>{descriptions.jobNames[character.jobId] ?? `job #${character.jobId}`}</b>
                    <span>{editedNode === undefined ? <>ROOT · {openTree.nodes.length} {t("ノードの基準")}</> : t("{0} からの分岐", editedNode.parentLabel)}</span>
                </div>
            </div>
            {editedNode === undefined ? (
                <>
                    <label className="field-label">
                        {t("キャラ名")}
                        <CommittedTextField value={character.name} ariaLabel={t("キャラ名")} onCommit={(name) => updateCharacter({ ...character, name })} />
                    </label>
                    <ConfirmedAction
                        key={characterId}
                        label={t("キャラを削除")}
                        explanation={t("{0} と、このキャラのツリー {1} 件を削除します。ロッカーの装備はそのまま残ります。「元に戻す」で戻せます。", character.name, treeCountOfCharacter)}
                        confirmLabel={t("削除する")}
                        testId="remove-character"
                        isDisabled={isOnlyCharacterWithTrees}
                        onConfirm={removeOpenCharacter}
                    />
                </>
            ) : (
                <>
                    <label className="field-label">
                        {t("ノード名")}
                        <CommittedTextField value={editedNode.label} ariaLabel={t("ノード名")} onCommit={(label) => label.trim() !== "" && editedNode.onRename(label.trim())} />
                    </label>
                    <div className="editor-hint num">
                        Base Lv {character.baseLevel} · Job Lv {character.jobLevel} · {t("レベルと衣装は ROOT で変えます")}
                    </div>
                    <RemoveNodeButton descendantCount={editedNode.descendantCount} onRemove={editedNode.onRemove} />
                    <NodeMergeButtons
                        parentNodeLabel={editedNode.buildsOnRoot ? null : editedNode.parentLabel}
                        rootLabel={rootLabel}
                        isStale={false}
                        onFold={editedNode.onFold}
                        onMakeRoot={editedNode.onMakeRoot}
                    />
                </>
            )}
            <div className="stat-grid two" hidden={editedNode !== undefined}>
                <label className="field-label">
                    Base Lv
                    <CommittedNumberField value={character.baseLevel} lowest={limits?.baseLevel.lowest ?? 1} highest={limits?.baseLevel.highest ?? widestLimits.highest} ariaLabel="Base Lv" onCommit={(baseLevel) => baseLevel !== null && updateCharacter({ ...character, baseLevel })} />
                </label>
                <label className="field-label">
                    Job Lv
                    <CommittedNumberField value={character.jobLevel} lowest={1} highest={limits?.jobLevel.highest ?? widestLimits.highest} ariaLabel="Job Lv" onCommit={(jobLevel) => jobLevel !== null && updateCharacter({ ...character, jobLevel })} />
                </label>
            </div>
            <span className="eyebrow">{t("基本ステータス")}</span>
            <div className="stat-grid">
                {baseStatNames.map((statName: BaseStatName) => (
                    <label key={statName} className="field-label stat-label">
                        {statName.toUpperCase()}
                        <CommittedNumberField
                            value={character.baseStats[statName]}
                            lowest={1}
                            highest={limits?.baseStat.highest ?? widestLimits.highest}
                            ariaLabel={statName.toUpperCase()}
                            onCommit={(value) => value !== null && updateCharacter({ ...character, baseStats: { ...character.baseStats, [statName]: value } })}
                        />
                    </label>
                ))}
            </div>
            {statPoints !== null && (
                <div className={`point-budget num${statPoints.earned < statPoints.spent ? " barred" : ""}`} data-testid="stat-points">
                    {t("ステータスポイント 残り")} {formatInteger(statPoints.earned - statPoints.spent)} <small>/ {formatInteger(statPoints.earned)}</small>
                </div>
            )}
            {hasTraitStats && (
                <>
                <span className="eyebrow">{t("特性ステータス")}</span>
                <div className="stat-grid">
                    {traitStatNames.map((statName: TraitStatName) => (
                        <label key={statName} className="field-label stat-label">
                            {statName.toUpperCase()}
                            <CommittedNumberField
                                value={traitStats[statName]}
                                lowest={0}
                                highest={limits?.traitStat?.highest ?? widestLimits.highest}
                                ariaLabel={statName.toUpperCase()}
                                onCommit={(value) => value !== null && updateCharacter({ ...character, traitStats: { ...traitStats, [statName]: value } })}
                            />
                        </label>
                    ))}
                </div>
                {statPoints !== null && statPoints.traitEarned > 0 && (
                    <div className={`point-budget num${statPoints.traitEarned < statPoints.traitSpent ? " barred" : ""}`} data-testid="trait-points">
                        {t("特性ポイント 残り")} {formatInteger(statPoints.traitEarned - statPoints.traitSpent)} <small>/ {formatInteger(statPoints.traitEarned)}</small>
                    </div>
                )}
                </>
            )}
        </section>
    );

    const scenarioCard = (
        <section className="card build-card">
            <h2>
                {t("シナリオ")} <small>{t("攻撃と対象")}</small>
            </h2>
            <div className="scenario-row">
                <button type="button" className="choice" onClick={() => setOpenPicker("attackSkill")}>
                    <span className="eyebrow">{t("攻撃スキル")}</span>
                    <b>{attackOfTheScenario?.name ?? descriptions.skillNames[scenario.skillId] ?? `skill #${scenario.skillId}`}</b>
                    <EnglishName kind="skill" id={scenario.skillId} />
                </button>
                {attackOfTheScenario === undefined && (
                    <label className="field-label skill-level">
                        Lv
                        <CommittedNumberField
                            value={scenario.skillLevel}
                            lowest={1}
                            highest={highestSkillLevel}
                            ariaLabel={t("スキル Lv")}
                            onCommit={(skillLevel) => skillLevel !== null && updateScenario({ ...scenario, skillLevel })}
                        />
                    </label>
                )}
            </div>
            {attackOfTheScenario !== undefined && (
                <div className="attack-rows" data-testid="attack-rows">
                    {attackRowsOf(attackOfTheScenario, scenario).map((row) => {
                        const label = row.position === 0 ? t("スキル Lv") : row.label === "" ? t("オプション {0}", row.position) : row.label;
                        const setRow = (value: number) => updateScenario(scenarioWithAttackRow(scenario, attackOfTheScenario, row.position, value));
                        return (
                            <label key={row.position} className={`setting-row${row.isOffered ? "" : " barred"}`} data-attack-row={row.position}>
                                <span className="setting-name">{label}</span>
                                {row.optionList.choices === undefined ? (
                                    <span className="setting-value">
                                        <CommittedNumberField
                                            value={row.value}
                                            lowest={row.optionList.lowest ?? 0}
                                            {...(row.optionList.highest === undefined ? {} : { highest: row.optionList.highest })}
                                            ariaLabel={label}
                                            onCommit={(value) => value !== null && setRow(value)}
                                        />
                                    </span>
                                ) : (
                                    <select className="text-field setting-value labelled" aria-label={label} value={row.value} onChange={(event) => setRow(Number(event.target.value))}>
                                        {!row.isOffered && <option value={row.value}>{row.value}</option>}
                                        {row.optionList.choices.map((choice) => (
                                            <option key={choice.value} value={choice.value}>
                                                {choice.label}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </label>
                        );
                    })}
                </div>
            )}
            <button type="button" className="choice" onClick={() => setOpenPicker("targetMonster")}>
                <span className="eyebrow">{t("対象モンスター")}</span>
                <b>{descriptions.monsterNames[scenario.targetMonsterId] ?? `monster #${scenario.targetMonsterId}`}</b>
                <EnglishName kind="monster" id={scenario.targetMonsterId} />
            </button>
            <button type="button" className="btn target-settings" data-testid="open-target-settings" onClick={() => setOpenPicker("targetSettings")}>
                {t("モンスター設定")} <span className="num">{countOfParts(scenario.targetSettings)}</span>
            </button>
        </section>
    );

    const setCounts = setCountsOfTabs(character);
    // A skill the gear does something more for and the character has not learned is likely an oversight.
    const unlearnedRewardedSkillCount = (jobSettings?.learnableSkills ?? []).filter((skill) => skillIdsGearRewards.has(skill.id) && (character.learnedSkills?.[skill.id] ?? 0) === 0).length;

    const settingsCard = (
        <button type="button" className="card build-card settings-card" data-testid="open-settings" onClick={() => setOpenPicker("skillsAndBuffs")}>
            <span className="settings-card-title">
                <b>{t("スキル · 支援")}</b>
                <ChevronRightIcon size={16} />
            </span>
            <span className="piece-status num">
                {settingsTabs.map((tab) => `${tab.label} ${setCounts[tab.id]}`).join(" · ")}
            </span>
            {unlearnedRewardedSkillCount > 0 && (
                <span className="piece-status accented" data-testid="unlearned-rewarded-skills">
                    {t("装備効果に関わる未習得スキル {0} 件", unlearnedRewardedSkillCount)}
                </span>
            )}
        </button>
    );

    const equipmentCard = (
        <section className="card build-card equipment-card">
            <h2>
                {t("装備")} <small>Equipment</small>
            </h2>
            <div className="slot-rows">
                {equipmentRowsOf(workspace.workspace, characterId, jobSettings?.wieldsTwoWeapons ?? false).map((row) => (
                    <Fragment key={row.slot}>
                    {row.slot === shadowEquipmentSlots[0] && <div className="eyebrow slot-heading">{t("シャドウ装備")}</div>}
                    <SlotRow
                        row={row}
                        gearData={gearData}
                        isExpanded={expandedSlot === row.slot}
                        onToggle={() => (row.gearPieceId === null ? setSlotBeingChosen(row.slot) : setExpandedSlot(expandedSlot === row.slot ? null : row.slot))}
                    >
                        {row.gearPieceId !== null && (
                            <>
                                <div className="slot-actions">
                                    <button type="button" className="btn" onClick={() => setSlotBeingChosen(row.slot)}>
                                        {t("変更")}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn"
                                        onClick={() => {
                                            workspace.updateWorkspace(wearLockerPiece(workspace.workspace, characterId, row.slot, null));
                                            setExpandedSlot(null);
                                        }}
                                    >
                                        {t("外す")}
                                    </button>
                                </div>
                                <GearPieceEditor workspace={workspace} gearPieceId={row.gearPieceId} gearData={gearData} />
                            </>
                        )}
                    </SlotRow>
                    </Fragment>
                ))}
            </div>
        </section>
    );

    const overlays = (
        <>
            {slotBeingChosen !== null && (
                <SlotChooser
                    workspace={workspace}
                    gearData={gearData}
                    slot={slotBeingChosen}
                    jobId={character.jobId}
                    onClose={() => setSlotBeingChosen(null)}
                    onWear={(gearPieceId) => {
                        workspace.updateWorkspace(wearLockerPiece(workspace.workspace, characterId, slotBeingChosen, gearPieceId));
                        setExpandedSlot(slotBeingChosen);
                        setSlotBeingChosen(null);
                    }}
                    onWearNewItem={(itemId) => {
                        const added = addLockerPiece(workspace.workspace, { itemId, owned: true }, slotBeingChosen);
                        workspace.updateWorkspace(wearLockerPiece(added.workspace, characterId, slotBeingChosen, added.gearPieceId));
                        setExpandedSlot(slotBeingChosen);
                        setSlotBeingChosen(null);
                    }}
                    onWearListedPiece={(gearPiece) => {
                        // Something seen on the market is a candidate until it is bought.
                        const added = addLockerPiece(workspace.workspace, { ...gearPiece, owned: false }, slotBeingChosen);
                        workspace.updateWorkspace(wearLockerPiece(added.workspace, characterId, slotBeingChosen, added.gearPieceId));
                        setExpandedSlot(slotBeingChosen);
                        setSlotBeingChosen(null);
                    }}
                />
            )}
            {openPicker === "attackSkill" && (
                <EntryPicker
                    title={t("攻撃スキル")}
                    entries={attackMethods === null ? null : attackEntriesOf(attackMethods)}
                    textKind="skill"
                    hidesIds
                    onClose={() => setOpenPicker(null)}
                    onPick={(entry) => {
                        const pickedAttack = entry === null ? undefined : attackMethods?.[entry.id];
                        if (pickedAttack !== undefined && pickedAttack !== attackOfTheScenario) {
                            updateScenario(scenarioWithAttack(scenario, pickedAttack));
                        }
                        setOpenPicker(null);
                    }}
                />
            )}
            {openPicker === "targetMonster" && (
                <Picker
                    title={t("対象モンスター")}
                    list={{ what: "monsters" }}
                    onClose={() => setOpenPicker(null)}
                    onPick={(entry) => {
                        if (entry !== null) {
                            const { targetMonsterName: _previousName, ...scenarioWithoutName } = scenario;
                            workspace.updateWorkspace(replaceTreeScenario(workspace.workspace, workspace.activeTreeId, { ...scenarioWithoutName, targetMonsterId: entry.id }));
                        }
                        setOpenPicker(null);
                    }}
                />
            )}
            {openPicker === "targetSettings" && <TargetSettingsEditor scenario={scenario} jobSettings={jobSettings} onChange={updateScenario} onClose={() => setOpenPicker(null)} />}
            {openPicker === "skillsAndBuffs" && <SettingsEditor character={character} skillIdsGearRewards={skillIdsGearRewards} onChange={updateCharacter} onClose={() => setOpenPicker(null)} />}
            {openPicker === "newCharacterJob" && (
                <Picker
                    title={t("新しいキャラの職業")}
                    list={{ what: "jobs" }}
                    onClose={() => setOpenPicker(null)}
                    onPick={(entry) => {
                        setOpenPicker(null);
                        if (entry !== null) {
                            void addCharacterOfJob(entry.id, entry.name);
                        }
                    }}
                />
            )}
        </>
    );

    if (isWide) {
        return (
            <main className="wide-main build-main">
                <div className="build-column narrow">
                    <div className="build-sticky">
                        {treeStrip}
                        <RootResult workspace={workspace} editedNode={editedNode} />
                    </div>
                    {editedNode === undefined && treeSwitcher}
                    {characterCard}
                    {settingsCard}
                </div>
                <div className="build-column">{equipmentCard}</div>
                <div className="build-column narrow">
                    {scenarioCard}
                    {editedNode === undefined && <LoadoutsCard workspace={workspace} characterId={characterId} />}
                </div>
                {overlays}
            </main>
        );
    }
    return (
        <div className="screen">
            <header className="app-header">
                <h1 className="screen-title">
                    {t("ビルド")} <small>{editedNode?.label ?? character.name}</small>
                </h1>
            </header>
            <div className="scroll">
                <div className="build-stack">
                    <div className="build-sticky">
                        {treeStrip}
                        <RootResult workspace={workspace} editedNode={editedNode} />
                    </div>
                    {editedNode === undefined && treeSwitcher}
                    {characterCard}
                    {equipmentCard}
                    {settingsCard}
                    {scenarioCard}
                    {editedNode === undefined && <LoadoutsCard workspace={workspace} characterId={characterId} />}
                </div>
                <RightsFooter />
            </div>
            {overlays}
        </div>
    );
}

interface SlotRowProps {
    readonly row: EquipmentRow;
    readonly gearData: WorkspaceGearData;
    readonly isExpanded: boolean;
    onToggle(): void;
    readonly children: React.ReactNode;
}

function SlotRow({ row, gearData, isExpanded, onToggle, children }: SlotRowProps) {
    const { lockerPiece } = row;
    const filledSocketCount = (lockerPiece?.sockets ?? []).filter((cardOrEnchantId) => cardOrEnchantId !== null).length;
    return (
        <div className={`slot-block${isExpanded ? " expanded" : ""}`}>
            <button type="button" className="slot-row" aria-expanded={lockerPiece === null ? undefined : isExpanded} data-slot={row.slot} onClick={onToggle}>
                <span className="ico" aria-hidden="true">
                    {lockerPiece === null ? slotGlyphs[row.slot] : <Picture kind="item" id={lockerPiece.itemId} name={itemNameIn(gearData.descriptions, lockerPiece.itemId)} fallback={slotGlyphs[row.slot]} />}
                </span>
                <span className="lrow-name">
                    <span className="piece-status">{slotLabels[row.slot]}</span>
                    <b className={`piece-name${lockerPiece === null ? " none" : ""}`}>{lockerPiece === null ? t("— なし") : itemNameIn(gearData.descriptions, lockerPiece.itemId)}</b>
                    {lockerPiece !== null && <EnglishName kind="item" id={lockerPiece.itemId} />}
                </span>
                {lockerPiece !== null && (lockerPiece.refine ?? 0) > 0 && <b className="num">+{lockerPiece.refine}</b>}
                {filledSocketCount > 0 && <span className="mini num">{filledSocketCount} {t("枚")}</span>}
                {lockerPiece === null ? <PlusIcon size={16} /> : isExpanded ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
            </button>
            {isExpanded && <div className="slot-detail">{children}</div>}
        </div>
    );
}

interface SlotChooserProps {
    readonly workspace: TreeWorkspace;
    readonly gearData: WorkspaceGearData;
    readonly slot: EquipmentSlot;
    readonly jobId: number;
    onWear(gearPieceId: string): void;
    onWearNewItem(itemId: number): void;
    /** Wears a piece that was read from a pasted listing. */
    onWearListedPiece(gearPiece: GearPiece): void;
    onClose(): void;
}

/** Choose what goes into a slot: a piece from the locker, or a new item that is added to the locker first. */
function SlotChooser({ workspace, gearData, slot, jobId, onWear, onWearNewItem, onWearListedPiece, onClose }: SlotChooserProps) {
    const [isPickingNewItem, setIsPickingNewItem] = useState(false);
    const [isPastingListing, setIsPastingListing] = useState(false);
    const lockerRows = lockerPiecesForSlot(workspace.workspace, gearData.gearFacts, slot, jobId);
    const { root, scenario } = workspace.tree;
    const preview = useMemo((): PickerPreview => {
        const build: Build = { formatVersion: 1, character: root, scenario };
        // Item against item: the worn piece is compared without its cards too, since the new one comes without any.
        const wornItemId = root.equipment[slot]?.itemId;
        const baseline = wornItemId === undefined ? build : buildWearingItem(build, slot, wornItemId);
        return { baseline, withEntry: (itemId) => buildWearingItem(build, slot, itemId) };
    }, [root, scenario, slot]);

    // What is in the locker comes first among equal matches: owned pieces before candidates.
    const lockerPieces = workspace.workspace.gearPieces;
    const boostOfItem = useMemo(() => {
        const boostOfItemId = new Map<number, number>();
        for (const lockerPiece of Object.values(lockerPieces)) {
            boostOfItemId.set(lockerPiece.itemId, Math.max(boostOfItemId.get(lockerPiece.itemId) ?? 0, lockerPiece.owned ? 2 : 1));
        }
        return (entry: { readonly id: number }) => boostOfItemId.get(entry.id) ?? 0;
    }, [lockerPieces]);

    const pasteButton = (
        <button type="button" className="btn paste-listing" data-testid="paste-listing" onClick={() => setIsPastingListing(true)}>
            {t("出品テキストを貼り付けて入力")}
        </button>
    );
    if (isPastingListing) {
        return <GearListingDialog title={t("{0} · 出品テキストから", slotLabels[slot])} forSlot={slot} onClose={() => setIsPastingListing(false)} onApply={onWearListedPiece} />;
    }
    if (isPickingNewItem || lockerRows.length === 0) {
        return (
            <Picker
                title={t("{0} · アイテムを探す", slotLabels[slot])}
                aboveSearch={pasteButton}
                list={{ what: "itemsForSlot", slot, jobId }}
                preview={preview}
                boostOf={boostOfItem}
                onClose={onClose}
                onPick={(entry) => entry !== null && onWearNewItem(entry.id)}
            />
        );
    }
    return (
        <Overlay title={t("{0} · ロッカーから装備", slotLabels[slot])} onClose={onClose}>
            <ul className="picker-list">
                <li>
                    <button type="button" className="picker-row none" onClick={() => setIsPickingNewItem(true)}>
                        <span>{t("＋ 新しいアイテムを探す")}</span>
                    </button>
                </li>
                <li>
                    <button type="button" className="picker-row none" data-testid="paste-listing" onClick={() => setIsPastingListing(true)}>
                        <span>{t("＋ 出品テキストを貼り付けて入力")}</span>
                    </button>
                </li>
                {lockerRows.map((row) => (
                    <li key={row.gearPieceId}>
                        <button type="button" className="picker-row" onClick={() => onWear(row.gearPieceId)}>
                            <span>
                                {itemNameIn(gearData.descriptions, row.lockerPiece.itemId)}
                                {(row.lockerPiece.refine ?? 0) > 0 && <span className="num"> +{row.lockerPiece.refine}</span>}
                            </span>
                            <span className="picker-id">{row.lockerPiece.owned ? (row.usage.characterIds.length > 0 ? t("装備中") : t("所持")) : t("候補")}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </Overlay>
    );
}

/** The result of the build the editor is open on, so an edit shows what it did without leaving the editor. For a node, also against what it builds on. */
function RootResult({ workspace, editedNode }: { workspace: TreeWorkspace; editedNode: EditedNode | undefined }) {
    const root = workspace.comparison?.root ?? null;
    const difference =
        editedNode === undefined || editedNode.parentDamagePerSecond === null || root?.state !== "ready" ? null : root.battleSummary.averageDamagePerSecond - editedNode.parentDamagePerSecond;
    return (
        <aside className="card build-card root-result" data-testid="root-result" aria-live="polite">
            <span className="eyebrow">{editedNode === undefined ? t("ライブ結果 · ROOT") : t("ライブ結果 · {0}", editedNode.label)}</span>
            {root === null || workspace.isCalculating ? (
                <div className="root-pending">{t("計算中…")}</div>
            ) : root.state === "ready" ? (
                <>
                    <div className="root-dps num">
                        {formatInteger(root.battleSummary.averageDamagePerSecond)}
                        <small> /s</small>
                        {difference !== null && editedNode?.parentDamagePerSecond != null && (
                            <span className={`badge wide num ${difference > 0 ? "good" : difference < 0 ? "bad" : "flat"}`} title={t("{0} との差", editedNode.parentLabel)}>
                                {difference > 0 ? "▲ " : difference < 0 ? "▼ " : ""}
                                {formatSignedPercent(difference, editedNode.parentDamagePerSecond)}
                            </span>
                        )}
                    </div>
                    <div className="root-kill num">
                        {root.battleSummary.averageTimeToKill === null ? t("討伐不可") : t("討伐 {0} s", formatSeconds(root.battleSummary.averageTimeToKill.seconds))} {t("· 1 撃")}{" "}
                        {formatInteger(root.battleSummary.averageDamagePerAttack)}
                    </div>
                </>
            ) : (
                <div className="import-refusal" role="alert">
                    <div className="import-refusal-title">
                        <WarningIcon size={16} />
                        {t("このビルドは計算できません")}
                    </div>
                    <ul className="issue-list">
                        {root.issues.slice(0, 6).map((issue, issueIndex) => (
                            <li key={issueIndex}>{issueText(issue)}</li>
                        ))}
                    </ul>
                </div>
            )}
            {editedNode !== undefined && editedNode.refused.length > 0 && <div className="piece-status barred">{t("レベルと衣装は ROOT で変えます")}</div>}
            {workspace.engineFailure !== null && <div className="piece-status barred">{workspace.engineFailure}</div>}
        </aside>
    );
}

const issueLabels: Readonly<Record<BuildConversionIssue["kind"], string>> = {
    unknownJob: t("職業が見つかりません"),
    unknownItem: t("アイテムが見つかりません"),
    itemDoesNotFitSlot: t("この部位には装備できないアイテムです"),
    itemNotEquippableByJob: t("この職業は装備できません"),
    leftHandNotOfferedToJob: t("この職業は左手にその武器を持てません"),
    leftHandNotOfferedWithRightHand: t("右手の武器と左手武器は同時に装備できません"),
    shieldWithLeftHandWeapon: t("左手武器と盾は同時に装備できません"),
    unknownCardOrEnchant: t("カード / エンチャントが見つかりません"),
    cardOrEnchantNotOfferedForItem: t("このアイテムには付けられないカード / エンチャントです"),
    unknownRandomOption: t("ランダムオプションが見つかりません"),
    randomOptionNotOfferedForItem: t("このアイテムには付かないランダムオプションです"),
    randomOptionValueOutOfRange: t("ランダムオプションの値が範囲外です"),
    baseLevelOutOfRange: t("Base Lv がこの職業の範囲外です"),
    jobLevelOutOfRange: t("Job Lv がこの職業の範囲外です"),
    baseStatOutOfRange: t("基本ステータスがこの職業の範囲外です"),
    traitStatOutOfRange: t("特性ステータスがこの職業の範囲外です"),
    unknownTimedItem: t("時限効果が見つかりません"),
    timedItemNotOffered: t("選択できない時限効果です"),
    unknownSpeedPotion: t("速度ポーションが見つかりません"),
    unknownWeaponElement: t("武器属性が見つかりません"),
    unknownArrow: t("矢 / 弾が見つかりません"),
    refineNotSupported: t("この部位は精錬できません"),
    refineOutOfRange: t("精錬値が上限を超えています"),
    transcendenceOutOfRange: t("超越段階が上限を超えています"),
    transcendenceNotSupported: t("この部位は超越できません"),
    skillNotLearnableByJob: t("この職業は習得できないスキルです"),
    selfBuffNotAvailableForJob: t("この職業にはない自己支援です"),
    costumeNotOfferedToJob: t("この職業は装備できない衣装です"),
    unknownAutoSpell: t("オートスペルが見つかりません"),
    autoSpellChanceNotOffered: t("オートスペルの発動率が選択肢にありません"),
    unknownCustomization: t("性能カスタマイズに見つからない項目があります"),
    customizationValueNotOffered: t("性能カスタマイズの値が範囲外です"),
    unknownTargetSetting: t("モンスター設定に見つからない項目があります"),
    targetSettingValueNotOffered: t("モンスター設定の値が範囲外です"),
    unknownPanelBuff: t("ギルド / アイテム / その他の支援に見つからない項目があります"),
    panelBuffValueNotOffered: t("ギルド / アイテム / その他の支援の値が選択肢にありません"),
    unknownSupportBuff: t("支援が見つかりません"),
    attackNotOffered: t("このキャラはその攻撃スキルを使えません"),
    attackLevelNotOffered: t("攻撃スキルのレベルが範囲外です"),
    attackOptionNotOffered: t("攻撃スキルの設定値が選択肢にありません"),
    unknownTargetMonster: t("対象モンスターが見つかりません"),
};

function issueText(issue: BuildConversionIssue): string {
    const where = "slot" in issue ? `${slotLabels[issue.slot]}: ` : "";
    return `${where}${issueLabels[issue.kind]}`;
}
