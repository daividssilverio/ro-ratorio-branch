import { describe, expect, it } from "vitest";
import { pictureKeyOfPath, pictureKeysOf } from "./image-pack-model.ts";

describe("pictureKeyOfPath", () => {
    it.each([
        { path: "メロンメイス.png", key: "メロンメイス" },
        { path: "pack/item/メロンメイス.PNG", key: "item/メロンメイス" },
        { path: "pack/Items/4411.gif", key: "item/4411" },
        { path: "pack\\モンスター\\ポリン.jpeg", key: "monster/ポリン" },
        { path: "cards/weapon/戦車のカード.webp", key: "cardOrEnchant/戦車のカード" },
        { path: "item/ﾒﾛﾝ ﾒｲｽ.png", key: "item/メロンメイス" },
        { path: "misc/Angel Wing.bmp", key: "angelwing" },
        { path: "pack/readme.txt", key: null },
        { path: "pack/.DS_Store", key: null },
        { path: "pack/item/.png", key: null },
    ])("keeps $path under $key", ({ path, key }) => {
        expect(pictureKeyOfPath(path)).toBe(key);
    });
});

describe("pictureKeysOf", () => {
    it("looks in the folder of the kind by ID, then by name, then anywhere by name", () => {
        expect(pictureKeysOf("item", 4411, "メロン メイス")).toEqual(["item/4411", "item/メロンメイス", "メロンメイス"]);
    });

    it("finds the picture a pack holds for the thing, whichever way it was named", () => {
        for (const path of ["items/4411.png", "item/メロンメイス.png", "メロンメイス.png"]) {
            expect(pictureKeysOf("item", 4411, "メロンメイス")).toContain(pictureKeyOfPath(path));
        }
        expect(pictureKeysOf("monster", 4411, "ポリン")).not.toContain(pictureKeyOfPath("items/4411.png"));
    });
});
