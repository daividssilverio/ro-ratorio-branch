/** Where a character gets an attack from: its job, something it wears, or an auto-spell it wants to look at on its own. */
export type AttackSource = "job" | "gear" | "autoSpell";

export const attackSources: readonly AttackSource[] = ["job", "gear", "autoSpell"];

/** One value of an option, with what follows it where that differs from choice to choice. */
export interface AttackOptionChoice {
    readonly value: number;
    readonly label: string;
    readonly next?: AttackOptionList;
}

/**
 * One thing to set on an attack: its level first, then whatever the skill
 * asks for (a cannonball, a number of hits, a distance). Either a list of
 * choices or a number to type.
 */
export interface AttackOptionList {
    /** Upstream's Japanese label. Empty for the list of levels. */
    readonly label: string;
    readonly defaultValue: number;
    /** Left out for a number that is typed. */
    readonly choices?: readonly AttackOptionChoice[];
    /** The limits of a number that is typed, where upstream gives them. */
    readonly lowest?: number;
    readonly highest?: number;
    /** What follows this option when every choice leads to the same thing. */
    readonly next?: AttackOptionList;
}

/** One attack a character can use as it is built. */
export interface AttackMethod {
    readonly skillId: number;
    readonly name: string;
    readonly source: AttackSource;
    /** The list of levels, which leads to the skill's options. */
    readonly levels: AttackOptionList;
}

/** The option that follows a value of this one. `undefined` at the end of the chain. */
export function nextOptionAfter(optionList: AttackOptionList, value: number): AttackOptionList | undefined {
    return optionList.choices?.find((choice) => choice.value === value)?.next ?? optionList.next;
}

/** Whether the option takes the value: one of its choices, or a whole number within its limits. */
export function isOfferedByOption(optionList: AttackOptionList, value: number): boolean {
    if (optionList.choices !== undefined) {
        return optionList.choices.some((choice) => choice.value === value);
    }
    return Number.isInteger(value) && value >= (optionList.lowest ?? Number.NEGATIVE_INFINITY) && value <= (optionList.highest ?? Number.POSITIVE_INFINITY);
}

/** The options of an attack along what is chosen, level first. A value that is missing is the option's default. */
export function chosenOptionsOf(attackMethod: AttackMethod, level: number | undefined, optionValues: readonly number[]): { readonly optionList: AttackOptionList; readonly value: number }[] {
    const chosen: { optionList: AttackOptionList; value: number }[] = [];
    let optionList: AttackOptionList | undefined = attackMethod.levels;
    let value = level ?? attackMethod.levels.defaultValue;
    for (let position = 0; optionList !== undefined; position++) {
        chosen.push({ optionList, value });
        optionList = nextOptionAfter(optionList, value);
        value = optionValues[position] ?? optionList?.defaultValue ?? 0;
    }
    return chosen;
}

interface UpstreamOptionData {
    GetValue(): number;
    GetLabel(): string;
    GetNextOptionList(): UpstreamOptionList | null | undefined;
}

interface UpstreamOptionList {
    GetType(): number;
    GetLabel(): string | null | undefined;
    GetDefaultOptionDataValue(): number;
    GetHtmlAttrArrayArray(): readonly (readonly [string, unknown])[] | null | undefined;
    GetNextOptionList(): UpstreamOptionList | null | undefined;
    ForEachOptionData(visit: (optionData: UpstreamOptionData) => void): void;
}

export interface UpstreamAttackMethodData {
    GetSkillId(): number;
    GetSourceType(): number;
    GetDispName(): string;
    GetNextOptionList(): UpstreamOptionList | null | undefined;
}

/**
 * Reads what the engine's attack method area would offer the character the
 * engine last calculated: plain data, with the lists upstream shares between
 * attacks and choices still shared.
 */
export async function loadAttackMethodReader(): Promise<() => AttackMethod[]> {
    const { CAttackMethodAreaComponentManager } = await import("../../../../vendor/ratorio/engine/battle/CAttackMethodAreaComponentManager.js");
    const sourceTypes = await import("../../../../vendor/ratorio/engine/const/EnumAttackMethodSource.js");
    const { ATTACK_METHOD_OPTION_LIST_TYPE_INPUT } = await import("../../../../vendor/ratorio/engine/const/EnumAttackMethodOptionListType.js");
    const sourceOfType = new Map<number, AttackSource>([
        [sourceTypes.ATTACK_METHOD_SOURCE_TYPE_JOB_LEARN, "job"],
        [sourceTypes.ATTACK_METHOD_SOURCE_TYPE_USABLE_SKILL, "gear"],
        [sourceTypes.ATTACK_METHOD_SOURCE_TYPE_AUTO_SPELL, "autoSpell"],
    ]);

    return () => {
        const converted = new Map<UpstreamOptionList, AttackOptionList>();

        function optionListOf(upstreamList: UpstreamOptionList): AttackOptionList {
            const known = converted.get(upstreamList);
            if (known !== undefined) {
                return known;
            }
            const optionList: { -readonly [Field in keyof AttackOptionList]: AttackOptionList[Field] } = {
                label: upstreamList.GetLabel() ?? "",
                defaultValue: Number(upstreamList.GetDefaultOptionDataValue()) || 0,
            };
            converted.set(upstreamList, optionList);

            if (upstreamList.GetType() === ATTACK_METHOD_OPTION_LIST_TYPE_INPUT) {
                const attributes = new Map(upstreamList.GetHtmlAttrArrayArray() ?? []);
                const limitOf = (attributeName: string) => (attributes.has(attributeName) && Number.isFinite(Number(attributes.get(attributeName))) ? Number(attributes.get(attributeName)) : undefined);
                const lowest = limitOf("min");
                const highest = limitOf("max");
                if (lowest !== undefined) optionList.lowest = lowest;
                if (highest !== undefined) optionList.highest = highest;
                const nextList = upstreamList.GetNextOptionList();
                if (nextList != null) optionList.next = optionListOf(nextList);
                return optionList;
            }

            const upstreamChoices: UpstreamOptionData[] = [];
            upstreamList.ForEachOptionData((optionData) => upstreamChoices.push(optionData));
            const nextLists = upstreamChoices.map((optionData) => optionData.GetNextOptionList() ?? undefined);
            const sharedNext = nextLists.every((nextList) => nextList === nextLists[0]) ? nextLists[0] : undefined;
            if (sharedNext !== undefined) {
                optionList.next = optionListOf(sharedNext);
            }
            optionList.choices = upstreamChoices.map((optionData, index) => {
                const nextList = sharedNext === undefined ? nextLists[index] : undefined;
                return { value: Number(optionData.GetValue()), label: String(optionData.GetLabel()), ...(nextList === undefined ? {} : { next: optionListOf(nextList) }) };
            });
            return optionList;
        }

        return (CAttackMethodAreaComponentManager.GetEffectiveAttackMethodDataArray() as UpstreamAttackMethodData[]).flatMap((attackMethodData): AttackMethod[] => {
            const source = sourceOfType.get(attackMethodData.GetSourceType());
            const levels = attackMethodData.GetNextOptionList();
            if (source === undefined || levels == null) {
                return [];
            }
            return [{ skillId: attackMethodData.GetSkillId(), name: attackMethodData.GetDispName(), source, levels: optionListOf(levels) }];
        });
    };
}
