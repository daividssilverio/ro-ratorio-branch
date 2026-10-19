import type { BuildCalculator, BuildOutcome } from "@ro-ratorio-branch/core/platform-neutral";
import type { AttackMethod, Build, CatalogEntry, Character, StatPointBudget } from "@ro-ratorio-branch/core/platform-neutral";
import {
    type BonusAtValue,
    type GearListingRead,
    type CatalogList,
    type Descriptions,
    type GearFacts,
    type JobSettings,
    type HostRequest,
    type HostResponse,
    type IdsToDescribe,
    isHostResponse,
    type SaveReadOutcome,
    type SaveWritten,
} from "./host-protocol.ts";

/** One engine copy the app can reach. It takes one request at a time, in the order they were sent. */
export interface EngineHost {
    readonly calculate: BuildCalculator;
    describe(ids: IdsToDescribe): Promise<Descriptions>;
    readSave(saveUrlOrData: string): Promise<SaveReadOutcome>;
    writeSave(build: Build): Promise<SaveWritten>;
    listCatalog(list: CatalogList): Promise<readonly CatalogEntry[]>;
    listJobSettings(jobId: number): Promise<JobSettings>;
    /** The stat points the character has earned and spent. `null` for a job the engine does not have. */
    countStatPoints(character: Character): Promise<StatPointBudget | null>;
    listSkillsGearRewards(itemIds: readonly number[], cardOrEnchantIds: readonly number[]): Promise<readonly number[]>;
    /** Each bonus in upstream's words, in the order given; empty for one upstream does not word. */
    wordBonuses(bonuses: readonly BonusAtValue[]): Promise<readonly string[]>;
    readGearListing(text: string, itemId?: number): Promise<GearListingRead>;
    /** The attacks the build's character can use. None for a character that cannot be calculated. */
    listAttackMethods(build: Build): Promise<readonly AttackMethod[]>;
    checkGear(itemIds: readonly number[], jobIds: readonly number[]): Promise<GearFacts>;
}

export class EngineHostError extends Error {
    constructor(reason: string) {
        super(reason);
        this.name = "EngineHostError";
    }
}

type RequestWithoutId = HostRequest extends infer Request ? (Request extends unknown ? Omit<Request, "requestId"> : never) : never;

/** Starts an engine in a hidden same-origin frame and resolves once it has loaded. */
export function startFrameEngineHost(hostPageUrl: string): Promise<EngineHost> {
    const frame = document.createElement("iframe");
    frame.src = hostPageUrl;
    frame.hidden = true;
    frame.title = "calculation engine";

    const settleOfRequestId = new Map<number, (response: HostResponse) => void>();
    let nextRequestId = 1;

    function ask(request: RequestWithoutId): Promise<HostResponse> {
        const requestId = nextRequestId++;
        return new Promise((resolve) => {
            settleOfRequestId.set(requestId, resolve);
            frame.contentWindow?.postMessage({ ...request, requestId }, window.location.origin);
        });
    }

    const host: EngineHost = {
        async calculate(build): Promise<BuildOutcome> {
            const response = await ask({ kind: "calculate", build });
            if (response.kind !== "calculated") {
                throw new EngineHostError(response.kind === "failed" ? response.reason : `unexpected ${response.kind}`);
            }
            return response.outcome;
        },
        async describe(ids) {
            const response = await ask({ kind: "describe", ids });
            if (response.kind !== "described") {
                throw new EngineHostError(response.kind === "failed" ? response.reason : `unexpected ${response.kind}`);
            }
            return response.descriptions;
        },
        async readSave(saveUrlOrData) {
            const response = await ask({ kind: "readSave", saveUrlOrData });
            if (response.kind !== "saveRead") {
                throw new EngineHostError(response.kind === "failed" ? response.reason : `unexpected ${response.kind}`);
            }
            return response.outcome;
        },
        async writeSave(build) {
            const response = await ask({ kind: "writeSave", build });
            if (response.kind !== "saveWritten") {
                throw new EngineHostError(response.kind === "failed" ? response.reason : `unexpected ${response.kind}`);
            }
            return response.written;
        },
        async listCatalog(list) {
            const response = await ask({ kind: "listCatalog", list });
            if (response.kind !== "catalogListed") {
                throw new EngineHostError(response.kind === "failed" ? response.reason : `unexpected ${response.kind}`);
            }
            return response.entries;
        },
        async listJobSettings(jobId) {
            const response = await ask({ kind: "listJobSettings", jobId });
            if (response.kind !== "jobSettingsListed") {
                throw new EngineHostError(response.kind === "failed" ? response.reason : `unexpected ${response.kind}`);
            }
            return response.jobSettings;
        },
        async countStatPoints(character) {
            const response = await ask({ kind: "countStatPoints", character });
            if (response.kind !== "statPointsCounted") {
                throw new EngineHostError(response.kind === "failed" ? response.reason : `unexpected ${response.kind}`);
            }
            return response.statPoints;
        },
        async readGearListing(text, itemId) {
            const response = await ask({ kind: "readGearListing", text, ...(itemId === undefined ? {} : { itemId }) });
            if (response.kind !== "gearListingRead") {
                throw new EngineHostError(response.kind === "failed" ? response.reason : `unexpected ${response.kind}`);
            }
            return response.listingRead;
        },
        async wordBonuses(bonuses) {
            const response = await ask({ kind: "wordBonuses", bonuses });
            if (response.kind !== "bonusesWorded") {
                throw new EngineHostError(response.kind === "failed" ? response.reason : `unexpected ${response.kind}`);
            }
            return response.wordings;
        },
        async listSkillsGearRewards(itemIds, cardOrEnchantIds) {
            const response = await ask({ kind: "listSkillsGearRewards", itemIds, cardOrEnchantIds });
            if (response.kind !== "skillsGearRewardsListed") {
                throw new EngineHostError(response.kind === "failed" ? response.reason : `unexpected ${response.kind}`);
            }
            return response.skillIds;
        },
        async listAttackMethods(build) {
            const response = await ask({ kind: "listAttackMethods", build });
            if (response.kind !== "attackMethodsListed") {
                throw new EngineHostError(response.kind === "failed" ? response.reason : `unexpected ${response.kind}`);
            }
            return response.attackMethods;
        },
        async checkGear(itemIds, jobIds) {
            const response = await ask({ kind: "checkGear", itemIds, jobIds });
            if (response.kind !== "gearChecked") {
                throw new EngineHostError(response.kind === "failed" ? response.reason : `unexpected ${response.kind}`);
            }
            return response.gearFacts;
        },
    };

    return new Promise((resolve, reject) => {
        window.addEventListener("message", (event) => {
            if (event.source !== frame.contentWindow || event.origin !== window.location.origin || !isHostResponse(event.data)) {
                return;
            }
            const response = event.data;
            if (response.kind === "ready") {
                resolve(host);
                return;
            }
            settleOfRequestId.get(response.requestId)?.(response);
            settleOfRequestId.delete(response.requestId);
        });
        frame.addEventListener("error", () => reject(new EngineHostError("the engine host page did not load")));
        document.body.append(frame);
    });
}
