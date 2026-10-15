import { type Static, Type } from "typebox";
import {
    type Character,
    CharacterSchema,
    GearPieceSchema,
    RatorioId,
    AutoSpellsSchema,
    ScenarioSchema,
    strictObject,
    TimedItemsSchema,
    UpstreamConstantNameKey,
} from "../build/build-format.ts";
import { customizationSections } from "../engine-adapter/named-settings.ts";
import { positionalBuffPanels } from "../panels/panel-definitions.ts";
import { baseStatNames, equipmentSlots, socketsPerGearPiece, traitStatNames } from "../character-vocabulary.ts";

export const treeFormatVersion = 1;

export const EquipmentSlotName = Type.Enum(equipmentSlots);
const ExpectedItemId = RatorioId(
    "The item this change was made for. When the slot holds a different item, the change no longer applies and its node is stale.",
);
const SkillLevel = Type.Integer({ minimum: 0, description: "0 removes it." });

/** Each change kind with its own schema, so a wrong change is reported against the kind it names. */
export const changeSchemaOfKind = {
    setGearPiece: Type.Object(
        {
            kind: Type.Literal("setGearPiece"),
            slot: EquipmentSlotName,
            gearPiece: Type.Union([GearPieceSchema, Type.Null()], {
                description: "The piece to put in the slot, or null to empty it.",
            }),
        },
        strictObject,
    ),
    setRefine: Type.Object(
        {
            kind: Type.Literal("setRefine"),
            slot: EquipmentSlotName,
            expectedItemId: ExpectedItemId,
            refine: Type.Integer({ minimum: 0 }),
        },
        strictObject,
    ),
    setTranscendence: Type.Object(
        {
            kind: Type.Literal("setTranscendence"),
            slot: EquipmentSlotName,
            expectedItemId: ExpectedItemId,
            transcendence: Type.Integer({ minimum: 0 }),
        },
        strictObject,
    ),
    setSocket: Type.Object(
        {
            kind: Type.Literal("setSocket"),
            slot: EquipmentSlotName,
            expectedItemId: ExpectedItemId,
            socket: Type.Integer({ minimum: 1, maximum: socketsPerGearPiece, description: "1 is the first socket." }),
            cardOrEnchantId: Type.Union([RatorioId("ratorio card or enchant ID."), Type.Null()], {
                description: "The card or enchant to place, or null to empty the socket.",
            }),
        },
        strictObject,
    ),
    setBaseStat: Type.Object(
        { kind: Type.Literal("setBaseStat"), stat: Type.Enum(baseStatNames), value: Type.Integer({ minimum: 1 }) },
        strictObject,
    ),
    setTraitStat: Type.Object(
        { kind: Type.Literal("setTraitStat"), stat: Type.Enum(traitStatNames), value: Type.Integer({ minimum: 0 }) },
        strictObject,
    ),
    setLearnedSkill: Type.Object(
        { kind: Type.Literal("setLearnedSkill"), skillId: RatorioId("ratorio skill ID."), level: SkillLevel },
        strictObject,
    ),
    setSelfBuff: Type.Object(
        { kind: Type.Literal("setSelfBuff"), skillId: RatorioId("ratorio skill ID."), level: SkillLevel },
        strictObject,
    ),
    setSupportBuff: Type.Object(
        {
            kind: Type.Literal("setSupportBuff"),
            name: Type.String({
                pattern: "^[A-Z][A-Z0-9_]*$",
                description: "Upstream constant name without its CONF_ID_ prefix.",
            }),
            value: Type.Integer({ description: "0 removes it." }),
        },
        strictObject,
    ),
    setPanelBuff: Type.Object(
        {
            kind: Type.Literal("setPanelBuff"),
            panel: Type.Enum(positionalBuffPanels),
            position: Type.Integer({ minimum: 0, description: "The buff's position in the original's panel." }),
            value: Type.Integer({ minimum: 0, description: "0 removes it." }),
        },
        strictObject,
    ),
    setCustomization: Type.Object(
        {
            kind: Type.Literal("setCustomization"),
            section: Type.Enum(customizationSections),
            name: UpstreamConstantNameKey,
            value: Type.Integer({ description: "0 removes it." }),
        },
        strictObject,
    ),
    setTimedItems: Type.Object({ kind: Type.Literal("setTimedItems"), timedItems: TimedItemsSchema }, strictObject),
    setAutoSpells: Type.Object({ kind: Type.Literal("setAutoSpells"), autoSpells: AutoSpellsSchema }, strictObject),
    setSpeedPotion: Type.Object({ kind: Type.Literal("setSpeedPotion"), speedPotion: Type.Integer({ minimum: 0, description: "0 is none." }) }, strictObject),
    setWeaponElement: Type.Object({ kind: Type.Literal("setWeaponElement"), elementId: RatorioId("ratorio element ID. 0 is no endow.") }, strictObject),
    setArrow: Type.Object({ kind: Type.Literal("setArrow"), arrowId: RatorioId("ratorio ID of the ammunition. 0 is none.") }, strictObject),
} as const;

