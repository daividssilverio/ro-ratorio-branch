/**
 * Builds, trees and workspaces saved while the engine was pinned to an
 * earlier upstream commit, brought up to the names and options upstream uses
 * now. Each old shape is told apart by the content itself, so content that is
 * already current comes back as the very same object. Runs on the raw
 * content, before it is checked against its format.
 */
export function withEarlierUpstreamContentUpdated(candidate: unknown): unknown {
    if (!isRecord(candidate)) {
        return candidate;
    }
    return withFieldsUpdated(candidate, {
        character: characterUpdated,
        root: characterUpdated,
        scenario: scenarioUpdated,
        nodes: (nodes) => (Array.isArray(nodes) ? sameUnlessChanged(nodes, nodes.map(nodeUpdated)) : nodes),
        characters: (characters) => (isRecord(characters) ? withEveryValueUpdated(characters, characterUpdated) : characters),
        trees: (trees) => (isRecord(trees) ? withEveryValueUpdated(trees, withEarlierUpstreamContentUpdated) : trees),
    });
}

/** Support buffs upstream renamed, by their old name. Upstream 47f40e3 corrected the spelling of Competentia. */
const renamedSupportBuffs: Readonly<Record<string, string>> = { CONPETENTIA: "COMPETENTIA" };

/**
 * Attack options upstream reordered or removed, by the skill they belong to:
 * how many values a scenario made before held, and the values it holds now.
 */
const reshapedSkillOptions: Readonly<Record<number, { readonly earlierCount: number; readonly now: (earlier: readonly unknown[]) => unknown[] }>> = {
    // Lex Expiatrix: the Competentia option went; the engine reads the Competentia support buff instead.
    1407: { earlierCount: 2, now: (earlier) => earlier.slice(0, 1) },
    // Overdrive Protocol: ABR Dual Cannon came in front of ABR Infinity.
    1412: { earlierCount: 1, now: (earlier) => [0, ...earlier] },
};

function characterUpdated(character: unknown): unknown {
    if (!isRecord(character)) {
        return character;
    }
    return withFieldsUpdated(character, {
        supportBuffs: (supportBuffs) =>
            isRecord(supportBuffs) && Object.keys(supportBuffs).some((name) => renamedSupportBuffs[name] !== undefined)
                ? Object.fromEntries(Object.entries(supportBuffs).map(([name, level]) => [renamedSupportBuffs[name] ?? name, level]))
                : supportBuffs,
    });
}

function scenarioUpdated(scenario: unknown): unknown {
    if (!isRecord(scenario)) {
        return scenario;
    }
    const reshaped = typeof scenario["skillId"] === "number" ? reshapedSkillOptions[scenario["skillId"]] : undefined;
    const options = scenario["skillOptions"];
    if (reshaped === undefined || !Array.isArray(options) || options.length !== reshaped.earlierCount) {
        return scenario;
    }
    return { ...scenario, skillOptions: reshaped.now(options) };
}

function nodeUpdated(node: unknown): unknown {
    if (!isRecord(node) || !Array.isArray(node["changes"])) {
        return node;
    }
    const earlierChanges: readonly unknown[] = node["changes"];
    const changes = earlierChanges.map((change) =>
        isRecord(change) && change["kind"] === "setSupportBuff" && typeof change["name"] === "string" && renamedSupportBuffs[change["name"]] !== undefined
            ? { ...change, name: renamedSupportBuffs[change["name"]] }
            : change,
    );
    return sameUnlessChanged(earlierChanges, changes) === earlierChanges ? node : { ...node, changes };
}

function withFieldsUpdated(record: Record<string, unknown>, updateOfField: Readonly<Record<string, (value: unknown) => unknown>>): Record<string, unknown> {
    const updatedFields = Object.entries(updateOfField)
        .filter(([field]) => field in record)
        .map(([field, update]) => [field, update(record[field])] as const)
        .filter(([field, value]) => value !== record[field]);
    return updatedFields.length === 0 ? record : { ...record, ...Object.fromEntries(updatedFields) };
}

function withEveryValueUpdated(record: Record<string, unknown>, update: (value: unknown) => unknown): Record<string, unknown> {
    return withFieldsUpdated(record, Object.fromEntries(Object.keys(record).map((key) => [key, update])));
}

function sameUnlessChanged(earlier: readonly unknown[], updated: unknown[]): readonly unknown[] {
    return updated.some((value, index) => value !== earlier[index]) ? updated : earlier;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
