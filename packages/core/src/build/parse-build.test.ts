import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildJsonSchema } from "./build-format.ts";
import { type BuildIssue, InvalidBuildError, parseBuild } from "./parse-build.ts";
import { serializePublishedSchema } from "./published-schema.ts";

function minimalBuildCandidate() {
    return {
        formatVersion: 1,
        character: {
            jobId: 51,
            baseLevel: 200,
            jobLevel: 70,
            baseStats: { str: 110, agi: 110, vit: 100, int: 100, dex: 110, luk: 78 },
            equipment: {},
        },
        scenario: { skillId: 554, skillLevel: 5, targetMonsterId: 850 },
    };
}

function fullBuildCandidate() {
    const candidate = minimalBuildCandidate();
    return {
        ...candidate,
        character: {
            ...candidate.character,
            jobName: "メカニック",
            traitStats: { pow: 0, sta: 15, wis: 0, spl: 110, con: 110, crt: 0 },
            learnedSkills: { "554": 5 },
            selfBuffs: { "739": 1 },
            supportBuffs: { BLESSING: 10 },
            timedItems: [143, 152],
            speedPotion: 3,
            equipment: {
                rightHand: {
                    itemId: 4411,
                    name: "メロンメイス",
                    refine: 9,
                    transcendence: 4,
                    sockets: [null, 659, 1381, 1297],
                    note: "main weapon",
                    zenyCost: 120_000_000,
                },
                shield: { itemId: 4936, refine: 7, sockets: [1262] },
            },
        },
        scenario: { ...candidate.scenario, skillOptions: [1], skillName: "アームズキャノン", targetMonsterName: "fff・ジターバグ" },
    };
}

function issuesOf(candidate: unknown): readonly BuildIssue[] {
    try {
        parseBuild(candidate);
    } catch (error) {
        if (error instanceof InvalidBuildError) {
            return error.issues;
        }
        throw error;
    }
    return [];
}

describe("parseBuild", () => {
    it("accepts a build with only the required fields", () => {
        const candidate = minimalBuildCandidate();

        expect(parseBuild(candidate)).toBe(candidate);
    });

    it("accepts a build that uses every field", () => {
        const candidate = fullBuildCandidate();

        expect(parseBuild(candidate)).toBe(candidate);
    });

    it("throws InvalidBuildError for something that is not a build", () => {
        expect(() => parseBuild("not a build")).toThrow(InvalidBuildError);
    });

    it("names a missing required field by its path", () => {
        const { jobId: _removed, ...characterWithoutJob } = minimalBuildCandidate().character;
        const candidate = { ...minimalBuildCandidate(), character: characterWithoutJob };

        expect(issuesOf(candidate)).toEqual([{ path: "/character/jobId", kind: "missing", rule: "required" }]);
    });

    it("names a misspelled field as unexpected instead of ignoring it", () => {
        const candidate = minimalBuildCandidate();
        Object.assign(candidate.character, { speedPotoin: 3 });

        expect(issuesOf(candidate)).toEqual([
            { path: "/character/speedPotoin", kind: "unexpected", rule: "additionalProperties" },
        ]);
    });

    it("rejects a format version it does not know", () => {
        const candidate = { ...minimalBuildCandidate(), formatVersion: 2 };

        expect(issuesOf(candidate)).toEqual([{ path: "/formatVersion", kind: "invalid", rule: "const" }]);
    });

    it("rejects a base stat below 1", () => {
        const candidate = minimalBuildCandidate();
        candidate.character.baseStats.str = 0;

        expect(issuesOf(candidate)).toEqual([{ path: "/character/baseStats/str", kind: "invalid", rule: "minimum" }]);
    });

    it("rejects an equipment slot that does not exist", () => {
        const candidate = minimalBuildCandidate();
        Object.assign(candidate.character.equipment, { tail: { itemId: 1 } });

        expect(issuesOf(candidate)).toEqual([
            { path: "/character/equipment/tail", kind: "unexpected", rule: "additionalProperties" },
        ]);
    });

    it("rejects a gear piece with more than four sockets", () => {
        const candidate = minimalBuildCandidate();
        Object.assign(candidate.character.equipment, { rightHand: { itemId: 4411, sockets: [1, 2, 3, 4, 5] } });

        expect(issuesOf(candidate)).toEqual([
            { path: "/character/equipment/rightHand/sockets", kind: "invalid", rule: "maxItems" },
        ]);
    });

    it("rejects a learned skill keyed by something other than a skill ID", () => {
        const candidate = minimalBuildCandidate();
        Object.assign(candidate.character, { learnedSkills: { armsCannon: 5 } });

        expect(issuesOf(candidate)).toEqual([
            { path: "/character/learnedSkills/armsCannon", kind: "unexpected", rule: "additionalProperties" },
        ]);
    });

    it("reports every issue of a candidate, not only the first", () => {
        const candidate = { ...minimalBuildCandidate(), formatVersion: 2 };
        candidate.character.baseLevel = 0;

        expect(issuesOf(candidate).map((issue) => issue.path)).toEqual(["/formatVersion", "/character/baseLevel"]);
    });
});

describe("published build schema", () => {
    it("is the schema the parser checks against (run `pnpm --filter @ro-ratorio-branch/core run schema` after a change)", () => {
        const publishedSchemaText = readFileSync(new URL("../../schema/build.v1.schema.json", import.meta.url), "utf8");

        expect(publishedSchemaText).toBe(serializePublishedSchema(buildJsonSchema));
    });
});
