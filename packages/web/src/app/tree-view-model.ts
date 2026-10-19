import type { NodeComparison, RankingMetric, Tree, TreeComparison, TreeNode } from "@ro-ratorio-branch/core/platform-neutral";

export type ReadyNodeComparison = Extract<NodeComparison, { state: "ready" }>;

/** One line of the tree screen: a node, how deep it sits, and whether nodes hang under it. */
export interface TreeRow {
    readonly node: TreeNode;
    readonly comparison: NodeComparison;
    /** 1 for a node directly under the root. */
    readonly depth: number;
    readonly hasChildren: boolean;
}

/**
 * The nodes in display order: each node followed by its descendants, siblings
 * in the order of the given ranking. Nodes without numbers come after their
 * ranked siblings, in file order.
 */
export function treeRowsOf(tree: Tree, comparison: TreeComparison, siblingOrder: RankingMetric): TreeRow[] {
    const comparisonOfNodeId = new Map(comparison.nodes.map((nodeComparison) => [nodeComparison.id, nodeComparison]));
    const rankOfNodeId = new Map(comparison.rankings[siblingOrder].map((nodeId, rank) => [nodeId, rank]));
    const childrenOfParentId = new Map<string | null, TreeNode[]>();
    for (const node of tree.nodes) {
        childrenOfParentId.set(node.parentId, [...(childrenOfParentId.get(node.parentId) ?? []), node]);
    }
    const unranked = Number.MAX_SAFE_INTEGER;

    const rows: TreeRow[] = [];
    function addChildrenOf(parentId: string | null, depth: number): void {
        const children = [...(childrenOfParentId.get(parentId) ?? [])].sort(
            (first, second) => (rankOfNodeId.get(first.id) ?? unranked) - (rankOfNodeId.get(second.id) ?? unranked),
        );
        for (const node of children) {
            const nodeComparison = comparisonOfNodeId.get(node.id);
            if (nodeComparison === undefined) {
                continue;
            }
            rows.push({ node, comparison: nodeComparison, depth, hasChildren: childrenOfParentId.has(node.id) });
            addChildrenOf(node.id, depth + 1);
        }
    }
    addChildrenOf(null, 1);
    return rows;
}

/** The order of a node's branches: as they were made, or best first by a ranking. */
export type SiblingOrder = "created" | RankingMetric;

export const siblingOrders: readonly SiblingOrder[] = ["created", "damagePerSecondGain", "secondsToKill", "valueForMoney"];

/** Which change a row shows: against the root (total), against the node it builds on (step), or both. */
export type GainDisplay = "total" | "step" | "both";

export const gainDisplays: readonly GainDisplay[] = ["total", "step", "both"];

/** A change in the numbers, against some base. */
export interface Gain {
    readonly damagePerSecondChange: number;
    /** What the change is a share of. */
    readonly damagePerSecondBase: number;
    /** Negative is faster. `null` when either side kills nothing. */
    readonly secondsToKillChange: number | null;
}

export interface RowGains {
    /** Against the root. */
    readonly total: Gain | null;
    /** Against the node it builds on, the root for a top-level node. Steps multiply: +10% then +3% is +13.3% in total. */
    readonly step: Gain | null;
}

/** A node's change against the root and against its parent; `null` where either side has no numbers. */
export function gainsOf(node: TreeNode, comparison: TreeComparison): RowGains {
    const own = comparison.nodes.find((nodeComparison) => nodeComparison.id === node.id);
    if (own?.state !== "ready") {
        return { total: null, step: null };
    }
    const rootSummary = comparison.root.state === "ready" ? comparison.root.battleSummary : null;
    const parent = node.parentId === null ? undefined : comparison.nodes.find((nodeComparison) => nodeComparison.id === node.parentId);
    const parentSummary = node.parentId === null ? rootSummary : parent?.state === "ready" ? parent.battleSummary : null;
    const gainOver = (base: typeof rootSummary): Gain | null => {
        if (base === null) {
            return null;
        }
        const seconds = own.battleSummary.averageTimeToKill?.seconds;
        const baseSeconds = base.averageTimeToKill?.seconds;
        return {
            damagePerSecondChange: own.battleSummary.averageDamagePerSecond - base.averageDamagePerSecond,
            damagePerSecondBase: base.averageDamagePerSecond,
            secondsToKillChange: seconds === undefined || baseSeconds === undefined ? null : seconds - baseSeconds,
        };
    };
    return { total: gainOver(rootSummary), step: gainOver(parentSummary) };
}

