import { describe, expect, it } from "vitest";
import { parseTree } from "../tree/parse-tree.ts";
import type { Tree } from "../tree/tree-format.ts";
import { parseWorkspace } from "../workspace/parse-workspace.ts";
import { mechanicWorkspaceWith, workspaceNode } from "../workspace/workspace-test-support.ts";
import type { Build, Scenario } from "./build-format.ts";
import { withEarlierUpstreamContentUpdated } from "./earlier-upstream-content.ts";
import { parseBuild } from "./parse-build.ts";

const lexExpiatrixSkillId = 1407;
const overdriveProtocolSkillId = 1412;

function buildWith(supportBuffs: Record<string, number>, scenario: Scenario): Build {
    return {
        formatVersion: 1,
        character: {
            jobId: 51,
            baseLevel: 200,
            jobLevel: 70,
            baseStats: { str: 110, agi: 110, vit: 100, int: 100, dex: 110, luk: 78 },
            supportBuffs,
            equipment: {},
        },
        scenario,
    };
}

const tigerSlash = { skillId: 1221, skillLevel: 7, targetMonsterId: 2373 } satisfies Scenario;

describe("content saved on an earlier upstream commit", () => {
    it("takes the Competentia support buff under its corrected name", () => {
        const build = parseBuild(buildWith({ BLESSING: 10, CONPETENTIA: 5 }, tigerSlash));

        expect(build.character.supportBuffs).toEqual({ BLESSING: 10, COMPETENTIA: 5 });
    });

    it("gives Overdrive Protocol's ABR Infinity option its new place after ABR Dual Cannon", () => {
        const build = parseBuild(buildWith({}, { skillId: overdriveProtocolSkillId, skillLevel: 5, skillOptions: [3], targetMonsterId: 2373 }));

        expect(build.scenario.skillOptions).toEqual([0, 3]);
    });

    it("drops Lex Expiatrix's Competentia option, which upstream now reads from the support buff", () => {
        const build = parseBuild(buildWith({}, { skillId: lexExpiatrixSkillId, skillLevel: 10, skillOptions: [2, 1], targetMonsterId: 2373 }));

        expect(build.scenario.skillOptions).toEqual([2]);
        expect(build.character.supportBuffs).toEqual({});
    });

    it("leaves content that is already current as it is", () => {
        const currentBuilds = [
            buildWith({ COMPETENTIA: 5 }, tigerSlash),
            buildWith({}, { skillId: overdriveProtocolSkillId, skillLevel: 5, skillOptions: [1, 3], targetMonsterId: 2373 }),
            buildWith({}, { skillId: lexExpiatrixSkillId, skillLevel: 10, skillOptions: [2], targetMonsterId: 2373 }),
        ];

        for (const build of currentBuilds) {
            expect(withEarlierUpstreamContentUpdated(build)).toBe(build);
        }
    });

    it("renames the buff in a tree's root and in the changes of its nodes, and updates its scenario", () => {
        const earlier = buildWith({ CONPETENTIA: 3 }, { skillId: overdriveProtocolSkillId, skillLevel: 5, skillOptions: [2], targetMonsterId: 2373 });
        const tree = parseTree({
            formatVersion: 1,
            root: earlier.character,
            scenario: earlier.scenario,
            nodes: [{ id: "more-competentia", parentId: null, label: "more", changes: [{ kind: "setSupportBuff", name: "CONPETENTIA", value: 5 }] }],
        } satisfies Tree);

        expect(tree.root.supportBuffs).toEqual({ COMPETENTIA: 3 });
        expect(tree.scenario.skillOptions).toEqual([0, 2]);
        expect(tree.nodes[0]?.changes).toEqual([{ kind: "setSupportBuff", name: "COMPETENTIA", value: 5 }]);
    });

    it("renames the buff in a workspace's characters and in its trees' nodes, and updates their scenarios", () => {
        const earlier = mechanicWorkspaceWith([workspaceNode("more-competentia", null, [{ kind: "setSupportBuff", name: "CONPETENTIA", value: 5 }])]);
        const mechanic = earlier.characters["mechanic"];
        const upgrades = earlier.trees["upgrades"];
        if (mechanic === undefined || upgrades === undefined) {
            throw new Error("the test workspace changed");
        }
        const workspace = parseWorkspace({
            ...earlier,
            characters: { mechanic: { ...mechanic, supportBuffs: { CONPETENTIA: 3 } } },
            trees: { upgrades: { ...upgrades, scenario: { skillId: lexExpiatrixSkillId, skillLevel: 10, skillOptions: [1, 1], targetMonsterId: 850 } } },
        });

        expect(workspace.characters["mechanic"]?.supportBuffs).toEqual({ COMPETENTIA: 3 });
        expect(workspace.trees["upgrades"]?.scenario.skillOptions).toEqual([1]);
        expect(workspace.trees["upgrades"]?.nodes[0]?.changes).toEqual([{ kind: "setSupportBuff", name: "COMPETENTIA", value: 5 }]);
    });
});
