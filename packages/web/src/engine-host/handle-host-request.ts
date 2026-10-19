import {
    readGearListing,
    type AttackMethod,
    attackMethodsOfBuild,
    type Build,
    BuildConversionError,
    isAdopted,
    calculatorOn,
    type CatalogEntry,
    exportRatorioSave,
    saveReadingOn,
    type ItemDescription,
    type RatorioEngine,
    ratorioPageUrl,
} from "@ro-ratorio-branch/core/platform-neutral";
import type { CatalogList, Descriptions, GearDescription, GearFacts, HostRequest, HostResponse, IdsToDescribe, SaveReadOutcome } from "./host-protocol.ts";

/** Answers one request on the given engine. A failure becomes a `failed` response, never a thrown error. */
export async function handleHostRequest(engine: RatorioEngine, request: HostRequest): Promise<HostResponse> {
    try {
        if (request.kind === "calculate") {
            const outcome = await calculatorOn(engine)(request.build);
            return { kind: "calculated", requestId: request.requestId, outcome };
        }
        if (request.kind === "readSave") {
            return { kind: "saveRead", requestId: request.requestId, outcome: await readSave(engine, request.saveUrlOrData) };
        }
        if (request.kind === "writeSave") {
            const writeRatorioSave = await engine.loadSaveWriter();
            const { content, notExported } = exportRatorioSave(request.build, engine);
            return { kind: "saveWritten", requestId: request.requestId, written: { saveUrl: `${ratorioPageUrl}?${writeRatorioSave(content)}`, notExported } };
        }
        if (request.kind === "listCatalog") {
            return { kind: "catalogListed", requestId: request.requestId, entries: listCatalog(engine, request.list) };
        }
        if (request.kind === "listJobSettings") {
            return {
                kind: "jobSettingsListed",
                requestId: request.requestId,
                jobSettings: {
                    learnableSkills: engine.catalog.learnableSkillsOfJob(request.jobId),
                    selfBuffs: engine.catalog.selfBuffsOfJob(request.jobId),
                    supportBuffs: engine.catalog.supportBuffs(),
                    guildBuffs: engine.catalog.positionalBuffs("guildBuffs"),
                    itemBuffs: engine.catalog.positionalBuffs("itemBuffs"),
                    otherBuffs: engine.catalog.positionalBuffs("otherBuffs"),
                    customizations: engine.catalog.customizations(),
                    targetSettings: engine.catalog.targetSettings(),
                    autoSpellChances: engine.catalog.autoSpellChances(),
                    limits: engine.catalog.limitsOfJob(request.jobId) ?? null,
                    limitsWhenAdopted: engine.catalog.limitsOfJob(request.jobId, true) ?? null,
                    wieldsTwoWeapons: engine.catalog.leftHandItemKindsOfJob(request.jobId).length > 0,
                },
            };
        }
        if (request.kind === "readGearListing") {
            const listing = readGearListing(request.text, engine.catalog, request.itemId === undefined ? {} : { itemId: request.itemId });
            const slotsOfItem = listing.gearPiece === null ? [] : engine.catalog.slotsOfItem(listing.gearPiece.itemId);
            return { kind: "gearListingRead", requestId: request.requestId, listingRead: { listing, slotsOfItem } };
        }
        if (request.kind === "wordBonuses") {
            return { kind: "bonusesWorded", requestId: request.requestId, wordings: request.bonuses.map(({ name, value }) => engine.catalog.wordingOfBonus(name, value)) };
        }
        if (request.kind === "listSkillsGearRewards") {
            return { kind: "skillsGearRewardsListed", requestId: request.requestId, skillIds: engine.catalog.learnedSkillsGearRewards(request.itemIds, request.cardOrEnchantIds) };
        }
        if (request.kind === "countStatPoints") {
            return { kind: "statPointsCounted", requestId: request.requestId, statPoints: engine.catalog.statPointsOf(request.character, isAdopted(request.character)) ?? null };
        }
        if (request.kind === "listAttackMethods") {
            return { kind: "attackMethodsListed", requestId: request.requestId, attackMethods: attackMethodsOrNone(request.build, engine) };
        }
        if (request.kind === "checkGear") {
            return { kind: "gearChecked", requestId: request.requestId, gearFacts: checkGear(engine, request.itemIds, request.jobIds) };
        }
        return { kind: "described", requestId: request.requestId, descriptions: describe(engine, request.ids) };
    } catch (error) {
        return { kind: "failed", requestId: request.requestId, reason: error instanceof Error ? error.message : String(error) };
    }
}

