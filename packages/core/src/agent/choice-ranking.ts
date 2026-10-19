import type { Build } from "../build/build-format.ts";
import { slotTakesRefine } from "../build/convert-build.ts";
import { buildWearingItem, buildWithSocketFilled } from "../build/wear-item.ts";
import type { EquipmentSlot } from "../character-vocabulary.ts";
import type { CatalogEntry } from "../engine-adapter/engine-catalog.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import { panelDefinitions } from "../panels/panel-definitions.ts";
import { prepareEffects, searchEffects } from "../search/effect-search.ts";
import type { EnglishGlossary } from "../text/english-names.ts";
import { type BuildOutcome, buildOf, outcomeOf } from "../tree/evaluate-tree.ts";
import { graftNodes } from "../tree/graft-nodes.ts";
import { resolveTree } from "../tree/resolve-tree.ts";
import { type Change, type Tree, treeFormatVersion, type TreeNode } from "../tree/tree-format.ts";

export interface ChoiceRankingOptions {
    /** Keeps the choices this says match a name query; every choice when left out. */
    readonly matchesName?: (id: number) => boolean;
    /** Keeps the choices with every word of this in their effects, as the app's search by effect does. */
    readonly effectQuery?: string;
    /** English words for Japanese effect text, so that an English effect query finds its place. */
    readonly effectWords?: EnglishGlossary;
    /** How many of the best to give. */
    readonly limit: number;
    /** How many of the best become branches of the tree. */
    readonly branchCount: number;
}

export interface DamageOfBuild {
    /** `null` when the engine cannot calculate the build. */
    readonly averageDamagePerSecond: number | null;
    readonly secondsToKill: number | null;
}

export interface RankedChoice {
    /** The item's ID for a slot, the card's or enchant's for a socket. */
    readonly id: number;
    readonly name: string;
    readonly averageDamagePerSecond: number;
    /** Against the baseline: 0.05 is 5% more damage per second. `null` when the baseline deals none. */
    readonly damagePerSecondGain: number | null;
    readonly secondsToKill: number | null;
    /** The effect lines the effect query was found in. Empty without one. */
    readonly matchedEffects: readonly string[];
}

export interface ChoiceRanking {
    /** The build as it is, with what is chosen there now (`id`, `null` for nothing). */
    readonly current: { readonly id: number | null } & DamageOfBuild;
    /** What the choices are measured against; each ranking says what it leaves out to make it. */
    readonly baseline: DamageOfBuild;
    /** Best first, by damage per second. */
    readonly choices: readonly RankedChoice[];
    /** How many choices the queries kept, apart from the one chosen now. */
    readonly consideredCount: number;
    /** How many of those the engine could not calculate with this build. */
    readonly notCalculableCount: number;
    /** The build as the root, with the best choices as branches, to open in the app or compare further. */
    readonly tree: Tree;
}

/** Where a choice goes, and how the build looks with it and without it. */
interface ChoicePlace {
    readonly choices: readonly CatalogEntry[];
    readonly currentId: number | null;
    /** The choice left out of the ranking, as it is what the build has now. */
    readonly leftOutId: number | null;
    readonly effectsOf: (id: number) => string[];
    readonly baselineBuild: Build;
    readonly buildWith: (id: number) => Build;
    readonly changeFor: (id: number) => Change;
    readonly nodeIdFor: (id: number) => string;
}

export interface SlotRankingOptions extends ChoiceRankingOptions {
    /**
     * Refine levels to try the best choices at too, besides the refine of the
     * piece they replace. The levels at which an item's own effects start
     * ("精錬値が7以上の時") are tried for that item as well.
     */
    readonly refineLevels?: readonly number[];
    /**
     * The highest refine to consider: levels above it are not tried, and when
     * the piece worn now is refined higher, the items are compared at this
     * refine instead (the piece worn now too, as the baseline).
     */
    readonly highestRefine?: number;
}

export interface RefineOption {
    readonly refine: number;
    readonly averageDamagePerSecond: number;
    /** Against the same baseline as the ranking. */
    readonly damagePerSecondGain: number | null;
    readonly secondsToKill: number | null;
    /** Whether one of the item's effects starts at this level. */
    readonly startsAnEffect: boolean;
}

