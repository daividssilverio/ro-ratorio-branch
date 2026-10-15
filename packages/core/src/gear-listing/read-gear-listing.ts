import type { GearPiece } from "../build/build-format.ts";
import type { CatalogEntry, EngineCatalog } from "../engine-adapter/engine-catalog.ts";
import { characterSimilarity, effectFeaturesOf, linesOfListing, nameKeyOf, readItemLine, transcendenceOfLine, valueOfEffectLine } from "./listing-text.ts";

/** What one line of a listing was read as. */
export type ListingLineReading =
    | { readonly kind: "item"; readonly itemId: number; readonly name: string; readonly refine: number | null }
    | { readonly kind: "transcendence"; readonly transcendence: number }
    | { readonly kind: "cardOrEnchant"; readonly cardOrEnchantId: number; readonly name: string; readonly socketIndex: number }
    | { readonly kind: "randomOption"; readonly optionId: number; readonly name: string; readonly value: number; readonly positionIndex: number }
    /** An option that gives the weapon an element. It is kept on the piece. */
    | { readonly kind: "weaponElement"; readonly elementId: number; readonly name: string }
    | { readonly kind: "notUnderstood"; readonly reason: ListingLineProblem };

export type ListingLineProblem =
    /** No line names an item the engine has. */
    | "unknownItem"
    /** The line names another item than the piece it was pasted for. */
    | "anotherItem"
    /** Neither a card or enchant of the item nor an effect it rolls. */
    | "unknownEffect"
    /** The item rolls this option, but not this high or low. */
    | "valueNotOffered"
    /** Every socket or position that takes it is already filled by another line. */
    | "noRoomLeft"
    /** Only a weapon carries an element. */
    | "elementOnNonWeapon";

export interface GearListingLine {
    readonly text: string;
    readonly reading: ListingLineReading;
}

/** A market listing read as a gear piece, line by line. */
export interface GearListing {
    readonly lines: readonly GearListingLine[];
    /** The piece as far as the lines were understood. `null` when the item is not known. */
    readonly gearPiece: GearPiece | null;
}

export interface GearListingOptions {
    /** The item the text is pasted for, when it is already chosen: the text may then leave the item line out. */
    readonly itemId?: number;
}

/** A card or enchant name as it is compared: without the word the game puts behind a card, and without the refine an enchant asks for ("暴走した魔力 (+8以上)"). */
function cardNameKeyOf(name: string): string {
    return nameKeyOf(name)
        .replace(/\(\+\d+(?:以上)?\)$/, "")
        .replace(/の?カード$/, "");
}

/**
 * Reads the text of a listing as the game or the official tool shows one:
 * the transcendence if any, the item with its refine, then its cards,
 * enchants and random options, one per line. An effect line is matched to
 * the option of the item whose own wording is about the same thing, since
 * the game and the calculator word the same option differently. Cards and
 * enchants are placed in the sockets that take them, so that as many as
 * possible find a place whatever order the listing gives them in.
 */
