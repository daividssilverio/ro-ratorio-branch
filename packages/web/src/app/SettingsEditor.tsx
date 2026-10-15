import { type CatalogEntry, highestAutoSpellLevel, type WorkspaceCharacter } from "@ro-ratorio-branch/core/platform-neutral";
import { useEffect, useState } from "react";
import { CloseIcon, PlusIcon } from "./Icons.tsx";
import { Picker } from "./Picker.tsx";
import { useCatalogList } from "./use-engine-data.ts";
import { type JobSettings, noJobSettings } from "../engine-host/host-protocol.ts";
import { Overlay } from "./Overlay.tsx";
import { SettingRows } from "./SettingRows.tsx";
import { rowsOfTab, setCountsOfTabs, type SettingsTabId, settingsTabs, shownRowsOf, withAutoSpellAt, withAutoSpells } from "./settings-editor-model.ts";
import { engineHost } from "./use-tree-workspace.ts";
import { t } from "./text/ui-text.ts";

const timedItemLimit = 20;
const autoSpellLimit = 20;

interface SettingsEditorProps {
    readonly character: WorkspaceCharacter;
    /** The learned skills that what the character wears does something more for. They are marked in the list, as the original marks them. */
    readonly skillIdsGearRewards: ReadonlySet<number>;
    onChange(character: WorkspaceCharacter): void;
    onClose(): void;
}

/** Learned skills, the job's own buffs, support buffs and debuffs, consumables and the other settings of one character. */
export function SettingsEditor({ character, skillIdsGearRewards, onChange, onClose }: SettingsEditorProps) {
    const [jobSettings, setJobSettings] = useState<JobSettings | null>(null);
    const [openTabId, setOpenTabId] = useState<SettingsTabId>("learnedSkills");
    const openTab = settingsTabs.find((tab) => tab.id === openTabId) ?? settingsTabs[0];
    const [query, setQuery] = useState("");
    const [showsOnlySet, setShowsOnlySet] = useState(false);
    const [showsOnlyMarked, setShowsOnlyMarked] = useState(false);

    useEffect(() => {
        let isLatest = true;
        void engineHost()
            .then((host) => host.listJobSettings(character.jobId))
            .catch(() => noJobSettings)
            .then((loaded) => {
                if (isLatest) {
                    setJobSettings(loaded);
                }
            });
        return () => {
            isLatest = false;
        };
    }, [character.jobId]);

    const counts = setCountsOfTabs(character);
    const markedSkills = openTabId === "learnedSkills" ? { keys: new Set(Array.from(skillIdsGearRewards, String)), label: t("装備効果") } : undefined;
    const matchingRows = jobSettings === null || openTab === undefined ? [] : shownRowsOf(rowsOfTab(jobSettings, openTab), character, query, showsOnlySet);
    const rows = showsOnlyMarked && markedSkills !== undefined ? matchingRows.filter((row) => markedSkills.keys.has(row.key)) : matchingRows;
    const isFiltering = query !== "" || showsOnlySet;
    const markedSkillCount = jobSettings === null ? 0 : jobSettings.learnableSkills.filter((skill) => skillIdsGearRewards.has(skill.id)).length;

    return (
        <Overlay title={t("スキル · 支援")} onClose={onClose}>
            <div className="picker-top">
                <div className="seg scrolls" role="group" aria-label={t("種類")}>
                    {settingsTabs.map((tab) => (
                        <button key={tab.id} type="button" aria-pressed={openTabId === tab.id} data-tab={tab.id} onClick={() => setOpenTabId(tab.id)}>
                            {tab.label} <span className="num">{counts[tab.id]}</span>
                        </button>
                    ))}
                </div>
                <input className="text-field" type="search" aria-label={t("名前で検索")} placeholder={t("名前で検索（ひらがな可）")} value={query} onChange={(event) => setQuery(event.target.value)} />
                <label className="check-label compact">
                    <input type="checkbox" checked={showsOnlySet} onChange={(event) => setShowsOnlySet(event.target.checked)} />
                    {t("設定済みだけ表示")}
                </label>
            </div>
            <div className="settings-list" data-testid="settings-list" key={openTabId}>
                {openTabId === "items" && !isFiltering && <ConsumableRows character={character} onChange={onChange} />}
                {openTabId === "other" && !isFiltering && <WeaponRows character={character} onChange={onChange} />}
                {openTabId === "other" && !isFiltering && <AutoSpellRows character={character} chancesPerMille={jobSettings?.autoSpellChances ?? []} onChange={onChange} />}
                {openTabId === "learnedSkills" && markedSkillCount > 0 && (
                    <label className="settings-notice check-label compact" data-testid="rewarded-skills-notice">
                        <input type="checkbox" checked={showsOnlyMarked} onChange={(event) => setShowsOnlyMarked(event.target.checked)} />
                        {t("装備・カードの効果に関わる習得スキルが {0} 件あります。印の付いたものだけ表示", markedSkillCount)}
                    </label>
                )}
                {jobSettings === null && <p className="empty-note">{t("読み込み中…")}</p>}
                {jobSettings !== null && rows.length === 0 && <p className="empty-note">{t("該当する項目がありません。")}</p>}
                <SettingRows rows={rows} holder={character} onChange={onChange} {...(markedSkills === undefined ? {} : { marked: markedSkills })} />
            </div>
        </Overlay>
    );
}

