import type { TextKind } from "@ro-ratorio-branch/core/platform-neutral";

/** The kinds of things an image pack can hold pictures of. */
export const pictureKinds = ["item", "cardOrEnchant", "monster", "skill", "job"] as const satisfies readonly TextKind[];
export type PictureKind = (typeof pictureKinds)[number];

const imageExtension = /\.(png|gif|jpe?g|webp|bmp)$/i;

/** The folder names that say which kind of thing the pictures in them show. */
const kindOfFolderName: Readonly<Record<string, PictureKind>> = {
    item: "item",
    items: "item",
    アイテム: "item",
    card: "cardOrEnchant",
    cards: "cardOrEnchant",
    カード: "cardOrEnchant",
    monster: "monster",
    monsters: "monster",
    mob: "monster",
    モンスター: "monster",
    skill: "skill",
    skills: "skill",
    スキル: "skill",
    job: "job",
    jobs: "job",
    職業: "job",
};

/** A name as pictures are matched by it: full and half width alike, no case, no spaces. */
export function pictureNameKey(name: string): string {
    return name.normalize("NFKC").toLowerCase().replaceAll(/\s+/g, "");
}

/**
 * The key a picture file is kept under, from where it sits in the pack:
 * the file's name without its extension, with the kind in front when one
 * of its folders names one. `null` for a file that is not a picture.
 */
export function pictureKeyOfPath(path: string): string | null {
    const parts = path.split(/[\\/]/).filter((part) => part !== "");
    const fileName = parts.at(-1);
    if (fileName === undefined || fileName.startsWith(".") || !imageExtension.test(fileName)) {
        return null;
    }
    const nameKey = pictureNameKey(fileName.replace(imageExtension, ""));
    if (nameKey === "") {
        return null;
    }
    const kind = parts
        .slice(0, -1)
        .map((folderName) => kindOfFolderName[pictureNameKey(folderName)])
        .findLast((kindOfFolder) => kindOfFolder !== undefined);
    return kind === undefined ? nameKey : `${kind}/${nameKey}`;
}

/**
 * The keys a thing's picture may be kept under, most telling first: in the
 * folder of its kind by ID or by name, then anywhere by name. An ID alone
 * says nothing outside a folder, where an item and a monster share numbers.
 */
export function pictureKeysOf(kind: PictureKind, id: number, name: string): string[] {
    const nameKey = pictureNameKey(name);
    return [`${kind}/${id}`, ...(nameKey === "" ? [] : [`${kind}/${nameKey}`, nameKey])];
}
