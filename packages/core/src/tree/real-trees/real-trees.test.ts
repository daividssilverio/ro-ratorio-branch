import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { buildOfNode } from "../../agent/choice-ranking.ts";
import { parseBuild } from "../../build/parse-build.ts";
import { loadRatorioEngine } from "../../engine-adapter/load-ratorio-engine-in-node.ts";
import { decodeShareCode } from "../../sharing/share-code.ts";
import { calculatorOn, evaluateTree, type TreeEvaluation } from "../evaluate-tree.ts";
import { parseTree } from "../parse-tree.ts";

const fixture = (fileName: string) => readFileSync(new URL(`./${fileName}`, import.meta.url), "utf8");

/**
 * A tree a player keeps for a real character: a Spirit Handler and some 190
 * upgrade paths across every slot, made in the app and shared as a build code.
 * The damage reference was calculated by this project on the pinned engine
 * when the tree was added: it tells when a number moves, and a moved number is
 * traced before the reference changes. Five of its builds are also golden
 * builds, checked against the original page.
 */
describe("a real character's upgrade tree", () => {
    const tree = parseTree(JSON.parse(fixture("spirit-handler-upgrades.tree.json")));
    const reference = JSON.parse(fixture("spirit-handler-upgrades.damage-per-second.json")) as { root: number; nodes: Record<string, number> };
    let evaluation: TreeEvaluation;

    beforeAll(async () => {
        evaluation = await evaluateTree(tree, calculatorOn(await loadRatorioEngine()));
    });

    it("reads back from the build code the app shared it as", async () => {
        expect(await decodeShareCode(fixture("spirit-handler-upgrades.build-code.txt").trim())).toEqual({ kind: "tree", tree });
    });

    it("calculates its root and every node", () => {
        const statesOfNodes = [...evaluation.nodes.values()].map((node) => node.state);

        expect(evaluation.root.state).toBe("ready");
        expect(statesOfNodes).toHaveLength(tree.nodes.length);
        expect(statesOfNodes.every((state) => state === "ready")).toBe(true);
    });

    it.each([
        { goldenBuild: "spirit-handler-tiger-slash", nodeId: null },
        { goldenBuild: "spirit-handler-everything-plus5", nodeId: "branch-7" },
        { goldenBuild: "spirit-handler-abyss-armor", nodeId: "armor8-5483-ghost" },
        { goldenBuild: "spirit-handler-constellation-seal", nodeId: "shoes8-5222-seal-5003" },
        { goldenBuild: "spirit-handler-satan-fox-tail", nodeId: "rightHand7-5638" },
    ])("has the golden build $goldenBuild as the build of $nodeId, the root for null", ({ goldenBuild, nodeId }) => {
        const golden = parseBuild(JSON.parse(readFileSync(new URL(`../../build/golden-builds/${goldenBuild}.build.json`, import.meta.url), "utf8")));

        expect(buildOfNode(tree, nodeId)).toEqual(golden);
    });

    it("deals the damage per second it dealt when it was added, root and every node", () => {
        const damagePerSecondOf = (state: TreeEvaluation["root"] | undefined) => (state?.state === "ready" ? state.battleSummary.averageDamagePerSecond : null);
        const calculated = Object.fromEntries(tree.nodes.map((node) => [node.id, damagePerSecondOf(evaluation.nodes.get(node.id) as TreeEvaluation["root"] | undefined)]));

        expect(damagePerSecondOf(evaluation.root)).toBe(reference.root);
        expect(calculated).toEqual(reference.nodes);
    });
});
