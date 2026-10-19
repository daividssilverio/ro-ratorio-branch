import { loadRatorioEngine, parseBuild, type RatorioEngine } from "@ro-ratorio-branch/core";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { handleHostRequest } from "./handle-host-request.ts";
import { isHostRequest, isHostResponse } from "./host-protocol.ts";

const mechanicBuild = parseBuild(
    JSON.parse(
        readFileSync(new URL("../../../core/src/build/golden-builds/mechanic-arms-cannon.build.json", import.meta.url), "utf8"),
    ),
);
const idBeyondEveryUpstreamTable = 999_999;

describe("handleHostRequest", () => {
    let engine: RatorioEngine;

    beforeAll(async () => {
        engine = await loadRatorioEngine();
    }, 60_000);

    it("answers a calculation with the outcome and the request's ID", async () => {
        const response = await handleHostRequest(engine, { kind: "calculate", requestId: 7, build: mechanicBuild });

        expect(response.kind).toBe("calculated");
        expect(response.kind === "calculated" && response.requestId).toBe(7);
        expect(response.kind === "calculated" && response.outcome.state === "ready" && response.outcome.battleSummary).toMatchObject({
            averageDamagePerAttack: 911001,
            averageDamagePerSecond: 6507149,
        });
    });

    it("answers a build the engine cannot take with a notCalculable outcome, not a failure", async () => {
        const build = { ...mechanicBuild, scenario: { ...mechanicBuild.scenario, targetMonsterId: idBeyondEveryUpstreamTable } };

        const response = await handleHostRequest(engine, { kind: "calculate", requestId: 8, build });

        expect(response.kind === "calculated" && response.outcome).toEqual({
            state: "notCalculable",
            issues: [{ kind: "unknownTargetMonster", monsterId: idBeyondEveryUpstreamTable }],
        });
    });

    it("describes known IDs and leaves unknown ones out", async () => {
        const response = await handleHostRequest(engine, {
            kind: "describe",
            requestId: 9,
            ids: {
                jobIds: [51, idBeyondEveryUpstreamTable],
                skillIds: [554],
                monsterIds: [850],
                itemIds: [4411, idBeyondEveryUpstreamTable],
                cardOrEnchantIds: [1262],
            },
        });

        expect(response.kind).toBe("described");
        if (response.kind === "described") {
            expect(Object.keys(response.descriptions.jobNames)).toEqual(["51"]);
            expect(Object.keys(response.descriptions.items)).toEqual(["4411"]);
            expect(typeof response.descriptions.items[4411]?.name).toBe("string");
            expect(typeof response.descriptions.monsterNames[850]).toBe("string");
            expect(typeof response.descriptions.cardsOrEnchants[1262]?.effectText).toBe("string");
        }
    });

    it("writes a build as a ratorio save URL that reads back as the same build", async () => {
        const written = await handleHostRequest(engine, { kind: "writeSave", requestId: 12, build: mechanicBuild });
        const saveUrl = written.kind === "saveWritten" ? written.written.saveUrl : "";

        const read = await handleHostRequest(engine, { kind: "readSave", requestId: 13, saveUrlOrData: saveUrl });

        expect(written.kind === "saveWritten" && written.written.notExported).toEqual([]);
        expect(new URL(saveUrl).hostname).toBe("roratorio-hub.github.io");
        expect(read.kind === "saveRead" && read.outcome.state === "read" && read.outcome.saveImport).toEqual({
            character: mechanicBuild.character,
            scenario: mechanicBuild.scenario,
            notImported: [],
        });
    });

    it("words bonuses in the order asked, and leaves one it cannot word empty", async () => {
        const response = await handleHostRequest(engine, {
            kind: "wordBonuses",
            requestId: 20,
            bonuses: [
                { name: "ATK_PLUS", value: 30 },
                { name: "NO_SUCH_BONUS", value: 1 },
            ],
        });

        expect(response).toEqual({ kind: "bonusesWorded", requestId: 20, wordings: [engine.catalog.wordingOfBonus("ATK_PLUS", 30), ""] });
        expect(response.kind === "bonusesWorded" && response.wordings[0]).not.toBe("");
    });

    it("lists the skills and buffs a job can set", async () => {
        const response = await handleHostRequest(engine, { kind: "listJobSettings", requestId: 14, jobId: 51 });
        const jobSettings = response.kind === "jobSettingsListed" ? response.jobSettings : undefined;

        expect(jobSettings?.learnableSkills.map((skill) => skill.id)).toEqual(engine.skillSlotsOfJob(51).learnedSkillIds);
        expect(jobSettings?.selfBuffs.map((skill) => skill.id)).toEqual(engine.skillSlotsOfJob(51).passiveSkillIds);
        expect(jobSettings?.supportBuffs.some((buff) => buff.name === "BLESSING" && buff.highest === 10)).toBe(true);
        expect(jobSettings?.limits).toEqual(engine.catalog.limitsOfJob(51));
    });

    it("lists what the engine offers for a slot and a job", async () => {
        const response = await handleHostRequest(engine, { kind: "listCatalog", requestId: 10, list: { what: "itemsForSlot", slot: "rightHand", jobId: 51 } });

        expect(response.kind === "catalogListed" && response.requestId).toBe(10);
        expect(response.kind === "catalogListed" && response.entries.map((entry) => entry.id)).toContain(4411);
    });

    it("says where gear fits and which of the asked jobs may wear it", async () => {
        const noviceJobId = engine.jobIds.novice;

        const response = await handleHostRequest(engine, { kind: "checkGear", requestId: 11, itemIds: [4411, idBeyondEveryUpstreamTable], jobIds: [51, noviceJobId] });

        expect(response.kind === "gearChecked" && response.gearFacts).toEqual({
            slotsOfItem: { 4411: ["rightHand"], [idBeyondEveryUpstreamTable]: [] },
            wearingJobIdsOfItem: { 4411: [51], [idBeyondEveryUpstreamTable]: [] },
        });
    });
});

describe("host message guards", () => {
    it("accepts the protocol's own messages", () => {
        expect(isHostRequest({ kind: "calculate", requestId: 1, build: mechanicBuild })).toBe(true);
        expect(isHostResponse({ kind: "ready" })).toBe(true);
    });

    it("rejects anything else a page might post", () => {
        expect(isHostRequest({ kind: "calculate" })).toBe(false);
        expect(isHostRequest({ kind: "ready" })).toBe(false);
        expect(isHostResponse("ready")).toBe(false);
        expect(isHostResponse({ type: "webpackOk" })).toBe(false);
    });
});
