import type { CatalogEntry, SearchHit, TextKind } from "@ro-ratorio-branch/core/platform-neutral";
import { type ReactNode, useMemo, useState } from "react";
import type { CatalogList } from "../engine-host/host-protocol.ts";
import { type DamagePreview, orderedByPreview } from "./damage-preview-model.ts";
import { formatSignedPercent } from "./format.ts";
import { pictureKinds } from "../image-pack/image-pack-model.ts";
import { Picture } from "../image-pack/Picture.tsx";
import { MarkedName } from "./MarkedName.tsx";
import { OfficialDatabaseLink } from "./OfficialDatabaseLink.tsx";
import { Overlay } from "./Overlay.tsx";
import {
    type EffectHit,
    type PickerEntry,
    type PickerNotice,
    prepareEffects,
    preparePickerEntries,
    type SearchablePickerEntry,
    searchEffects,
    searchPicker,
} from "./picker-model.ts";
import { shownEnglishName } from "./text/EnglishName.tsx";
import { useEffectWords, useTextOfKind } from "./text/text-index.ts";
import { menuLanguage, t } from "./text/ui-text.ts";
import { type PickerPreview, useDamagePreviews } from "./use-damage-previews.ts";
import { useCatalogList } from "./use-engine-data.ts";

const shownLimit = 80;
const shownEffectLinesPerEntry = 3;
/** How many rows from the top get a damage preview: what fits a screen by name, a few screens by effect, where the previews also order the rows. */
const previewedRowsByName = 8;
const previewedRowsByEffect = 24;

interface PickerFrameProps {
    readonly title: string;
    /** Shown above the search box, for example a slot selector that changes the list. */
    readonly aboveSearch?: ReactNode;
    /** The label of a first row that picks nothing, for a choice that may be cleared. */
    readonly noneLabel?: string;
    /** When given, the first rows say what choosing them would do to the damage. */
    readonly preview?: PickerPreview | undefined;
    /** Among entries that match equally well, those with the higher number come first: what the player owns, for example. Keep the same function while nothing changed. */
    readonly boostOf?: ((entry: CatalogEntry) => number) | undefined;
    onPick(entry: CatalogEntry | null): void;
    onClose(): void;
}

/** The kind of name each of the engine's lists holds, for the lists whose names have readings. */
function textKindOfList(list: CatalogList): TextKind | null {
    switch (list.what) {
        case "itemsForSlot":
            return "item";
        case "socketChoicesOfItem":
            return "cardOrEnchant";
        case "monsters":
            return "monster";
        case "jobs":
            return "job";
        case "timedItems":
            return "timedItem";
        case "attackSkillsOfJob":
            return "skill";
        default:
            return null;
    }
}

type SearchMode = "name" | "effect";

/** Search one of the engine's lists and pick an entry. Gear and what goes into its sockets can also be searched by what they do. */
export function Picker({ list, aboveSearch, ...frame }: PickerFrameProps & { readonly list: CatalogList }) {
    const [mode, setMode] = useState<SearchMode>("name");
    const hasEffects = list.what === "itemsForSlot" || list.what === "socketChoicesOfItem";
    const entries = useCatalogList(hasEffects && mode === "effect" ? { ...list, withEffects: true } : list);
    const modeChoice = hasEffects && (
        <div className="seg" role="group" aria-label={t("探し方")}>
            <button type="button" aria-pressed={mode === "name"} onClick={() => setMode("name")}>
                {t("名前で探す")}
            </button>
            <button type="button" aria-pressed={mode === "effect"} onClick={() => setMode("effect")}>
                {t("効果で探す")}
            </button>
        </div>
    );
    return (
        <EntryPicker
            {...frame}
            entries={entries}
            textKind={textKindOfList(list)}
            searchesEffects={mode === "effect"}
            aboveSearch={
                <>
                    {aboveSearch}
                    {modeChoice}
                </>
            }
        />
    );
}