export function readGearListing(text: string, catalog: EngineCatalog, options: GearListingOptions = {}): GearListing {
    const lines = linesOfListing(text);
    const readings: (ListingLineReading | undefined)[] = lines.map(() => undefined);
    let itemId = options.itemId ?? null;
    let refine: number | null = null;
    let transcendence: number | null = null;

    lines.forEach((line, index) => {
        const stage = transcendenceOfLine(line);
        if (stage !== null) {
            transcendence = stage;
            readings[index] = { kind: "transcendence", transcendence: stage };
        }
    });

    // The item is the first line that is not a transcendence; for a piece already chosen, only if it names an item.
    const itemLineIndex = readings.findIndex((reading) => reading === undefined);
    const itemLineText = lines[itemLineIndex];
    if (itemLineText !== undefined) {
        const itemLine = readItemLine(itemLineText);
        const named = itemOfLine(itemLine.name, itemLine.socketCount, catalog);
        if (options.itemId === undefined || itemLine.refine !== null || named !== undefined) {
            if (named === undefined) {
                readings[itemLineIndex] = { kind: "notUnderstood", reason: "unknownItem" };
            } else if (options.itemId !== undefined && named.id !== options.itemId) {
                readings[itemLineIndex] = { kind: "notUnderstood", reason: "anotherItem" };
            } else {
                itemId = named.id;
                refine = itemLine.refine;
                readings[itemLineIndex] = { kind: "item", itemId: named.id, name: named.name, refine };
            }
        }
    }
    if (itemId === null) {
        return { lines: lines.map((line, index) => ({ text: line, reading: readings[index] ?? { kind: "notUnderstood", reason: "unknownItem" } })), gearPiece: null };
    }

    const slots = catalog.slotsOfItem(itemId);
    const [slot] = slots;
    const isWeapon = slots.includes("rightHand") || slots.includes("leftHand");
    const socketChoices = slot === undefined ? [] : catalog.socketChoicesOfItem(slot, itemId);
    const optionChoices = catalog.randomOptionsOfItem(itemId);
    const randomOptions: ({ optionId: number; value: number } | null)[] = optionChoices.map(() => null);
    let element: number | null = null;
    const cardLines: CardLine[] = [];

    lines.forEach((line, index) => {
        if (readings[index] !== undefined) {
            return;
        }
        const value = valueOfEffectLine(line);
        const cardCandidates = cardCandidatesOf(line, socketChoices);
        // "ローラカード" is a card; "Int + 5" may be an enchant or an option, and is tried as an option first when the item rolls one.
        const asOption = readOptionLine(line, value, catalog, optionChoices, randomOptions, isWeapon);
        if (asOption?.kind === "weaponElement") {
            element = asOption.elementId;
            readings[index] = asOption;
            return;
        }
        if (asOption?.kind === "randomOption" || (asOption !== undefined && cardCandidates.length === 0)) {
            readings[index] = asOption;
            return;
        }
        if (cardCandidates.length > 0) {
            cardLines.push({ index, candidates: cardCandidates });
            return;
        }
        readings[index] = { kind: "notUnderstood", reason: "unknownEffect" };
    });

    const sockets: (number | null)[] = socketChoices.map(() => null);
    const placement = placeCards(cardLines, socketChoices.length);
    for (const cardLine of cardLines) {
        const socketIndex = placement.get(cardLine.index);
        const candidate = cardLine.candidates.find((option) => option.socketIndex === socketIndex);
        if (socketIndex === undefined || candidate === undefined) {
            readings[cardLine.index] = { kind: "notUnderstood", reason: "noRoomLeft" };
            continue;
        }
        sockets[socketIndex] = candidate.id;
        readings[cardLine.index] = { kind: "cardOrEnchant", cardOrEnchantId: candidate.id, name: candidate.name, socketIndex };
    }

    const withoutTrailingGaps = <Entry>(entries: readonly (Entry | null)[]) => entries.slice(0, entries.findLastIndex((entry) => entry !== null) + 1);
    const filledSockets = withoutTrailingGaps(sockets);
    const filledOptions = withoutTrailingGaps(randomOptions);
    const gearPiece: GearPiece = {
        itemId,
        ...(refine === null ? {} : { refine }),
        ...(transcendence === null ? {} : { transcendence }),
        ...(filledSockets.length === 0 ? {} : { sockets: filledSockets }),
        ...(filledOptions.length === 0 ? {} : { randomOptions: filledOptions }),
        ...(element === null ? {} : { element }),
    };
    return { lines: lines.map((line, index) => ({ text: line, reading: readings[index] ?? { kind: "notUnderstood", reason: "unknownEffect" } })), gearPiece };
}

/** The item a line names: by its exact name, and by its card slot count where several share the name. */
function itemOfLine(name: string, socketCount: number | null, catalog: EngineCatalog): { readonly id: number; readonly name: string } | undefined {
    const nameKey = nameKeyOf(name);
    if (nameKey === "") {
        return undefined;
    }
    const named = catalog.itemsNamed(nameKey);
    return named.find((item) => socketCount !== null && item.socketCount === socketCount) ?? named[0];
}

interface CardCandidate {
    readonly socketIndex: number;
    readonly id: number;
    readonly name: string;
}

interface CardLine {
    readonly index: number;
    /** Each socket that takes something of the line's name, with what it takes. */
    readonly candidates: readonly CardCandidate[];
}

function cardCandidatesOf(line: string, socketChoices: readonly (readonly CatalogEntry[])[]): CardCandidate[] {
    const lineKey = cardNameKeyOf(line);
    return socketChoices.flatMap((choices, socketIndex) => {
        const choice = choices.find((candidate) => cardNameKeyOf(candidate.name) === lineKey);
        return choice === undefined ? [] : [{ socketIndex, id: choice.id, name: choice.name }];
    });
}

