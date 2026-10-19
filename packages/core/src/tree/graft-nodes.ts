interface LinkedNode {
    readonly id: string;
    readonly parentId: string | null;
}

export interface GraftedNodes<Node extends LinkedNode> {
    readonly nodes: Node[];
    /** The ID each attached node has now, by the ID it came with. */
    readonly idOf: ReadonlyMap<string, string>;
}

/**
 * The nodes of a tree with others attached under one of them (or under the
 * root for `null`): attached nodes that built on their own root build on that
 * node instead, and one whose ID is already taken gets a free one, which the
 * nodes building on it follow.
 */
export function graftNodes<Node extends LinkedNode>(nodes: readonly Node[], parentId: string | null, attached: readonly Node[]): GraftedNodes<Node> {
    const takenIds = new Set(nodes.map((node) => node.id));
    const idOf = new Map<string, string>();
    for (const node of attached) {
        let id = node.id;
        for (let suffix = 2; takenIds.has(id); suffix++) {
            id = `${node.id}-${suffix}`;
        }
        takenIds.add(id);
        idOf.set(node.id, id);
    }
    const grafted = attached.map((node) => ({ ...node, id: idOf.get(node.id) ?? node.id, parentId: node.parentId === null ? parentId : (idOf.get(node.parentId) ?? node.parentId) }));
    return { nodes: [...nodes, ...grafted], idOf };
}