/** The rows that stay visible when the given nodes are collapsed: everything below a collapsed node is left out. */
export function withoutCollapsedBranches(rows: readonly TreeRow[], collapsedNodeIds: ReadonlySet<string>): TreeRow[] {
    const visibleRows: TreeRow[] = [];
    let hiddenBelowDepth: number | null = null;
    for (const row of rows) {
        if (hiddenBelowDepth !== null && row.depth > hiddenBelowDepth) {
            continue;
        }
        hiddenBelowDepth = collapsedNodeIds.has(row.node.id) ? row.depth : null;
        visibleRows.push(row);
    }
    return visibleRows;
}

/** One card of the ranking screen. */
export interface RankingCard {
    readonly rank: number;
    readonly comparison: ReadyNodeComparison;
    /** The labels of the nodes from the root down to this one. */
    readonly pathLabels: readonly string[];
    /** This node's damage gain as a share of the largest gain shown, 0 to 1. */
    readonly gainShareOfBest: number;
}

/** The leaves with numbers, best first for the metric. */
export function rankingCardsOf(tree: Tree, comparison: TreeComparison, metric: RankingMetric): RankingCard[] {
    const nodeOfId = new Map(tree.nodes.map((node) => [node.id, node]));
    const comparisonOfNodeId = new Map(comparison.nodes.map((nodeComparison) => [nodeComparison.id, nodeComparison]));
    const rankedLeaves = comparison.rankings[metric].flatMap((nodeId): ReadyNodeComparison[] => {
        const nodeComparison = comparisonOfNodeId.get(nodeId);
        return nodeComparison?.state === "ready" && nodeComparison.isLeaf ? [nodeComparison] : [];
    });
    const largestGain = Math.max(0, ...rankedLeaves.map((leaf) => leaf.damagePerSecondGain));

    return rankedLeaves.map((leaf, index) => {
        const pathLabels: string[] = [];
        for (let node = nodeOfId.get(leaf.id); node !== undefined; node = nodeOfId.get(node.parentId ?? "")) {
            pathLabels.unshift(node.label);
        }
        return {
            rank: index + 1,
            comparison: leaf,
            pathLabels,
            gainShareOfBest: largestGain === 0 ? 0 : Math.max(0, leaf.damagePerSecondGain) / largestGain,
        };
    });
}

/** The nodes left out of every ranking because a change in them no longer fits. */
export function staleNodesOf(comparison: TreeComparison): NodeComparison[] {
    return comparison.nodes.filter((nodeComparison) => nodeComparison.state === "stale");
}

/** Every ID in the tree that the screens show by name. */
export function idsShownIn(tree: Tree) {
    const itemIds = new Set<number>();
    const cardOrEnchantIds = new Set<number>();
    const randomOptionIds = new Set<number>();
    const gearPieces = [
        ...Object.values(tree.root.equipment),
        ...tree.nodes.flatMap((node) =>
            node.changes.flatMap((change) => (change.kind === "setGearPiece" && change.gearPiece !== null ? [change.gearPiece] : [])),
        ),
    ];
    for (const gearPiece of gearPieces) {
        itemIds.add(gearPiece.itemId);
        for (const randomOption of gearPiece.randomOptions ?? []) {
            if (randomOption !== null) {
                randomOptionIds.add(randomOption.optionId);
            }
        }
        for (const cardOrEnchantId of gearPiece.sockets ?? []) {
            if (cardOrEnchantId !== null) {
                cardOrEnchantIds.add(cardOrEnchantId);
            }
        }
    }
    for (const node of tree.nodes) {
        for (const change of node.changes) {
            if (change.kind === "setSocket" && change.cardOrEnchantId !== null) {
                cardOrEnchantIds.add(change.cardOrEnchantId);
            }
        }
    }
    return {
        jobIds: [tree.root.jobId],
        skillIds: [tree.scenario.skillId],
        monsterIds: [tree.scenario.targetMonsterId],
        itemIds: [...itemIds],
        cardOrEnchantIds: [...cardOrEnchantIds],
        randomOptionIds: [...randomOptionIds],
    };
}