/**
 * Puts each card or enchant line into a socket that takes it, placing as
 * many as there is room for: an enchant that fits only the last socket
 * keeps it even when the listing names it after one that fits several.
 * Among equally full placements, the lines take sockets in their order.
 */
function placeCards(cardLines: readonly CardLine[], socketCount: number): Map<number, number> {
    let best = new Map<number, number>();
    const placed = new Map<number, number>();
    const taken: boolean[] = Array.from({ length: socketCount }, () => false);
    function place(lineIndex: number) {
        if (placed.size > best.size) {
            best = new Map(placed);
        }
        const cardLine = cardLines[lineIndex];
        if (cardLine === undefined || best.size === cardLines.length) {
            return;
        }
        for (const { socketIndex } of cardLine.candidates) {
            if (!taken[socketIndex]) {
                taken[socketIndex] = true;
                placed.set(cardLine.index, socketIndex);
                place(lineIndex + 1);
                placed.delete(cardLine.index);
                taken[socketIndex] = false;
            }
        }
        place(lineIndex + 1);
    }
    place(0);
    return best;
}

/** The option whose own wording, at the line's value, is about what the line is about, put in the first free position that rolls it. */
function readOptionLine(
    line: string,
    value: number | null,
    catalog: EngineCatalog,
    optionChoices: readonly (readonly CatalogEntry[])[],
    randomOptions: ({ optionId: number; value: number } | null)[],
    isWeapon: boolean,
): ListingLineReading | undefined {
    const features = effectFeaturesOf(line);
    if (features.length === 0) {
        return undefined;
    }
    const offered = new Map(optionChoices.flat().map((choice) => [choice.id, choice]));
    const givenElement = features.includes("付与") ? features.find((feature) => feature.startsWith("element:"))?.slice("element:".length) : undefined;
    if (givenElement !== undefined) {
        const element = catalog.weaponElements().find((candidate) => candidate.name === givenElement);
        if (isWeapon && element !== undefined) {
            return { kind: "weaponElement", elementId: element.id, name: element.name };
        }
        // The calculator does not count an element given to armor; the original marks such an option as not supported, and the piece keeps that mark.
        const notSupported = [...offered.values()].find((choice) => choice.name.startsWith("※未対応"));
        return notSupported === undefined ? { kind: "notUnderstood", reason: "elementOnNonWeapon" } : placeOption(notSupported.id, notSupported.range?.highest ?? 1, optionChoices, randomOptions);
    }
    const featuresKey = features.join("|");
    // A line without a number is an option that is on or off ("絶対に壊れない"), whose value is its highest.
    const valueOf = (choice: CatalogEntry) => value ?? choice.range?.highest ?? 1;
    const [best] = [...offered.values()]
        .filter((choice) => value !== null || (choice.range?.highest ?? 1) <= 1)
        .map((choice) => ({ choice, wording: catalog.wordingOfRandomOption(choice.id, valueOf(choice)) }))
        .filter(({ wording }) => effectFeaturesOf(wording).join("|") === featuresKey)
        .sort((one, other) => characterSimilarity(other.wording, line) - characterSimilarity(one.wording, line));
    if (best === undefined) {
        return undefined;
    }
    return placeOption(best.choice.id, valueOf(best.choice), optionChoices, randomOptions);
}

/** The option put in the first free position that rolls it at the value. */
function placeOption(
    optionId: number,
    value: number,
    optionChoices: readonly (readonly CatalogEntry[])[],
    randomOptions: ({ optionId: number; value: number } | null)[],
): ListingLineReading {
    let isOfferedAtThisValue = false;
    for (const [positionIndex, choices] of optionChoices.entries()) {
        const choice = choices.find((candidate) => candidate.id === optionId);
        if (choice === undefined || (choice.range !== undefined && (value < choice.range.lowest || value > choice.range.highest))) {
            continue;
        }
        isOfferedAtThisValue = true;
        if (randomOptions[positionIndex] === null) {
            randomOptions[positionIndex] = { optionId: choice.id, value };
            return { kind: "randomOption", optionId: choice.id, name: choice.name, value, positionIndex };
        }
    }
    return { kind: "notUnderstood", reason: isOfferedAtThisValue ? "noRoomLeft" : "valueNotOffered" };
}