export interface SlotChoice extends RankedChoice {
    /** The choice at other refine levels, lowest first; only when refine levels were asked for. */
    readonly byRefine?: readonly RefineOption[];
}

export interface SlotRanking extends ChoiceRanking {
    readonly slot: EquipmentSlot;
    readonly choices: readonly SlotChoice[];
}

/**
 * Every item the build's job can wear in a slot, worn in place of what is
 * there now and ranked by the damage per second it gives. An item keeps the
 * refine and transcendence of the piece it replaces and comes without cards,
 * as the app's previews compare them, so the baseline is the piece worn now
 * without its cards (the build as it is for an empty slot).
 */
export function rankSlotCandidates(build: Build, slot: EquipmentSlot, engine: RatorioEngine, options: SlotRankingOptions): SlotRanking {
    const currentId = build.character.equipment[slot]?.itemId ?? null;
    const highestRefine = Math.min(options.highestRefine ?? panelDefinitions.gearLimits.highestRefine, panelDefinitions.gearLimits.highestRefine);
    const wearing = (itemId: number) => withRefineAtMost(buildWearingItem(build, slot, itemId), slot, highestRefine);
    const ranking = rankChoices(build, engine, options, {
        choices: engine.catalog.itemsForSlot(slot, build.character.jobId),
        currentId,
        leftOutId: currentId,
        effectsOf: engine.catalog.effectsOfItem,
        baselineBuild: currentId === null ? build : wearing(currentId),
        buildWith: wearing,
        changeFor: (itemId) => ({ kind: "setGearPiece", slot, gearPiece: wearing(itemId).character.equipment[slot] ?? { itemId } }),
        nodeIdFor: (itemId) => `${slot}-${itemId}`,
    });
    if (options.refineLevels === undefined || !slotTakesRefine(slot)) {
        return { slot, ...ranking };
    }
    const likeForLikeRefine = Math.min(build.character.equipment[slot]?.refine ?? 0, highestRefine);
    const choices = ranking.choices.map((choice): SlotChoice => {
        const effectStarts = refineLevelsStartingEffects(engine.catalog.effectsOfItem(choice.id));
        if (effectStarts === null) {
            return { ...choice, byRefine: [] };
        }
        const levels = [...new Set([...(options.refineLevels ?? []), ...effectStarts])]
            .filter((level) => Number.isInteger(level) && level >= 0 && level <= highestRefine && level !== likeForLikeRefine)
            .sort((first, second) => first - second);
        const byRefine = levels.flatMap((refine): RefineOption[] => {
            const worn = wearing(choice.id);
            const piece = worn.character.equipment[slot];
            const outcome = outcomeOf({ ...worn, character: { ...worn.character, equipment: { ...worn.character.equipment, [slot]: { ...piece, itemId: choice.id, refine } } } }, engine);
            if (outcome.state !== "ready") {
                return [];
            }
            const { averageDamagePerSecond, averageTimeToKill } = outcome.battleSummary;
            return [{ refine, averageDamagePerSecond, damagePerSecondGain: gainOver(ranking.baseline, averageDamagePerSecond), secondsToKill: averageTimeToKill?.seconds ?? null, startsAnEffect: effectStarts.includes(refine) }];
        });
        return { ...choice, byRefine };
    });
    // Each branch gets a child for each refine level that was tried for it.
    const refineNodes = ranking.tree.nodes.flatMap((branch) => {
        const choice = choices.find((candidate) => `${slot}-${candidate.id}` === branch.id);
        return (choice?.byRefine ?? []).map(
            (option): TreeNode => ({
                id: `${branch.id}-refine-${option.refine}`,
                parentId: branch.id,
                label: `+${option.refine} ${choice?.name ?? ""}`,
                changes: [{ kind: "setRefine", slot, expectedItemId: choice?.id ?? 0, refine: option.refine }],
            }),
        );
    });
    return { slot, ...ranking, choices, tree: { ...ranking.tree, nodes: [...ranking.tree.nodes, ...refineNodes] } };
}