export type TreeGuide = "through" | "none" | "branch" | "last";

/** One node of a tree as a single line: enough to tell the nodes apart and to see which is ahead. */
export interface TreeLine {
    readonly nodeId: string;
    readonly label: string;
    /** 1 for a node directly under the root. */
    readonly depth: number;
    /**
     * What to draw in front of the line, one piece per level down to the
     * node's own, so that the lines of a tree show which node hangs off
     * which: for a level above, whether its line runs on past this node
     * (`through`) or has ended (`none`); for the node's own level, whether
     * more nodes follow under the same parent (`branch`) or this is the
     * last (`last`).
     */
    readonly guides: readonly TreeGuide[];
    /** `pending` until the tree has been calculated. */
    readonly state: NodeComparison["state"] | "pending";
    /** Whether nodes hang under it, so that it can be folded. */
    readonly hasChildren: boolean;
    /** Against the root and against its parent; none until the tree has been calculated. */
    readonly gains: RowGains;
}

/**
 * Every node on a line of its own, each followed by the nodes that build
 * on it, in the order the tree holds them: a line stays where it is while
 * its numbers change.
 */
export function treeLinesOf(tree: Tree, comparison: TreeComparison | null, siblingOrder: SiblingOrder = "created"): TreeLine[] {
    const comparisonOfNodeId = new Map((comparison?.nodes ?? []).map((nodeComparison) => [nodeComparison.id, nodeComparison]));
    const rankOfNodeId = new Map(siblingOrder === "created" || comparison === null ? [] : comparison.rankings[siblingOrder].map((nodeId, rank) => [nodeId, rank]));
    const unranked = Number.MAX_SAFE_INTEGER;
    const lines: TreeLine[] = [];
    function addChildrenOf(parentId: string | null, guidesAbove: readonly TreeGuide[]): void {
        // A stable sort: nodes without numbers, and every node in the order they were made, keep the tree's order.
        const children = tree.nodes
            .filter((node) => node.parentId === parentId)
            .sort((first, second) => (rankOfNodeId.get(first.id) ?? unranked) - (rankOfNodeId.get(second.id) ?? unranked));
        children.forEach((node, index) => {
            const isLast = index === children.length - 1;
            const nodeComparison = comparisonOfNodeId.get(node.id);
            lines.push({
                nodeId: node.id,
                label: node.label,
                depth: guidesAbove.length + 1,
                guides: [...guidesAbove, isLast ? "last" : "branch"],
                state: nodeComparison?.state ?? "pending",
                hasChildren: tree.nodes.some((candidate) => candidate.parentId === node.id),
                gains: comparison === null ? { total: null, step: null } : gainsOf(node, comparison),
            });
            addChildrenOf(node.id, [...guidesAbove, isLast ? "none" : "through"]);
        });
    }
    addChildrenOf(null, []);
    return lines;
}

/** A tap on something, to tell a double tap by. */
/** The lines that stay visible when the given nodes are folded: everything below a folded node is left out. */
export function linesShown(lines: readonly TreeLine[], foldedNodeIds: ReadonlySet<string>): TreeLine[] {
    const shown: TreeLine[] = [];
    let foldedDepth: number | null = null;
    for (const line of lines) {
        if (foldedDepth !== null && line.depth > foldedDepth) {
            continue;
        }
        foldedDepth = foldedNodeIds.has(line.nodeId) ? line.depth : null;
        shown.push(line);
    }
    return shown;
}

export interface Tap {
    readonly target: string;
    readonly timeInMilliseconds: number;
}

/** How long after a tap a second one on the same thing still makes a double tap. */
export const doubleTapWindowInMilliseconds = 400;

/** Whether a tap follows the one before it closely enough, on the same thing, to be the second half of a double tap. */
export function isSecondTapOfDouble(previousTap: Tap | null, tap: Tap): boolean {
    return previousTap !== null && previousTap.target === tap.target && tap.timeInMilliseconds - previousTap.timeInMilliseconds < doubleTapWindowInMilliseconds;
}
