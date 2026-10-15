import { type AttackMethod, type Build, canonicalJson, type CatalogEntry, type Character, type EquipmentSlot, type StatPointBudget, type Workspace } from "@ro-ratorio-branch/core/platform-neutral";
import { useEffect, useMemo, useState } from "react";
import { type CatalogList, type Descriptions, type GearFacts, type JobSettings, noDescriptions, noGearFacts } from "../engine-host/host-protocol.ts";
import { idsInWorkspace } from "./locker-view-model.ts";
import { engineHost } from "./use-tree-workspace.ts";

/** One of the engine's lists. `null` while it loads; empty if the engine could not be reached. */
export function useCatalogList(list: CatalogList): readonly CatalogEntry[] | null {
    const [loaded, setLoaded] = useState<{ readonly listKey: string; readonly entries: readonly CatalogEntry[] } | null>(null);
    const listKey = JSON.stringify(list);

    useEffect(() => {
        let isLatest = true;
        void engineHost()
            .then((host) => host.listCatalog(JSON.parse(listKey) as CatalogList))
            .catch((): readonly CatalogEntry[] => [])
            .then((entries) => {
                if (isLatest) {
                    setLoaded({ listKey, entries });
                }
            });
        return () => {
            isLatest = false;
        };
    }, [listKey]);

    return loaded?.listKey === listKey ? loaded.entries : null;
}

/**
 * What an item rolls at each of its five random option positions.
 * `null` while it loads; five empty lists if the engine could not be reached.
 */
export function useRandomOptionChoices(itemId: number, positionCount: number): readonly (readonly CatalogEntry[])[] | null {
    const [loaded, setLoaded] = useState<{ readonly itemId: number; readonly choicesOfPosition: readonly (readonly CatalogEntry[])[] } | null>(null);

    useEffect(() => {
        let isLatest = true;
        const positionIndexes = Array.from({ length: positionCount }, (_unused, positionIndex) => positionIndex);
        void engineHost()
            .then((host) => Promise.all(positionIndexes.map((positionIndex) => host.listCatalog({ what: "randomOptionsOfItem", itemId, positionIndex }))))
            .catch((): readonly (readonly CatalogEntry[])[] => positionIndexes.map(() => []))
            .then((choicesOfPosition) => {
                if (isLatest) {
                    setLoaded({ itemId, choicesOfPosition });
                }
            });
        return () => {
            isLatest = false;
        };
    }, [itemId, positionCount]);

    return loaded?.itemId === itemId ? loaded.choicesOfPosition : null;
}

/**
 * What each socket of an item takes when worn in a slot.
 * `null` while it loads or without a slot; empty lists if the engine could not be reached.
 */
export function useSocketChoices(slot: EquipmentSlot | undefined, itemId: number, socketCount: number): readonly (readonly CatalogEntry[])[] | null {
    const [loaded, setLoaded] = useState<{ readonly slot: EquipmentSlot; readonly itemId: number; readonly choicesOfSocket: readonly (readonly CatalogEntry[])[] } | null>(null);

    useEffect(() => {
        if (slot === undefined) {
            return;
        }
        let isLatest = true;
        const socketIndexes = Array.from({ length: socketCount }, (_unused, socketIndex) => socketIndex);
        void engineHost()
            .then((host) => Promise.all(socketIndexes.map((socketIndex) => host.listCatalog({ what: "socketChoicesOfItem", slot, itemId, socketIndex }))))
            .catch((): readonly (readonly CatalogEntry[])[] => socketIndexes.map(() => []))
            .then((choicesOfSocket) => {
                if (isLatest) {
                    setLoaded({ slot, itemId, choicesOfSocket });
                }
            });
        return () => {
            isLatest = false;
        };
    }, [slot, itemId, socketCount]);

    return loaded !== null && loaded.slot === slot && loaded.itemId === itemId ? loaded.choicesOfSocket : null;
}

/** The stat points a character has earned and spent. `null` while they are counted or if the engine could not be reached. */
export function useStatPoints(character: Character | null): StatPointBudget | null {
    const [counted, setCounted] = useState<{ readonly characterKey: string; readonly statPoints: StatPointBudget | null } | null>(null);
    const characterKey =
        character === null ? "" : canonicalJson({ jobId: character.jobId, baseLevel: character.baseLevel, baseStats: character.baseStats, traitStats: character.traitStats ?? null, otherBuffs: character.otherBuffs ?? null });

    useEffect(() => {
        if (character === null) {
            return;
        }
        let isLatest = true;
        void engineHost()
            .then((host) => host.countStatPoints(character))
            .catch(() => null)
            .then((statPoints) => {
                if (isLatest) {
                    setCounted({ characterKey, statPoints });
                }
            });
        return () => {
            isLatest = false;
        };
        // The key stands for everything of the character that the count depends on.
    }, [characterKey]);

    return counted?.characterKey === characterKey ? counted.statPoints : null;
}