async function readSave(engine: RatorioEngine, saveUrlOrData: string): Promise<SaveReadOutcome> {
    return (await saveReadingOn(engine))(saveUrlOrData);
}

function withEffects(entries: CatalogEntry[], isAsked: boolean, effectsOf: (id: number) => string[]): CatalogEntry[] {
    return isAsked ? entries.map((entry) => ({ ...entry, effects: effectsOf(entry.id) })) : entries;
}

function listCatalog(engine: RatorioEngine, list: CatalogList): CatalogEntry[] {
    switch (list.what) {
        case "jobs":
            return engine.catalog.jobs();
        case "itemsForSlot":
            return withEffects(engine.catalog.itemsForSlot(list.slot, list.jobId), list.withEffects === true, engine.catalog.effectsOfItem);
        case "socketChoicesOfItem":
            return withEffects(engine.catalog.socketChoicesOfItem(list.slot, list.itemId)[list.socketIndex] ?? [], list.withEffects === true, engine.catalog.effectsOfCardOrEnchant);
        case "monsters":
            return engine.catalog.monsters();
        case "randomOptionsOfItem":
            return engine.catalog.randomOptionsOfItem(list.itemId)[list.positionIndex] ?? [];
        case "timedItems":
            return engine.catalog.timedItems();
        case "autoSpells":
            return engine.catalog.autoSpells();
        case "costumesOfJob":
            return engine.catalog.costumesOfJob(list.jobId);
        case "speedPotions":
            return engine.catalog.speedPotions();
        case "weaponElements":
            return engine.catalog.weaponElements();
        case "arrowsOfJob":
            return engine.catalog.arrowsOfJob(list.jobId);
        case "attackSkillsOfJob":
            return engine.catalog.attackSkillsOfJob(list.jobId);
    }
}

function attackMethodsOrNone(build: Build, engine: RatorioEngine): AttackMethod[] {
    try {
        return attackMethodsOfBuild(build, engine);
    } catch (error) {
        if (error instanceof BuildConversionError) {
            return [];
        }
        throw error;
    }
}

function checkGear(engine: RatorioEngine, itemIds: readonly number[], jobIds: readonly number[]): GearFacts {
    return {
        slotsOfItem: Object.fromEntries(itemIds.map((itemId) => [itemId, engine.catalog.slotsOfItem(itemId)])),
        wearingJobIdsOfItem: Object.fromEntries(
            itemIds.map((itemId) => [itemId, jobIds.filter((jobId) => engine.canJobEquipItem(jobId, itemId))]),
        ),
    };
}

function describe(engine: RatorioEngine, ids: IdsToDescribe): Descriptions {
    return {
        jobNames: known(ids.jobIds, engine.names.jobName),
        skillNames: known(ids.skillIds, engine.names.skillName),
        monsterNames: known(ids.monsterIds, engine.names.monsterName),
        items: known<GearDescription>(ids.itemIds, (itemId) => describedWithEffects(engine.names.describeItem(itemId), engine.catalog.effectsOfItem(itemId))),
        cardsOrEnchants: known<GearDescription>(ids.cardOrEnchantIds, (cardOrEnchantId) =>
            describedWithEffects(engine.names.describeCardOrEnchant(cardOrEnchantId), engine.catalog.effectsOfCardOrEnchant(cardOrEnchantId)),
        ),
        randomOptionNames: known(ids.randomOptionIds ?? [], engine.names.randomOptionName),
    };
}

function describedWithEffects(description: ItemDescription | undefined, effects: readonly string[]): GearDescription | undefined {
    return description === undefined ? undefined : { ...description, effects };
}

function known<Described>(ids: readonly number[], lookUp: (id: number) => Described | undefined): Record<number, Described> {
    const describedById: Record<number, Described> = {};
    for (const id of ids) {
        const described = lookUp(id);
        if (described !== undefined) {
            describedById[id] = described;
        }
    }
    return describedById;
}