function withRefineAtMost(build: Build, slot: EquipmentSlot, highestRefine: number): Build {
    const piece = build.character.equipment[slot];
    if (piece?.refine === undefined || piece.refine <= highestRefine) {
        return build;
    }
    return { ...build, character: { ...build.character, equipment: { ...build.character.equipment, [slot]: { ...piece, refine: highestRefine } } } };
}

const effectStartPatterns = [/精錬値が?(\d+)以上/g, /精錬値が(\d+)の時/g];

/** The refine levels at which an item's effects start, from their wording; `null` for an item that cannot be refined. */
export function refineLevelsStartingEffects(effects: readonly string[]): number[] | null {
    if (effects.some((line) => line.includes("精錬不可能"))) {
        return null;
    }
    const levels = effects.flatMap((line) => effectStartPatterns.flatMap((pattern) => [...line.matchAll(pattern)].map((match) => Number(match[1]))));
    return [...new Set(levels)].sort((first, second) => first - second);
}

function gainOver(baseline: DamageOfBuild, averageDamagePerSecond: number): number | null {
    return baseline.averageDamagePerSecond === null || baseline.averageDamagePerSecond === 0 ? null : averageDamagePerSecond / baseline.averageDamagePerSecond - 1;
}

export interface SocketRanking extends ChoiceRanking {
    readonly slot: EquipmentSlot;
    readonly socketIndex: number;
    /** The piece whose socket it is. */
    readonly itemId: number;
}

export interface SocketRankingOptions extends ChoiceRankingOptions {
    /**
     * Ranks on the piece without any cards or enchants yet: the other sockets
     * are emptied first, and what this socket holds now is ranked with the rest.
     */
    readonly emptyOtherSockets?: boolean;
}

export class NoPieceInSlotError extends Error {
    readonly slot: EquipmentSlot;

    constructor(slot: EquipmentSlot) {
        super("nothing is worn in the slot");
        this.slot = slot;
    }
}

/**
 * Every card or enchant one socket of the piece worn in a slot takes, put in
 * that socket and ranked by the damage per second it gives. The rest of the
 * piece stays as it is; the baseline is the socket left empty. Ranking one
 * socket at a time takes in what the other sockets already hold.
 * @throws {NoPieceInSlotError} when nothing is worn in the slot.
 */
export function rankSocketChoices(build: Build, slot: EquipmentSlot, socketIndex: number, engine: RatorioEngine, options: SocketRankingOptions): SocketRanking {
    const piece = build.character.equipment[slot];
    if (piece === undefined) {
        throw new NoPieceInSlotError(slot);
    }
    const { sockets: _sockets, ...bare } = piece;
    const start: Build = options.emptyOtherSockets === true ? { ...build, character: { ...build.character, equipment: { ...build.character.equipment, [slot]: bare } } } : build;
    const filling = (cardOrEnchantId: number | null) => buildWithSocketFilled(start, slot, socketIndex, cardOrEnchantId) ?? start;
    const filledSockets = (cardOrEnchantId: number) => filling(cardOrEnchantId).character.equipment[slot]?.sockets ?? [];
    const currentId = piece.sockets?.[socketIndex] ?? null;
    const ranking = rankChoices(build, engine, options, {
        choices: engine.catalog.socketChoicesOfItem(slot, piece.itemId)[socketIndex] ?? [],
        currentId,
        leftOutId: options.emptyOtherSockets === true ? null : currentId,
        effectsOf: engine.catalog.effectsOfCardOrEnchant,
        baselineBuild: filling(null),
        buildWith: filling,
        changeFor: (cardOrEnchantId) => ({ kind: "setGearPiece", slot, gearPiece: { ...bare, sockets: filledSockets(cardOrEnchantId) } }),
        nodeIdFor: (cardOrEnchantId) => `${slot}-socket-${socketIndex}-${cardOrEnchantId}`,
    });
    return { slot, socketIndex, itemId: piece.itemId, ...ranking };
}