interface CharacterRowsProps {
    readonly character: WorkspaceCharacter;
    onChange(character: WorkspaceCharacter): void;
}

/** The attack-speed potion and the time-limited effects of gear, cards and consumables. */
function ConsumableRows({ character, onChange }: CharacterRowsProps) {
    const [isPicking, setIsPicking] = useState(false);
    const timedItemCatalog = useCatalogList({ what: "timedItems" });
    const speedPotions = useCatalogList({ what: "speedPotions" });
    const timedItemIds = character.timedItems ?? [];
    const catalogEntryOf = new Map<number, CatalogEntry>((timedItemCatalog ?? []).map((entry) => [entry.id, entry]));

    function withTimedItems(nextTimedItemIds: readonly number[]): WorkspaceCharacter {
        const { timedItems: _previousTimedItems, ...characterWithoutTimedItems } = character;
        return nextTimedItemIds.length === 0 ? characterWithoutTimedItems : { ...characterWithoutTimedItems, timedItems: [...nextTimedItemIds] };
    }

    function withSpeedPotion(speedPotion: number): WorkspaceCharacter {
        const { speedPotion: _previousSpeedPotion, ...characterWithoutSpeedPotion } = character;
        return speedPotion === 0 ? characterWithoutSpeedPotion : { ...characterWithoutSpeedPotion, speedPotion };
    }

    return (
        <div data-testid="item-effects">
            <label className={`setting-row${(character.speedPotion ?? 0) !== 0 ? " set" : ""}`}>
                <span className="setting-name">{t("速度ポーション")}</span>
                <select className="text-field setting-value labelled" value={character.speedPotion ?? 0} onChange={(event) => onChange(withSpeedPotion(Number(event.target.value)))}>
                    <option value={0}>{t("なし")}</option>
                    {(speedPotions ?? []).map((speedPotion) => (
                        <option key={speedPotion.id} value={speedPotion.id}>
                            {speedPotion.name}
                        </option>
                    ))}
                </select>
            </label>
            <div className="eyebrow settings-group">
                {t("時限効果")} {timedItemIds.length}/{timedItemLimit}
            </div>
            {timedItemIds.map((timedItemId, position) => (
                <div key={`${timedItemId}-${position}`} className="setting-row set" data-testid="timed-item">
                    <span className="picker-name">
                        {catalogEntryOf.get(timedItemId)?.name ?? `#${timedItemId}`}
                        <small>{catalogEntryOf.get(timedItemId)?.detail}</small>
                    </span>
                    <button type="button" className="ib small" aria-label={t("時限効果を外す")} onClick={() => onChange(withTimedItems(timedItemIds.filter((_id, index) => index !== position)))}>
                        <CloseIcon size={15} />
                    </button>
                </div>
            ))}
            {timedItemIds.length < timedItemLimit && (
                <button type="button" className="sock empty add-row" onClick={() => setIsPicking(true)}>
                    <PlusIcon size={15} />
                    <span className="sock-name">{t("時限効果を追加")}</span>
                </button>
            )}
            <div className="eyebrow settings-group">{t("食品 · 消耗品")}</div>
            {isPicking && (
                <Picker
                    title={t("時限効果")}
                    list={{ what: "timedItems" }}
                    onClose={() => setIsPicking(false)}
                    onPick={(entry) => {
                        if (entry !== null) {
                            onChange(withTimedItems([...timedItemIds, entry.id]));
                        }
                        setIsPicking(false);
                    }}
                />
            )}
        </div>
    );
}

