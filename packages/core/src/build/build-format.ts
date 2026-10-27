import { type Static, Type } from "typebox";
import { type EquipmentSlot, equipmentSlots, randomOptionsPerGearPiece, socketsPerGearPiece } from "../character-vocabulary.ts";

export const buildFormatVersion = 1;

export const strictObject = { additionalProperties: false } as const;

export const RatorioId = (description: string) => Type.Integer({ minimum: 0, description });
const InformationalName = Type.Optional(
    Type.String({ description: "Written on export for readers. Ignored on import; the ID next to it decides." }),
);
export const RatorioIdKey = Type.String({ pattern: "^(0|[1-9][0-9]*)$" });
export const UpstreamConstantNameKey = Type.String({ pattern: "^[A-Z][A-Z0-9_]*$" });
const NamedSettings = (description: string) => Type.Record(UpstreamConstantNameKey, Type.Integer(), { additionalProperties: false, description });
/** For the panels whose buffs upstream knows by nothing but a position; its saves rely on those positions. */
const PositionalBuffs = (description: string) => Type.Record(RatorioIdKey, Type.Integer({ minimum: 1 }), { additionalProperties: false, description });
const EquipmentSlotKey = Type.String({ pattern: `^(${equipmentSlots.join("|")})$` });

const RandomOptionSchema = Type.Object(
    {
        optionId: RatorioId("ratorio random option ID."),
        name: InformationalName,
        value: Type.Integer({ description: "The rolled value, in the unit the option uses." }),
    },
    strictObject,
);

export const GearPieceSchema = Type.Object(
    {
        itemId: RatorioId("ratorio item ID."),
        name: InformationalName,
        refine: Type.Optional(Type.Integer({ minimum: 0, description: "Refine level (+n). Defaults to 0." })),
        transcendence: Type.Optional(Type.Integer({ minimum: 0, description: "Transcendence stage. Defaults to 0." })),
        sockets: Type.Optional(
            Type.Array(Type.Union([RatorioId("ratorio card or enchant ID."), Type.Null()]), {
                maxItems: socketsPerGearPiece,
                description:
                    "Cards and enchants in slot order, null for an empty slot. Armor takes its card in the first slot and enchants in the other three.",
            }),
        ),
        element: Type.Optional(
            RatorioId(
                "ratorio element ID a random option gives a weapon (\"武器に聖属性を付与する\"). Taken for a weapon in the right hand when the character is not endowed with an element; the original keeps it only as that endowment.",
            ),
        ),
        randomOptions: Type.Optional(
            Type.Array(Type.Union([RandomOptionSchema, Type.Null()]), {
                maxItems: randomOptionsPerGearPiece,
                description:
                    "Random options rolled on this piece, by position, null for an empty position. Which options a position can hold depends on the item.",
            }),
        ),
        note: Type.Optional(Type.String()),
        zenyCost: Type.Optional(Type.Integer({ minimum: 0, description: "What this piece costs to obtain, in zeny." })),
    },
    strictObject,
);

const BaseStatsSchema = Type.Object(
    {
        str: Type.Integer({ minimum: 1 }),
        agi: Type.Integer({ minimum: 1 }),
        vit: Type.Integer({ minimum: 1 }),
        int: Type.Integer({ minimum: 1 }),
        dex: Type.Integer({ minimum: 1 }),
        luk: Type.Integer({ minimum: 1 }),
    },
    { ...strictObject, description: "Base stat points as allocated, without job or gear bonuses." },
);

const TraitStatsSchema = Type.Object(
    {
        pow: Type.Integer({ minimum: 0 }),
        sta: Type.Integer({ minimum: 0 }),
        wis: Type.Integer({ minimum: 0 }),
        spl: Type.Integer({ minimum: 0 }),
        con: Type.Integer({ minimum: 0 }),
        crt: Type.Integer({ minimum: 0 }),
    },
    { ...strictObject, description: "Trait stat points as allocated. Defaults to all 0." },
);

// A keyed record keeps one gear-piece definition in the published schema
// instead of one copy per slot.
const EquipmentSchema = Type.Record(EquipmentSlotKey, GearPieceSchema, {
    ...strictObject,
    description: "One gear piece per slot. A missing slot is empty.",
});

export const TimedItemsSchema = Type.Array(RatorioId("ratorio timed-item ID."), {
    maxItems: 20,
    description: "Active time-limited items. The same one can be listed more than once.",
});

export const AutoSpellsSchema = Type.Array(
    Type.Object(
        {
            autoSpellId: RatorioId("ratorio auto-spell ID: a skill at the level some item casts it."),
            name: InformationalName,
            level: Type.Optional(Type.Integer({ minimum: 0, maximum: 10, description: "The level it is cast at. Defaults to 0: the level the auto-spell has." })),
            chancePerMille: Type.Integer({ minimum: 0, maximum: 1000, description: "How often it goes off, in per mille; one of the values the original offers." }),
        },
        strictObject,
    ),
    { maxItems: 20, description: "Auto-spells that go off on a plain attack." },
);

