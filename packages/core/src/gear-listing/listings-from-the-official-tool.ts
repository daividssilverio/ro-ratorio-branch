/**
 * Listings copied from the official tool as players see them, each with
 * what it must be read as: the item, its refine and transcendence, and the
 * cards and enchants by ratorio ID. A listing that is read wrongly is added
 * here first.
 */
export interface ListingExample {
    readonly text: string;
    readonly itemId: number;
    readonly refine?: number;
    readonly transcendence?: number;
    /** The cards and enchants, in any order. */
    readonly cardOrEnchantIds: readonly number[];
    /** Card and enchant lines whose ratorio IDs are found by name, for enchants whose names carry a value. */
    readonly cardOrEnchantNames?: readonly string[];
    /** The random options, in position order. */
    readonly randomOptions?: readonly { readonly optionId: number; readonly value: number }[];
    /** The element a random option gives the weapon. */
    readonly element?: number;
}

export const listingsFromTheOfficialTool: readonly ListingExample[] = [
    {
        text: "プライモーディアルウェポンズ[0]\n暴走した魔力\n時間の注視者\nシンソウの王",
        itemId: 5697,
        cardOrEnchantIds: [888, 3085, 1678],
    },
    {
        text: "+ 10　ガーディアンオブアビス[1]\nミストカード\n悠遠なる天上の都\n暴走した魔力\n極限の魔力",
        itemId: 5217,
        refine: 10,
        cardOrEnchantIds: [87, 2643, 888, 2098],
    },
    {
        text: "+ 10　パワードウィング[1]\nビジョウカード\nスキルディレイ - 15%\nMaxHP + 15%",
        itemId: 4247,
        refine: 10,
        cardOrEnchantIds: [1090],
        cardOrEnchantNames: ["スキルディレイ-15%", "MaxHP+15%"],
    },
    {
        text: "+ 8　ミステリーウィング[1]\nマリオネットカード\n覇王\nグラッジ",
        itemId: 4693,
        refine: 8,
        cardOrEnchantIds: [84, 1297, 1049],
    },
    {
        text: "+ 10　フェイスオブイグドラシル[1]\n覇王\nシンソウの王\n英雄の凱歌",
        itemId: 4485,
        refine: 10,
        cardOrEnchantIds: [1297, 1678, 1975],
    },
    {
        text: "+ 8　フェイスオブイグドラシル[1]\n硬化ナイトメアテラーカード\n最果ての支配者\n英雄の凱歌",
        itemId: 4485,
        refine: 8,
        cardOrEnchantIds: [1600, 2668, 1975],
    },
    {
        text: "超越段階　★1\n+ 10　フェイスオブイグドラシル[1]",
        itemId: 4485,
        refine: 10,
        transcendence: 1,
        cardOrEnchantIds: [],
    },
    {
        text: "超越段階　★1\n+ 10　フェイスオブイグドラシル[1]\n真理の解放\n英雄の凱歌\n殺意の怨念",
        itemId: 4485,
        refine: 10,
        transcendence: 1,
        cardOrEnchantIds: [1245, 1975, 1813],
    },
    {
        text: "+ 7　フェイスオブイグドラシル[1]\nジェミニ-S58カード\nシンソウの王\n殺意の怨念",
        itemId: 4485,
        refine: 7,
        cardOrEnchantIds: [176, 1678, 1813],
    },
    {
        text: "+ 8　剛勇無双の籠手[1]\nアリスカード\n豪傑\nセイクレッド",
        itemId: 4936,
        refine: 8,
        cardOrEnchantIds: [231, 1348, 1047],
    },
    {
        text: "教授のミニグラス[1]\n度胸のあるガイアスカード\nInt + 5\nMdef50%無視\nMdef50%無視",
        itemId: 4334,
        cardOrEnchantIds: [2135, 567, 1428, 1428],
    },
    {
        text: "[シャドウ] アナザーアーマー[0]\nDex+3\nヒール系スキル使用時、HP回復量+1%",
        itemId: 5649,
        cardOrEnchantIds: [],
        randomOptions: [
            { optionId: 251, value: 3 },
            { optionId: 263, value: 1 },
        ],
    },
    {
        text: "[シャドウ] アナザーウェポン[0]\nLuk+1\nSP自然回復量+20%",
        itemId: 5650,
        cardOrEnchantIds: [],
        randomOptions: [
            { optionId: 252, value: 1 },
            { optionId: 254, value: 20 },
        ],
    },
    {
        text: "+ 7　[シャドウ] アナザーウェポン[0]\nDex+1\nMatk+45",
        itemId: 5650,
        refine: 7,
        cardOrEnchantIds: [],
        randomOptions: [
            { optionId: 251, value: 1 },
            { optionId: 173, value: 45 },
        ],
    },
    {
        text: "アビスカタール[1]\n武器に水属性を付与する\n魔法攻撃時、大型モンスターに与えるダメージ+20%\n物理攻撃時、大型モンスターに与えるダメージ+15%\n物理攻撃時、大型モンスターに与えるダメージ+35%\n一般モンスターのDef14%無視",
        itemId: 3467,
        cardOrEnchantIds: [],
        element: 1,
        randomOptions: [
            { optionId: 81, value: 20 },
            { optionId: 53, value: 15 },
            { optionId: 53, value: 35 },
            { optionId: 107, value: 14 },
        ],
    },
    {
        text: "アビスカタール[1]\n武器に聖属性を付与する\n物理攻撃時、大型モンスターに与えるダメージ+35%\n魔法攻撃時、大型モンスターに与えるダメージ+20%\n物理攻撃時、大型モンスターに与えるダメージ+35%\nボスモンスターのMdef19%無視",
        itemId: 3467,
        cardOrEnchantIds: [],
        element: 6,
        randomOptions: [
            { optionId: 53, value: 35 },
            { optionId: 81, value: 20 },
            { optionId: 53, value: 35 },
            { optionId: 120, value: 19 },
        ],
    },
    {
        text: "パワードチップ[1]\nエフェスト・バルター・メガスカード\nAgi + 7\nSpecial Str\n詠唱妨害不可",
        itemId: 3407,
        cardOrEnchantIds: [3781, 670, 659, 1179],
    },
    {
        text: "ブワヤの守護タトゥー[0]\nVit + 1\n水属性攻撃で受けるダメージ - 5%\n水属性攻撃で受けるダメージ - 5%\nスキルディレイ - 4%",
        itemId: 1757,
        cardOrEnchantIds: [],
        randomOptions: [
            { optionId: 3, value: 1 },
            { optionId: 133, value: 5 },
            { optionId: 133, value: 5 },
            { optionId: 25, value: 4 },
        ],
    },
    {
        text: "ゴールデンヘッドギア[0]\nVit+10\nInt+5\nVit+5\nInt+5\n人間形プレイヤーから受けるダメージ-11%",
        itemId: 235,
        cardOrEnchantIds: [],
        randomOptions: [
            { optionId: 3, value: 10 },
            { optionId: 4, value: 5 },
            { optionId: 3, value: 5 },
            { optionId: 4, value: 5 },
            { optionId: 158, value: 11 },
        ],
    },
    {
        text: "+ 9　勇者のネペンテスブーツ[1]\n銃奇兵カード\nAtk+66\nInt+5\n火属性攻撃で受けるダメージ-10%\nヒール系スキル使用時、HP回復量+6%",
        itemId: 2366,
        refine: 9,
        cardOrEnchantIds: [304],
        randomOptions: [
            { optionId: 20, value: 66 },
            { optionId: 4, value: 5 },
            { optionId: 135, value: 10 },
            { optionId: 29, value: 6 },
        ],
    },
    {
        text: "アビスシールド[0]\nボスモンスターから受けるダメージ-40%\n物理攻撃時、竜形モンスターに与えるダメージ+6%\n物理攻撃時、風属性モンスターに与えるダメージ+5%\n闇属性攻撃で受けるダメージ-20%\n攻撃速度+8%",
        itemId: 3491,
        cardOrEnchantIds: [],
        randomOptions: [
            { optionId: 156, value: 40 },
            { optionId: 40, value: 6 },
            { optionId: 45, value: 5 },
            { optionId: 139, value: 20 },
            { optionId: 12, value: 8 },
        ],
    },
    {
        // The original marks an element given to armor as not supported (161), and the calculator does not count it.
        text: "+ 10　勇者のプレート[1]\n鎧に無属性を付与する\n動物形モンスターから受けるダメージ-3%\n火属性攻撃で受けるダメージ-7%\n絶対に壊れない",
        itemId: 2360,
        refine: 10,
        cardOrEnchantIds: [],
        randomOptions: [
            { optionId: 161, value: 1 },
            { optionId: 123, value: 3 },
            { optionId: 135, value: 7 },
            { optionId: 162, value: 1 },
        ],
    },
    {
        text: "+ 7　焔のマント[1]\nブリナラネアカード\nAtk+30\n風属性攻撃で受けるダメージ-15%\n火属性攻撃で受けるダメージ-15%\n風属性攻撃で受けるダメージ-15%\nMaxHP+15%",
        itemId: 985,
        refine: 7,
        cardOrEnchantIds: [1415],
        randomOptions: [
            { optionId: 20, value: 30 },
            { optionId: 136, value: 15 },
            { optionId: 135, value: 15 },
            { optionId: 136, value: 15 },
            { optionId: 15, value: 15 },
        ],
    },
    {
        text: "プライモーディアルウェポンズ[0]\n覇王\n固定詠唱時間 - 70%\n詠唱妨害不可",
        itemId: 5697,
        cardOrEnchantIds: [1297, 2145, 1179],
    },
    {
        text: "+ 10　ガーディアンオブアビス[1]\n[LoVA] 真化ラグナロクカード\n悠遠なる天上の都\n極限の魔力\nシンソウの王",
        itemId: 5217,
        refine: 10,
        cardOrEnchantIds: [899, 2643, 2098, 1678],
    },
    {
        text: "超越段階　★1\n+ 10　ミステリーウィング[1]\n浸食された探査型Vギアカード\nレジストポイズン\n豪傑\nベノム",
        itemId: 4693,
        refine: 10,
        transcendence: 1,
        cardOrEnchantIds: [4157, 2083, 1348, 1046],
    },
    {
        text: "教授のミニグラス[1]\nInt + 5\nMdef50%無視\nSpecial Luk",
        itemId: 4334,
        cardOrEnchantIds: [567, 1428, 663],
    },
    {
        text: "[シャドウ] アナザーアーマー[0]\nVit+1\nFlee+45",
        itemId: 5649,
        cardOrEnchantIds: [],
        randomOptions: [
            { optionId: 249, value: 1 },
            { optionId: 181, value: 45 },
        ],
    },
];