export type ChangeKind = keyof typeof changeSchemaOfKind;

// Listed one by one so the type of a change is a union discriminated by `kind`.
export const ChangeSchema = Type.Union([
    changeSchemaOfKind.setGearPiece,
    changeSchemaOfKind.setRefine,
    changeSchemaOfKind.setTranscendence,
    changeSchemaOfKind.setSocket,
    changeSchemaOfKind.setBaseStat,
    changeSchemaOfKind.setTraitStat,
    changeSchemaOfKind.setLearnedSkill,
    changeSchemaOfKind.setSelfBuff,
    changeSchemaOfKind.setSupportBuff,
    changeSchemaOfKind.setPanelBuff,
    changeSchemaOfKind.setCustomization,
    changeSchemaOfKind.setTimedItems,
    changeSchemaOfKind.setAutoSpells,
    changeSchemaOfKind.setSpeedPotion,
    changeSchemaOfKind.setWeaponElement,
    changeSchemaOfKind.setArrow,
]);

export const treeNodeFields = {
    id: Type.String({ minLength: 1, description: "Unique within the tree." }),
    parentId: Type.Union([Type.String({ minLength: 1 }), Type.Null()], {
        description: "The node this one builds on, or null when it builds directly on the root.",
    }),
    label: Type.String(),
    zenyCost: Type.Optional(
        Type.Integer({ minimum: 0, description: "What this step costs, in zeny. A step without a cost is unpriced." }),
    ),
    favorite: Type.Optional(Type.Boolean()),
};

const TreeNodeSchema = Type.Object(
    {
        ...treeNodeFields,
        changes: Type.Array(ChangeSchema, { description: "Applied in order on top of the parent's build." }),
    },
    strictObject,
);

const treeFields = {
    formatVersion: Type.Literal(treeFormatVersion),
    scenario: ScenarioSchema,
    root: CharacterSchema,
};

export const TreeSchema = Type.Object({ ...treeFields, nodes: Type.Array(TreeNodeSchema) }, strictObject);

/**
 * The tree schema with every change left unchecked. Checking the changes
 * separately, each against the kind it names, gives one precise issue instead
 * of one per change kind.
 */
export const TreeSchemaWithUncheckedChanges = Type.Object(
    {
        ...treeFields,
        nodes: Type.Array(Type.Object({ ...treeNodeFields, changes: Type.Array(Type.Unknown()) }, strictObject)),
    },
    strictObject,
);

export type Change = Static<typeof ChangeSchema>;
export type TreeNode = Static<typeof TreeNodeSchema>;
export type Tree = Omit<Static<typeof TreeSchema>, "root"> & { root: Character };

/** The published JSON Schema document for tree files. */
export const treeJsonSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "ROラトリオ Branch upgrade tree, format version 1",
    ...TreeSchema,
};