export const CharacterSchema = Type.Object(
    {
        jobId: RatorioId("ratorio job ID."),
        jobName: InformationalName,
        baseLevel: Type.Integer({ minimum: 1 }),
        jobLevel: Type.Integer({ minimum: 1 }),
        baseStats: BaseStatsSchema,
        traitStats: Type.Optional(TraitStatsSchema),
        learnedSkills: Type.Optional(
            Type.Record(RatorioIdKey, Type.Integer({ minimum: 1 }), {
                ...strictObject,
                description: "ratorio skill ID to learned level. A skill that is not listed is not learned.",
            }),
        ),
        selfBuffs: Type.Optional(
            Type.Record(RatorioIdKey, Type.Integer({ minimum: 1 }), {
                ...strictObject,
                description: "ratorio skill ID to active level, for the job's own buffs and toggles.",
            }),
        ),
        supportBuffs: Type.Optional(
            Type.Record(UpstreamConstantNameKey, Type.Integer(), {
                ...strictObject,
                description:
                    "Buffs and debuffs from the first- to fourth-job support panels and the debuff panel, keyed by the upstream constant name without its CONF_ID_ prefix (for example BLESSING).",
            }),
        ),
        autoSpells: Type.Optional(AutoSpellsSchema),
        customization: Type.Optional(
            Type.Object(
                {
                    status: Type.Optional(NamedSettings("Base stats, HP, SP and the like.")),
                    attack: Type.Optional(NamedSettings("Attack, damage bonuses and weapon overrides.")),
                    defense: Type.Optional(NamedSettings("Defense and resistances.")),
                    skill: Type.Optional(NamedSettings("Skill damage, cast time and delays.")),
                    traitStatus: Type.Optional(NamedSettings("Trait stats and what follows from them.")),
                },
                {
                    ...strictObject,
                    description:
                        "The original's performance customisation: numbers added on top of what the character has, by part and then by the upstream constant name without its CONF_ID_ prefix (for example attack.ATK_PLUS).",
                },
            ),
        ),
        guildBuffs: Type.Optional(
            PositionalBuffs("Guild skills, gospel and stat-swap boosts, keyed by the buff's position in the original's panel, to its level or choice."),
        ),
        itemBuffs: Type.Optional(
            PositionalBuffs("Consumables and food, keyed by the buff's position in the original's panel, to its level or choice."),
        ),
        otherBuffs: Type.Optional(
            PositionalBuffs("Pet, manuals, party and other settings, keyed by the setting's position in the original's panel, to its level or choice."),
        ),
        timedItems: Type.Optional(TimedItemsSchema),
        weaponElement: Type.Optional(
            RatorioId("ratorio element ID the weapon is endowed with. Defaults to 0, no endow: the weapon keeps its own element."),
        ),
        costumeId: Type.Optional(RatorioId("ratorio ID of the costume worn over the lower headgear. Defaults to 0, none.")),
        arrowId: Type.Optional(RatorioId("ratorio ID of the arrow, bullet or other ammunition. Defaults to 0, none.")),
        speedPotion: Type.Optional(
            Type.Integer({ minimum: 0, description: "ratorio attack-speed potion setting. Defaults to 0, none." }),
        ),
        equipment: EquipmentSchema,
    },
    strictObject,
);

export type AutoSpell = Static<typeof AutoSpellsSchema>[number];

export const ScenarioSchema = Type.Object(
    {
        skillId: RatorioId("ratorio skill ID of the attack."),
        skillName: InformationalName,
        skillSource: Type.Optional(
            Type.Union([Type.Literal("gear"), Type.Literal("autoSpell")], {
                description: "Where the character has the attack from when not from its job: something it wears (gear, a card, a scroll), or an auto-spell looked at on its own.",
            }),
        ),
        skillLevel: Type.Integer({ minimum: 1 }),
        skillOptions: Type.Optional(
            Type.Array(Type.Integer(), {
                description: "Skill-specific choices in upstream order, for example the cannonball of Arms Cannon. One that is left out takes the skill's default.",
            }),
        ),
        targetMonsterId: RatorioId("ratorio monster ID of the target."),
        targetMonsterName: InformationalName,
        targetSettings: Type.Optional(
            Type.Object(
                {
                    asPlayer: Type.Optional(NamedSettings("The target taken as a player: its HP, defense, resistances and the kind of battle.")),
                    ailments: Type.Optional(NamedSettings("Ailments and debuffs on the target.")),
                    buffs: Type.Optional(NamedSettings("The target's own buffs.")),
                },
                {
                    ...strictObject,
                    description: "The original's monster settings, by part and then by the upstream constant name without its MOB_CONF_…_ID_ prefix (for example buffs.ASSUMPTIO).",
                },
            ),
        ),
    },
    { ...strictObject, description: "What is attacked and with what. Kept apart from the character on purpose." },
);

export const BuildSchema = Type.Object(
    {
        formatVersion: Type.Literal(buildFormatVersion),
        character: CharacterSchema,
        scenario: ScenarioSchema,
    },
    strictObject,
);

export type GearPiece = Static<typeof GearPieceSchema>;
export type RandomOption = Static<typeof RandomOptionSchema>;
export type Equipment = Partial<Record<EquipmentSlot, GearPiece>>;
export type Character = Omit<Static<typeof CharacterSchema>, "equipment"> & { equipment: Equipment };
export type Scenario = Static<typeof ScenarioSchema>;
export type Build = Omit<Static<typeof BuildSchema>, "character"> & { character: Character };

/** The published JSON Schema document for build files. */
export const buildJsonSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "ROラトリオ Branch build, format version 1",
    ...BuildSchema,
};
