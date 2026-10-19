import type { GearPiece } from "@ro-ratorio-branch/core/platform-neutral";
import type { Descriptions } from "../engine-host/host-protocol.ts";
import { cardOrEnchantNameIn, itemNameIn, randomOptionTextIn } from "./labels.ts";

/**
 * A piece as text, one thing per line, in the order a market listing of the
 * official tool gives it: the transcendence, the item with its refine, then
 * its cards and enchants and its random options.
 */
export function pieceTextIn(descriptions: Descriptions, piece: Pick<GearPiece, "itemId" | "refine" | "transcendence" | "sockets" | "randomOptions">): string {
    const lines = [
        ...(piece.transcendence === undefined || piece.transcendence === 0 ? [] : [`超越段階 ★${piece.transcendence}`]),
        `${piece.refine === undefined || piece.refine === 0 ? "" : `+${piece.refine} `}${itemNameIn(descriptions, piece.itemId)}`,
        ...(piece.sockets ?? []).flatMap((cardOrEnchantId) => (cardOrEnchantId === null ? [] : [cardOrEnchantNameIn(descriptions, cardOrEnchantId)])),
        ...(piece.randomOptions ?? []).flatMap((randomOption) => (randomOption === null ? [] : [randomOptionTextIn(descriptions, randomOption)])),
    ];
    return lines.join("\n");
}