/** The auto-spells that go off on a plain attack, each with its level and chance. */
function AutoSpellRows({ character, chancesPerMille, onChange }: CharacterRowsProps & { readonly chancesPerMille: readonly number[] }) {
    const [isPicking, setIsPicking] = useState(false);
    const catalog = useCatalogList({ what: "autoSpells" });
    const autoSpells = character.autoSpells ?? [];
    const entryOf = new Map<number, CatalogEntry>((catalog ?? []).map((entry) => [entry.id, entry]));

    return (
        <div data-testid="auto-spells">
            <div className="eyebrow settings-group">
                {t("オートスペル")} {autoSpells.length}/{autoSpellLimit}
            </div>
            {autoSpells.map((autoSpell, row) => (
                <div key={`${autoSpell.autoSpellId}-${row}`} className="setting-row set auto-spell-row" data-testid="auto-spell">
                    <span className="picker-name">{entryOf.get(autoSpell.autoSpellId)?.name ?? `#${autoSpell.autoSpellId}`}</span>
                    <select className="text-field setting-value num" aria-label={t("発動レベル")} value={autoSpell.level ?? 0} onChange={(event) => onChange(withAutoSpellAt(character, row, { level: Number(event.target.value) }))}>
                        {Array.from({ length: highestAutoSpellLevel + 1 }, (_unused, level) => (
                            <option key={level} value={level}>
                                Lv{level === 0 ? "-" : level}
                            </option>
                        ))}
                    </select>
                    <select className="text-field setting-value num" aria-label={t("発動率")} value={autoSpell.chancePerMille} onChange={(event) => onChange(withAutoSpellAt(character, row, { chancePerMille: Number(event.target.value) }))}>
                        {chancesPerMille.map((chancePerMille) => (
                            <option key={chancePerMille} value={chancePerMille}>
                                {chancePerMille / 10}%
                            </option>
                        ))}
                    </select>
                    <button type="button" className="ib small" aria-label={t("オートスペルを外す")} onClick={() => onChange(withAutoSpells(character, autoSpells.filter((_autoSpell, index) => index !== row)))}>
                        <CloseIcon size={15} />
                    </button>
                </div>
            ))}
            {autoSpells.length < autoSpellLimit && (
                <button type="button" className="sock empty add-row" onClick={() => setIsPicking(true)}>
                    <PlusIcon size={15} />
                    <span className="sock-name">{t("オートスペルを追加")}</span>
                </button>
            )}
            <div className="eyebrow settings-group">{t("その他の支援 · 設定")}</div>
            {isPicking && (
                <Picker
                    title={t("オートスペル")}
                    list={{ what: "autoSpells" }}
                    onClose={() => setIsPicking(false)}
                    onPick={(entry) => {
                        if (entry !== null) {
                            const chanceOfItsItem = entry.defaultValue ?? 0;
                            onChange(withAutoSpells(character, [...autoSpells, { autoSpellId: entry.id, chancePerMille: chancesPerMille.includes(chanceOfItsItem) ? chanceOfItsItem : 0 }]));
                        }
                        setIsPicking(false);
                    }}
                />
            )}
        </div>
    );
}

