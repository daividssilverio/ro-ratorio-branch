import { type Static, Type } from "typebox";
import { CharacterSchema, GearPieceSchema, type GearPiece, ScenarioSchema, strictObject } from "../build/build-format.ts";
import { type EquipmentSlot, equipmentSlots } from "../character-vocabulary.ts";
import { type Change, ChangeSchema, changeSchemaOfKind, EquipmentSlotName, treeNodeFields } from "../tree/tree-format.ts";

export const workspaceFormatVersion = 1;

const idPattern = "^[A-Za-z0-9][A-Za-z0-9_-]*$";
const IdKey = Type.String({ pattern: idPattern });
const IdReference = (description: string) => Type.String({ pattern: idPattern, description });

const LockerPieceSchema = Type.Object(
    {
        ...GearPieceSchema.properties,
        owned: Type.Boolean({ description: "false for a piece that is only being considered." }),
    },
    strictObject,
);

const { equipment: _inlineEquipment, ...characterFieldsWithoutEquipment } = CharacterSchema.properties;

const lockerPieceOfSlot = (description: string) =>
    Type.Record(Type.String({ pattern: `^(${equipmentSlots.join("|")})$` }), IdReference("The ID of a piece in gearPieces."), {
        ...strictObject,
        description,
    });

const WorkspaceCharacterSchema = Type.Object(
    {
        name: Type.String(),
        ...characterFieldsWithoutEquipment,
        equipment: lockerPieceOfSlot("The locker piece worn in each slot. A missing slot is empty."),
    },
    strictObject,
);

const GearLoadoutSchema = Type.Object(
    {
        name: Type.String(),
        equipment: lockerPieceOfSlot("The locker piece this loadout puts into each slot. A slot it does not list is left as it is."),
    },
    strictObject,
);

const StatLoadoutSchema = Type.Object(
    {
        name: Type.String(),
        baseStats: CharacterSchema.properties.baseStats,
        traitStats: CharacterSchema.properties.traitStats,
    },
    strictObject,
);

const loadoutFields = {
    gearLoadouts: Type.Optional(Type.Record(IdKey, GearLoadoutSchema, { ...strictObject, description: "Named sets of locker pieces, by ID." })),
    statLoadouts: Type.Optional(Type.Record(IdKey, StatLoadoutSchema, { ...strictObject, description: "Named stat allocations, by ID." })),
};

const equipLockerPieceSchema = Type.Object(
    {
        kind: Type.Literal("equipLockerPiece"),
        slot: EquipmentSlotName,
        gearPieceId: IdReference("The ID of a piece in gearPieces."),
    },
    strictObject,
);

/** Every change kind a workspace tree may hold: those of a tree file, plus equipping a piece from the locker. */
export const workspaceChangeSchemaOfKind = { ...changeSchemaOfKind, equipLockerPiece: equipLockerPieceSchema } as const;

const WorkspaceChangeSchema = Type.Union([ChangeSchema, equipLockerPieceSchema]);

const workspaceTreeFields = {
    name: Type.String(),
    characterId: IdReference("The ID of the character in characters that is this tree's root."),
    scenario: ScenarioSchema,
};

const WorkspaceTreeSchema = Type.Object(
    {
        ...workspaceTreeFields,
        nodes: Type.Array(Type.Object({ ...treeNodeFields, changes: Type.Array(WorkspaceChangeSchema) }, strictObject)),
    },
    strictObject,
);

const workspaceFields = {
    formatVersion: Type.Literal(workspaceFormatVersion),
    gearPieces: Type.Record(IdKey, LockerPieceSchema, { ...strictObject, description: "The locker: every piece, by ID." }),
    characters: Type.Record(IdKey, WorkspaceCharacterSchema, strictObject),
};

export const WorkspaceSchema = Type.Object(
    { ...workspaceFields, trees: Type.Record(IdKey, WorkspaceTreeSchema, strictObject), ...loadoutFields },
    strictObject,
);

/** The workspace schema with every change left unchecked; see `collectChangeIssues`. */
export const WorkspaceSchemaWithUncheckedChanges = Type.Object(
    {
        ...workspaceFields,
        trees: Type.Record(
            IdKey,
            Type.Object(
                {
                    ...workspaceTreeFields,
                    nodes: Type.Array(Type.Object({ ...treeNodeFields, changes: Type.Array(Type.Unknown()) }, strictObject)),
                },
                strictObject,
            ),
            strictObject,
        ),
        ...loadoutFields,
    },
    strictObject,
);

export type LockerPiece = GearPiece & { owned: boolean };
export type EquipLockerPieceChange = Static<typeof equipLockerPieceSchema>;
export type WorkspaceChange = Change | EquipLockerPieceChange;
export type WorkspaceCharacter = Omit<Static<typeof WorkspaceCharacterSchema>, "equipment"> & {
    equipment: Partial<Record<EquipmentSlot, string>>;
};
export interface WorkspaceTreeNode {
    id: string;
    parentId: string | null;
    label: string;
    changes: WorkspaceChange[];
    zenyCost?: number;
    favorite?: boolean;
}
export type WorkspaceTree = Omit<Static<typeof WorkspaceTreeSchema>, "nodes"> & { nodes: WorkspaceTreeNode[] };
export interface GearLoadout {
    name: string;
    equipment: Partial<Record<EquipmentSlot, string>>;
}
export type StatLoadout = Static<typeof StatLoadoutSchema>;
export interface Workspace {
    formatVersion: typeof workspaceFormatVersion;
    gearPieces: Record<string, LockerPiece>;
    characters: Record<string, WorkspaceCharacter>;
    trees: Record<string, WorkspaceTree>;
    gearLoadouts?: Record<string, GearLoadout>;
    statLoadouts?: Record<string, StatLoadout>;
}

/** The published JSON Schema document for workspace files. */
export const workspaceJsonSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "ROラトリオ Branch workspace, format version 1",
    ...WorkspaceSchema,
};
