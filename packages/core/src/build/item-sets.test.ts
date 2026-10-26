import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { loadRatorioEngine } from "../engine-adapter/load-ratorio-engine-in-node.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import type { Build } from "./build-format.ts";
import { calculateBuildInDetail } from "./calculate-build.ts";
import { parseBuild } from "./parse-build.ts";

const abyssSaberGarbItemId = 5483;
const extremeMagicEnchantId = 2098;
/** The item upstream keeps the effects of アビスセイバーガーブ worn with 極限の魔力 on. */
const abyssGarbWithExtremeMagicSetId = 5486;

const abyssArmorBuild = parseBuild(JSON.parse(readFileSync(new URL("./golden-builds/spirit-handler-abyss-armor.build.json", import.meta.url), "utf8")));

describe("the item sets a build completes", () => {
    let engine: RatorioEngine;

    beforeAll(async () => {
        engine = await loadRatorioEngine();
    });

    it("are given with their members and what they do", () => {
        const { itemSets } = calculateBuildInDetail(abyssArmorBuild, engine);

        expect(itemSets.find((itemSet) => itemSet.set.id === abyssGarbWithExtremeMagicSetId)).toEqual({
            set: { kind: "item", id: abyssGarbWithExtremeMagicSetId },
            members: [
                { kind: "item", id: abyssSaberGarbItemId },
                { kind: "cardOrEnchant", id: extremeMagicEnchantId },
            ],
            effects: ["物理・魔法攻撃命中時、一定確率で10秒間、1秒毎にSP + 10%"],
        });
    });

    it("leave out a set whose members are not all worn", () => {
        const armor = abyssArmorBuild.character.equipment.armor;
        if (armor === undefined) {
            throw new Error("the golden build changed");
        }
        const withoutTheEnchant: Build = {
            ...abyssArmorBuild,
            character: { ...abyssArmorBuild.character, equipment: { ...abyssArmorBuild.character.equipment, armor: { ...armor, sockets: (armor.sockets ?? []).filter((id) => id !== extremeMagicEnchantId) } } },
        };

        expect(calculateBuildInDetail(withoutTheEnchant, engine).itemSets.map((itemSet) => itemSet.set.id)).not.toContain(abyssGarbWithExtremeMagicSetId);
    });
});