/** What the weapon is endowed with and what it shoots. */
function WeaponRows({ character, onChange }: CharacterRowsProps) {
    const [isPickingArrow, setIsPickingArrow] = useState(false);
    const weaponElements = useCatalogList({ what: "weaponElements" });
    const arrows = useCatalogList({ what: "arrowsOfJob", jobId: character.jobId });
    const costumes = useCatalogList({ what: "costumesOfJob", jobId: character.jobId });
    const jobUsesAmmunition = (arrows ?? []).length > 0 || (character.arrowId ?? 0) !== 0;
    const arrow = (arrows ?? []).find((entry) => entry.id === character.arrowId);

    function withWeaponElement(weaponElement: number): WorkspaceCharacter {
        const { weaponElement: _previousElement, ...characterWithoutElement } = character;
        return weaponElement === 0 ? characterWithoutElement : { ...characterWithoutElement, weaponElement };
    }

    function withCostume(costumeId: number): WorkspaceCharacter {
        const { costumeId: _previousCostumeId, ...characterWithoutCostume } = character;
        return costumeId === 0 ? characterWithoutCostume : { ...characterWithoutCostume, costumeId };
    }

    function withArrow(arrowId: number): WorkspaceCharacter {
        const { arrowId: _previousArrowId, ...characterWithoutArrow } = character;
        return arrowId === 0 ? characterWithoutArrow : { ...characterWithoutArrow, arrowId };
    }

    return (
        <div data-testid="weapon-settings">
            <label className={`setting-row${(character.weaponElement ?? 0) !== 0 ? " set" : ""}`}>
                <span className="setting-name">{t("武器属性付与")}</span>
                <select
                    className="text-field setting-value labelled"
                    data-testid="weapon-element"
                    value={character.weaponElement ?? 0}
                    onChange={(event) => onChange(withWeaponElement(Number(event.target.value)))}
                >
                    {(weaponElements ?? [{ id: 0, name: "—" }]).map((element) => (
                        <option key={element.id} value={element.id}>
                            {element.id === 0 ? t("付与なし（{0}）", element.name) : element.name}
                        </option>
                    ))}
                </select>
            </label>
            {(costumes ?? []).length > 0 && (
                <label className={`setting-row${(character.costumeId ?? 0) !== 0 ? " set" : ""}`}>
                    <span className="setting-name">{t("衣装（頭下段）")}</span>
                    <select className="text-field setting-value labelled" data-testid="costume" value={character.costumeId ?? 0} onChange={(event) => onChange(withCostume(Number(event.target.value)))}>
                        <option value={0}>{t("なし")}</option>
                        {(costumes ?? []).map((costume) => (
                            <option key={costume.id} value={costume.id}>
                                {costume.name}
                            </option>
                        ))}
                    </select>
                </label>
            )}
            {jobUsesAmmunition && (
                <div className={`setting-row${(character.arrowId ?? 0) !== 0 ? " set" : ""}`}>
                    <span className="picker-name">
                        {t("矢 · 弾")}
                        <small>{arrow?.detail}</small>
                    </span>
                    <button type="button" className="btn compact" data-testid="arrow" onClick={() => setIsPickingArrow(true)}>
                        {(character.arrowId ?? 0) === 0 ? t("なし") : (arrow?.name ?? `#${character.arrowId}`)}
                    </button>
                </div>
            )}
            {isPickingArrow && (
                <Picker
                    title={t("矢 · 弾")}
                    list={{ what: "arrowsOfJob", jobId: character.jobId }}
                    noneLabel={t("なし")}
                    onClose={() => setIsPickingArrow(false)}
                    onPick={(entry) => {
                        onChange(withArrow(entry?.id ?? 0));
                        setIsPickingArrow(false);
                    }}
                />
            )}
        </div>
    );
}