interface EntryPickerProps extends PickerFrameProps {
    /** `null` while the entries load. */
    readonly entries: readonly PickerEntry[] | null;
    /** The kind of name the entries are, when their names have readings and aliases. */
    readonly textKind?: TextKind | null;
    /** For entries whose IDs are not ratorio's. */
    readonly hidesIds?: boolean;
    /** Whether the query is looked for in what the entries do instead of in their names. */
    readonly searchesEffects?: boolean;
}

/** One row of the list, whichever way it was found. */
interface ShownRow {
    readonly entry: PickerEntry;
    readonly nameHit?: SearchHit<SearchablePickerEntry>;
    readonly effectHit?: EffectHit;
}

/**
 * Search entries that are already at hand and pick one. A word of the query
 * may be part of the name, its reading in kana or romaji, its English name,
 * an alias or "#ID", give or take a typing mistake; several words may come
 * in any order.
 */
export function EntryPicker({ title, entries, textKind = null, aboveSearch, noneLabel, hidesIds = false, searchesEffects = false, preview, boostOf, onPick, onClose }: EntryPickerProps) {
    const [query, setQuery] = useState("");
    const text = useTextOfKind(textKind);
    const pictureKind = pictureKinds.find((kind) => kind === textKind);
    const preparedNames = useMemo(() => (entries === null ? null : preparePickerEntries(entries, textKind, text)), [entries, textKind, text]);
    const effectWords = useEffectWords(searchesEffects);
    const preparedEffects = useMemo(() => (entries === null || !searchesEffects ? null : prepareEffects(entries, effectWords ?? {})), [entries, searchesEffects, effectWords]);
    const nameSearch = useMemo(() => (preparedNames === null || searchesEffects ? null : searchPicker(preparedNames, query, shownLimit, boostOf)), [preparedNames, searchesEffects, query, boostOf]);
    const effectSearch = useMemo(() => (preparedEffects === null ? null : searchEffects(preparedEffects, query, shownLimit, shownEffectLinesPerEntry)), [preparedEffects, query]);

    const foundRows: readonly ShownRow[] | null = useMemo(() => {
        if (searchesEffects) {
            const nameHitOfId = new Map((preparedNames ?? []).map((prepared) => [prepared.entry.id, prepared.entry]));
            return effectSearch === null
                ? null
                : effectSearch.shown.map((effectHit) => {
                      const named = nameHitOfId.get(effectHit.entry.id);
                      return { entry: effectHit.entry, effectHit, ...(named === undefined ? {} : { nameHit: { entry: named, kind: "exact", edits: 0, terms: [], highlights: [] } }) };
                  });
        }
        return nameSearch === null ? null : nameSearch.shown.map((nameHit) => ({ entry: nameHit.entry.source, nameHit }));
    }, [searchesEffects, effectSearch, nameSearch, preparedNames]);
    const matchCount = searchesEffects ? effectSearch?.matchCount : nameSearch?.matchCount;

    const previewedRows = (foundRows ?? []).slice(0, searchesEffects ? previewedRowsByEffect : previewedRowsByName);
    const previews = useDamagePreviews(
        previewedRows.map((row) => row.entry.id),
        preview,
    );
    // Found by effect, the rows are for comparing what they do, so the previewed ones go by their damage.
    const rows =
        foundRows === null || !searchesEffects || preview === undefined
            ? foundRows
            : [...orderedByPreview(previewedRows, (row) => previews.get(row.entry.id)), ...foundRows.slice(previewedRows.length)];

    return (
        <Overlay title={title} onClose={onClose}>
            <div className="picker-top">
                {aboveSearch}
                <input
                    className="text-field"
                    type="search"
                    aria-label={t("検索")}
                    placeholder={searchesEffects ? t("効果で検索（例: 詠唱、ダメージ）") : t("名前 · よみ · romaji · #ID")}
                    value={query}
                    autoFocus
                    onChange={(event) => setQuery(event.target.value)}
                />
                {nameSearch?.notice != null && <NoticeLine notice={nameSearch.notice} />}
                <div className="picker-count num" role="status">
                    {rows === null || matchCount === undefined ? t("読み込み中…") : matchCount > rows.length ? t("{0} 件中 {1} 件を表示", matchCount, rows.length) : t("{0} 件", matchCount)}
                </div>
            </div>
            <ul className="picker-list">
                {noneLabel !== undefined && (
                    <li>
                        <button type="button" className="picker-row none" onClick={() => onPick(null)}>
                            {noneLabel}
                        </button>
                    </li>
                )}
                {rows?.map(({ entry, nameHit, effectHit }) => (
                    <li key={entry.id} className="picker-item">
                        <button type="button" className="picker-row" data-match={nameHit?.kind} onClick={() => onPick(entry)}>
                            {pictureKind !== undefined && <Picture kind={pictureKind} id={entry.textId ?? entry.id} name={entry.name} />}
                            <span className="picker-name">
                                <span className="rl">
                                    <MarkedName name={entry.name} reading={nameHit?.entry.reading} highlights={nameHit?.highlights ?? []} />
                                </span>
                                {nameHit?.entry.english !== undefined && (menuLanguage === "en" || nameHit.terms.some((termMatch) => termMatch.matchedText === "english")) && (
                                    <small className="english-name" lang="en">
                                        {shownEnglishName(nameHit.entry.english, nameHit.entry.isEnglishConfirmed)}
                                    </small>
                                )}
                                {nameHit !== undefined && <MatchTag hit={nameHit} />}
                                {effectHit === undefined
                                    ? entry.detail !== undefined && entry.detail !== "" && <small>{entry.detail}</small>
                                    : effectHit.lines.map((line, lineIndex) => (
                                          <small className="effect-line" key={lineIndex}>
                                              <MarkedName name={line.text} highlights={line.highlights} />
                                          </small>
                                      ))}
                            </span>
                            <span className="picker-side">
                                <PreviewBadge preview={previews.get(entry.id)} />
                                {!hidesIds && <span className="num picker-id">#{entry.id}</span>}
                            </span>
                        </button>
                        {textKind !== null && <OfficialDatabaseLink kind={textKind} name={entry.name} />}
                    </li>
                ))}
            </ul>
        </Overlay>
    );
}

/** What choosing the row would do to the damage per second: a placeholder while it is worked out, nothing when it cannot be. */
function PreviewBadge({ preview }: { preview: DamagePreview | undefined }) {
    if (preview === undefined || preview.state === "unavailable") {
        return null;
    }
    if (preview.state === "calculating") {
        return <span className="badge preview pending" role="status" aria-label={t("計算中…")} />;
    }
    const difference = preview.damagePerSecond - preview.baselineDamagePerSecond;
    return (
        <span className={`badge preview num ${difference > 0 ? "good" : difference < 0 ? "bad" : "flat"}`} title={t("今の装備と比べた DPS（アイテムは同じ精錬値・カードなしで比較）")}>
            <small>{t("試算")}</small> {difference > 0 ? "▲ " : difference < 0 ? "▼ " : ""}
            {formatSignedPercent(difference, preview.baselineDamagePerSecond)}
        </span>
    );
}

/** Says when a hit is a near miss, or matched as several words, so that it is not taken for an exact one. */
function MatchTag({ hit }: { hit: SearchHit<SearchablePickerEntry> }) {
    if (hit.kind === "typo") {
        return <span className="match-tag near">{t("あいまい · {0}文字", hit.edits)}</span>;
    }
    return hit.terms.length > 1 ? <span className="match-tag">{t("部分一致 · {0}語", hit.terms.length)}</span> : null;
}

function NoticeLine({ notice }: { notice: PickerNotice }) {
    if (notice.kind === "nearMatchesOnly") {
        return (
            <div className="picker-notice" role="status" data-notice="nearMatchesOnly">
                {t("完全一致はありません。近い表記で表示中:")} <span className="mono">{notice.term}</span> → <b>{notice.matchedAs}</b> {t("（{0}文字ちがい）", notice.edits)}
            </div>
        );
    }
    return (
        <div className="picker-readings" role="status" data-notice="readAs">
            <span>{t("読み替え:")}</span>
            {notice.readings.map((reading) => (
                <span className="tok" key={reading.term}>
                    <span className="mono">{reading.term}</span>→<b>{reading.matchedAs}</b>
                </span>
            ))}
        </div>
    );
}
