import type { EquipmentSlot } from "../character-vocabulary.ts";
import { applyChange } from "../tree/apply-change.ts";
import { firstUnusedId } from "./add-to-workspace.ts";
import { gearPieceOf, UnknownWorkspaceEntryError } from "./resolve-workspace.ts";
import type { LockerPiece, Workspace, WorkspaceChange, WorkspaceTreeNode } from "./workspace-format.ts";

/** Why a refine, transcendence or socket change could not be written into the locker. */
export type CommitSkipReason = "slotHoldsNoLockerPiece" | "slotHoldsAnotherItem";

export interface LockerCommit {
    readonly workspace: Workspace;
    /** The changes written into locker pieces and removed from their nodes. */
    readonly committedChanges: readonly WorkspaceChange[];
    readonly skippedChanges: readonly { readonly change: WorkspaceChange; readonly reason: CommitSkipReason }[];
}

type PieceChange = Extract<WorkspaceChange, { kind: "setRefine" | "setTranscendence" | "setSocket" }>;

const isPieceChange = (change: WorkspaceChange): change is PieceChange =>
    change.kind === "setRefine" || change.kind === "setTranscendence" || change.kind === "setSocket";

/**
 * Makes the gear state of a node the new baseline: every refine,
 * transcendence and socket change on the way from the root to the node is
 * written into the locker piece it touches and removed from its node. A
 * whole piece a node holds is written the same way when the slot holds a
 * locker piece of the same item; a piece of another item is added to the
 * locker as owned, and the node then wears it from there.
 *
 * The whole path is committed, not the node alone, because a later step
 * builds on the earlier ones. Everything that wears those pieces sees the
 * change. Changes of other kinds, and changes to pieces that are not in the
 * locker, stay where they are.
 *
 * @throws {UnknownWorkspaceEntryError} when the workspace has no such tree.
 */
export function commitNodeToLocker(workspace: Workspace, treeId: string, nodeId: string): LockerCommit {
    const tree = workspace.trees[treeId];
    const character = tree === undefined ? undefined : workspace.characters[tree.characterId];
    if (tree === undefined || character === undefined) {
        throw new UnknownWorkspaceEntryError("tree", treeId);
    }

    const gearPieces: Record<string, LockerPiece> = { ...workspace.gearPieces };
    const lockerPieceIdOfSlot: Partial<Record<EquipmentSlot, string>> = { ...character.equipment };
    const committedChanges: WorkspaceChange[] = [];
    const skippedChanges: { change: WorkspaceChange; reason: CommitSkipReason }[] = [];
    const remainingChangesOfNodeId = new Map<string, WorkspaceChange[]>();

    for (const node of pathTo(tree.nodes, nodeId)) {
        const remainingChanges: WorkspaceChange[] = [];
        for (const change of node.changes) {
            if (change.kind === "equipLockerPiece") {
                lockerPieceIdOfSlot[change.slot] = change.gearPieceId;
            } else if (change.kind === "setGearPiece" && change.gearPiece === null) {
                delete lockerPieceIdOfSlot[change.slot];
            } else if (change.kind === "setGearPiece" && change.gearPiece !== null) {
                const wholePiece = change.gearPiece;
                const heldPieceId = lockerPieceIdOfSlot[change.slot];
                const heldPiece = heldPieceId === undefined ? undefined : gearPieces[heldPieceId];
                if (heldPieceId !== undefined && heldPiece?.itemId === wholePiece.itemId) {
                    // The same thing, refined or carded: the locker piece takes its new state and the node has nothing left to say.
                    gearPieces[heldPieceId] = { ...wholePiece, owned: heldPiece.owned };
                } else {
                    // Another item: it joins the locker as owned, and the node wears it from there.
                    const addedPieceId = firstUnusedId(gearPieces, change.slot);
                    gearPieces[addedPieceId] = { ...wholePiece, owned: true };
                    lockerPieceIdOfSlot[change.slot] = addedPieceId;
                    remainingChanges.push({ kind: "equipLockerPiece", slot: change.slot, gearPieceId: addedPieceId });
                }
                committedChanges.push(change);
                continue;
            }
            if (!isPieceChange(change)) {
                remainingChanges.push(change);
                continue;
            }
            const lockerPieceId = lockerPieceIdOfSlot[change.slot];
            const lockerPiece = lockerPieceId === undefined ? undefined : gearPieces[lockerPieceId];
            if (lockerPieceId === undefined || lockerPiece === undefined) {
                skippedChanges.push({ change, reason: "slotHoldsNoLockerPiece" });
                remainingChanges.push(change);
                continue;
            }
            const changedPiece = pieceAfter(lockerPiece, change);
            if (changedPiece === undefined) {
                skippedChanges.push({ change, reason: "slotHoldsAnotherItem" });
                remainingChanges.push(change);
                continue;
            }
            gearPieces[lockerPieceId] = changedPiece;
            committedChanges.push(change);
        }
        remainingChangesOfNodeId.set(node.id, remainingChanges);
    }

    const nodes = tree.nodes.map((node) => {
        const remainingChanges = remainingChangesOfNodeId.get(node.id);
        return remainingChanges === undefined ? node : { ...node, changes: remainingChanges };
    });
    return {
        workspace: { ...workspace, gearPieces, trees: { ...workspace.trees, [treeId]: { ...tree, nodes } } },
        committedChanges,
        skippedChanges,
    };
}

function pathTo(nodes: readonly WorkspaceTreeNode[], nodeId: string): WorkspaceTreeNode[] {
    const nodeOfId = new Map(nodes.map((node) => [node.id, node]));
    const path: WorkspaceTreeNode[] = [];
    for (let node = nodeOfId.get(nodeId); node !== undefined; node = nodeOfId.get(node.parentId ?? "")) {
        path.unshift(node);
    }
    return path;
}

/** The locker piece with the change applied, or `undefined` when the change was made for another item. */
function pieceAfter(lockerPiece: LockerPiece, change: PieceChange): LockerPiece | undefined {
    const wearingOnlyThisPiece = {
        jobId: 0,
        baseLevel: 1,
        jobLevel: 1,
        baseStats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 },
        equipment: { [change.slot]: gearPieceOf(lockerPiece) },
    };
    const application = applyChange(wearingOnlyThisPiece, change);
    const changedPiece = application.applied ? application.character.equipment[change.slot] : undefined;
    return changedPiece === undefined ? undefined : { ...changedPiece, owned: lockerPiece.owned };
}