function rankChoices(build: Build, engine: RatorioEngine, options: ChoiceRankingOptions, place: ChoicePlace): ChoiceRanking {
    const current = damageOf(outcomeOf(build, engine));
    const baseline = damageOf(outcomeOf(place.baselineBuild, engine));
    const named = place.choices.filter((choice) => choice.id !== place.leftOutId && (options.matchesName?.(choice.id) ?? true));
    const matched = matchingEffects(named, place.effectsOf, options.effectQuery, options.effectWords ?? {});

    const calculated: RankedChoice[] = [];
    let notCalculableCount = 0;
    for (const { choice, matchedEffects } of matched) {
        const outcome = outcomeOf(place.buildWith(choice.id), engine);
        if (outcome.state !== "ready") {
            notCalculableCount += 1;
            continue;
        }
        const { averageDamagePerSecond, averageTimeToKill } = outcome.battleSummary;
        calculated.push({
            id: choice.id,
            name: choice.name,
            averageDamagePerSecond,
            damagePerSecondGain: gainOver(baseline, averageDamagePerSecond),
            secondsToKill: averageTimeToKill?.seconds ?? null,
            matchedEffects,
        });
    }
    const choices = calculated.sort((first, second) => second.averageDamagePerSecond - first.averageDamagePerSecond).slice(0, options.limit);
    const nodes = choices.slice(0, options.branchCount).map(
        (choice): TreeNode => ({ id: place.nodeIdFor(choice.id), parentId: null, label: choice.name, changes: [place.changeFor(choice.id)] }),
    );

    return {
        current: { id: place.currentId, ...current },
        baseline,
        choices,
        consideredCount: matched.length,
        notCalculableCount,
        tree: { formatVersion: treeFormatVersion, scenario: build.scenario, root: build.character, nodes },
    };
}

function damageOf(outcome: BuildOutcome): DamageOfBuild {
    return outcome.state === "ready"
        ? { averageDamagePerSecond: outcome.battleSummary.averageDamagePerSecond, secondsToKill: outcome.battleSummary.averageTimeToKill?.seconds ?? null }
        : { averageDamagePerSecond: null, secondsToKill: null };
}

function matchingEffects(choices: readonly CatalogEntry[], effectsOf: (id: number) => string[], effectQuery: string | undefined, effectWords: EnglishGlossary) {
    if (effectQuery === undefined || effectQuery.trim() === "") {
        return choices.map((choice) => ({ choice, matchedEffects: [] as readonly string[] }));
    }
    const withEffects = choices.map((choice) => ({ ...choice, effects: effectsOf(choice.id) }));
    const everyLine = Number.MAX_SAFE_INTEGER;
    return searchEffects(prepareEffects(withEffects, effectWords), effectQuery, withEffects.length, everyLine).shown.map((hit) => ({
        choice: hit.entry,
        matchedEffects: hit.lines.filter((line) => line.highlights.length > 0).map((line) => line.text),
    }));
}

export class UnusableNodeError extends Error {
    readonly nodeId: string;
    readonly reason: "unknown" | "stale";

    constructor(nodeId: string, reason: "unknown" | "stale") {
        super(`the tree's node ${nodeId} is ${reason}`);
        this.nodeId = nodeId;
        this.reason = reason;
    }
}

/**
 * The build a node of a tree stands for, with the tree's scenario; the root's for `null`.
 * @throws {UnusableNodeError} when the tree has no such node, or it names an item its parent does not wear.
 */
export function buildOfNode(tree: Tree, nodeId: string | null): Build {
    if (nodeId === null) {
        return buildOf(tree.root, tree.scenario);
    }
    const resolution = resolveTree(tree).get(nodeId);
    if (resolution === undefined) {
        throw new UnusableNodeError(nodeId, "unknown");
    }
    if (resolution.state === "stale") {
        throw new UnusableNodeError(nodeId, "stale");
    }
    return buildOf(resolution.character, tree.scenario);
}

/** A tree with the branches of a ranking made from one of its nodes put under that node (under the root for `null`), IDs kept apart. */
export function withRankingUnder(tree: Tree, nodeId: string | null, ranking: ChoiceRanking): Tree {
    return { ...tree, nodes: graftNodes(tree.nodes, nodeId, ranking.tree.nodes).nodes };
}