const noSkillIds: ReadonlySet<number> = new Set();

/**
 * The skills that what a character wears does something more for when
 * they are learned. Empty while they load or if the engine could not be
 * reached.
 */
export function useSkillsGearRewards(character: Character | null): ReadonlySet<number> {
    const [listed, setListed] = useState<{ readonly gearKey: string; readonly skillIds: ReadonlySet<number> } | null>(null);
    const pieces = Object.values(character?.equipment ?? {});
    const itemIds = pieces.map((piece) => piece.itemId);
    const cardOrEnchantIds = pieces.flatMap((piece) => (piece.sockets ?? []).filter((cardOrEnchantId) => cardOrEnchantId !== null));
    const gearKey = JSON.stringify([itemIds, cardOrEnchantIds]);

    useEffect(() => {
        let isLatest = true;
        const [itemIdsToAsk, cardOrEnchantIdsToAsk] = JSON.parse(gearKey) as [number[], number[]];
        void engineHost()
            .then((host) => host.listSkillsGearRewards(itemIdsToAsk, cardOrEnchantIdsToAsk))
            .catch((): readonly number[] => [])
            .then((skillIds) => {
                if (isLatest) {
                    setListed({ gearKey, skillIds: new Set(skillIds) });
                }
            });
        return () => {
            isLatest = false;
        };
    }, [gearKey]);

    return listed?.gearKey === gearKey ? listed.skillIds : noSkillIds;
}

/**
 * The attacks a character can use as it is built. `null` while they load;
 * none if the engine could not be reached or the character cannot be calculated.
 */
export function useAttackMethods(character: Character | null, targetMonsterId: number): readonly AttackMethod[] | null {
    const [loaded, setLoaded] = useState<{ readonly characterKey: string; readonly attackMethods: readonly AttackMethod[] } | null>(null);
    const characterKey = character === null ? "" : canonicalJson({ character, targetMonsterId });

    useEffect(() => {
        if (character === null) {
            return;
        }
        let isLatest = true;
        const build: Build = { formatVersion: 1, character, scenario: { skillId: 0, skillLevel: 1, targetMonsterId } };
        void engineHost()
            .then((host) => host.listAttackMethods(build))
            .catch((): readonly AttackMethod[] => [])
            .then((attackMethods) => {
                if (isLatest) {
                    setLoaded({ characterKey, attackMethods });
                }
            });
        return () => {
            isLatest = false;
        };
        // The key stands for the character and the target.
    }, [characterKey]);

    return loaded?.characterKey === characterKey ? loaded.attackMethods : null;
}

/** The skills, buffs and limits of a job. `null` while they load or if the engine could not be reached. */
export function useJobSettings(jobId: number): JobSettings | null {
    const [loaded, setLoaded] = useState<{ readonly jobId: number; readonly jobSettings: JobSettings } | null>(null);

    useEffect(() => {
        let isLatest = true;
        void engineHost()
            .then((host) => host.listJobSettings(jobId))
            .then((jobSettings) => {
                if (isLatest) {
                    setLoaded({ jobId, jobSettings });
                }
            })
            .catch(() => undefined);
        return () => {
            isLatest = false;
        };
    }, [jobId]);

    return loaded?.jobId === jobId ? loaded.jobSettings : null;
}

export interface WorkspaceGearData {
    /** Names for everything in the locker, on the characters and in the scenarios. */
    readonly descriptions: Descriptions;
    readonly gearFacts: GearFacts;
}

/** What was loaded last, so a screen that opens later starts with names instead of IDs. */
let lastLoadedGearData: WorkspaceGearData = { descriptions: noDescriptions, gearFacts: noGearFacts };

/** Names and equip facts for the whole workspace, kept up to date as it changes. */
export function useWorkspaceGearData(workspace: Workspace): WorkspaceGearData {
    const [gearData, setGearData] = useState<WorkspaceGearData>(lastLoadedGearData);
    const idsKey = useMemo(() => JSON.stringify(idsInWorkspace(workspace)), [workspace]);

    useEffect(() => {
        let isLatest = true;
        const ids = JSON.parse(idsKey) as ReturnType<typeof idsInWorkspace>;
        void engineHost()
            .then(async (host) => ({ descriptions: await host.describe(ids), gearFacts: await host.checkGear(ids.itemIds, ids.jobIds) }))
            .then((loadedGearData) => {
                lastLoadedGearData = loadedGearData;
                if (isLatest) {
                    setGearData(loadedGearData);
                }
            })
            .catch(() => undefined);
        return () => {
            isLatest = false;
        };
    }, [idsKey]);

    return gearData;
}
