import type { Character, GearPiece } from "../build/build-format.ts";
import type { Change } from "./tree-format.ts";

/** Why a change to a gear piece no longer fits the character it is applied to. */
export type StaleReason = "slotIsEmpty" | "slotHoldsAnotherItem";

export type ChangeApplication =
    | { readonly applied: true; readonly character: Character }
    | { readonly applied: false; readonly staleReason: StaleReason };

const noTraitPoints = { pow: 0, sta: 0, wis: 0, spl: 0, con: 0, crt: 0 };

/** Returns the character after the change, leaving the given character untouched. */
export function applyChange(character: Character, change: Change): ChangeApplication {
    switch (change.kind) {
        case "setGearPiece": {
            const { [change.slot]: _replaced, ...otherEquipment } = character.equipment;
            const equipment =
                change.gearPiece === null ? otherEquipment : { ...otherEquipment, [change.slot]: change.gearPiece };
            return applied({ ...character, equipment });
        }
        case "setRefine":
            return changeGearPiece(character, change, (gearPiece) => ({ ...gearPiece, refine: change.refine }));
        case "setTranscendence":
            return changeGearPiece(character, change, (gearPiece) => ({
                ...gearPiece,
                transcendence: change.transcendence,
            }));
        case "setSocket":
            return changeGearPiece(character, change, (gearPiece) => ({
                ...gearPiece,
                sockets: withSocket(gearPiece.sockets ?? [], change.socket, change.cardOrEnchantId),
            }));
        case "setBaseStat":
            return applied({ ...character, baseStats: { ...character.baseStats, [change.stat]: change.value } });
        case "setTraitStat":
            return applied({
                ...character,
                traitStats: { ...noTraitPoints, ...character.traitStats, [change.stat]: change.value },
            });
        case "setLearnedSkill":
            return applied({
                ...character,
                learnedSkills: withEntry(character.learnedSkills, String(change.skillId), change.level),
            });
        case "setSelfBuff":
            return applied({
                ...character,
                selfBuffs: withEntry(character.selfBuffs, String(change.skillId), change.level),
            });
        case "setSupportBuff":
            return applied({
                ...character,
                supportBuffs: withEntry(character.supportBuffs, change.name, change.value),
            });
        case "setPanelBuff":
            return applied({ ...character, [change.panel]: withEntry(character[change.panel], String(change.position), change.value) });
        case "setCustomization":
            return applied({
                ...character,
                customization: { ...character.customization, [change.section]: withEntry(character.customization?.[change.section], change.name, change.value) },
            });
        case "setTimedItems": {
            const { timedItems: _previousTimedItems, ...characterWithoutTimedItems } = character;
            return applied(change.timedItems.length === 0 ? characterWithoutTimedItems : { ...characterWithoutTimedItems, timedItems: [...change.timedItems] });
        }
        case "setAutoSpells": {
            const { autoSpells: _previousAutoSpells, ...characterWithoutAutoSpells } = character;
            return applied(change.autoSpells.length === 0 ? characterWithoutAutoSpells : { ...characterWithoutAutoSpells, autoSpells: change.autoSpells.map((autoSpell) => ({ ...autoSpell })) });
        }
        case "setSpeedPotion":
            return applied(withNumber(character, "speedPotion", change.speedPotion));
        case "setWeaponElement":
            return applied(withNumber(character, "weaponElement", change.elementId));
        case "setArrow":
            return applied(withNumber(character, "arrowId", change.arrowId));
    }
}

/** The character with one of its single numbers set; 0 takes the field out, which is how a build writes "none". */
function withNumber(character: Character, field: "speedPotion" | "weaponElement" | "arrowId", value: number): Character {
    const { [field]: _previousValue, ...characterWithoutField } = character;
    return value === 0 ? characterWithoutField : { ...characterWithoutField, [field]: value };
}

function applied(character: Character): ChangeApplication {
    return { applied: true, character };
}

function changeGearPiece(
    character: Character,
    change: { readonly slot: keyof Character["equipment"]; readonly expectedItemId: number },
    changePiece: (gearPiece: GearPiece) => GearPiece,
): ChangeApplication {
    const gearPiece = character.equipment[change.slot];
    if (gearPiece === undefined) {
        return { applied: false, staleReason: "slotIsEmpty" };
    }
    if (gearPiece.itemId !== change.expectedItemId) {
        return { applied: false, staleReason: "slotHoldsAnotherItem" };
    }
    return applied({ ...character, equipment: { ...character.equipment, [change.slot]: changePiece(gearPiece) } });
}

function withSocket(
    sockets: readonly (number | null)[],
    socketNumber: number,
    cardOrEnchantId: number | null,
): (number | null)[] {
    const changedSockets = [...sockets];
    while (changedSockets.length < socketNumber) {
        changedSockets.push(null);
    }
    changedSockets[socketNumber - 1] = cardOrEnchantId;
    while (changedSockets.at(-1) === null) {
        changedSockets.pop();
    }
    return changedSockets;
}

/** A value of 0 removes the entry, matching how the build format says "not learned" or "not active". */
function withEntry(
    entries: Readonly<Record<string, number>> | undefined,
    key: string,
    value: number,
): Record<string, number> {
    const { [key]: _replaced, ...otherEntries } = entries ?? {};
    return value === 0 ? otherEntries : { ...otherEntries, [key]: value };
}
