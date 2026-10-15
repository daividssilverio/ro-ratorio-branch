/**
 * Japanese text folded for comparing: what a user types and what a name
 * reads as are both brought to the same plain form first.
 */

const hiraganaStart = 0x3041;
const hiraganaEnd = 0x3096;
const hiraganaToKatakanaOffset = 0x60;
const combiningVoicingMarks = /[゙゚]/g;

const largeKanaOfSmall: Readonly<Record<string, string>> = {
    ァ: "ア",
    ィ: "イ",
    ゥ: "ウ",
    ェ: "エ",
    ォ: "オ",
    ッ: "ツ",
    ャ: "ヤ",
    ュ: "ユ",
    ョ: "ヨ",
    ヮ: "ワ",
    ヵ: "カ",
    ヶ: "ケ",
};

/** Full-width forms of half-width kana and ASCII of full-width letters, with hiragana turned into katakana. */
export function toKatakana(text: string): string {
    return Array.from(text.normalize("NFKC"), (character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint >= hiraganaStart && codePoint <= hiraganaEnd ? String.fromCodePoint(codePoint + hiraganaToKatakanaOffset) : character;
    }).join("");
}

export function isKana(character: string): boolean {
    return /^[ぁ-ゖァ-ヺー]$/.test(character);
}

export function hasKanaOrKanji(text: string): boolean {
    return /[ぁ-ゖァ-ヺ一-鿿々]/.test(text);
}

/**
 * One character folded the way search compares kana: katakana, without
 * voicing marks, small kana as large ones. A long-vowel mark, a space or
 * punctuation folds to nothing. Latin letters fold to lower case.
 */
function foldedCharacter(character: string): string {
    const katakana = toKatakana(character);
    if (/^[ー‐―－\-\s・･.,、。「」『』（）()[\]［］【】<>＜＞'’"”!！?？:：;；/／~〜+＋]+$/.test(katakana)) {
        return "";
    }
    const withoutVoicing = katakana.normalize("NFD").replaceAll(combiningVoicingMarks, "").normalize("NFC");
    return Array.from(withoutVoicing, (kana) => largeKanaOfSmall[kana] ?? kana)
        .join("")
        .toLowerCase();
}

export interface FoldedText {
    /** The folded text. */
    readonly key: string;
    /** For each character of `key`, the position in the original text of the character it came from. */
    readonly sourcePositions: readonly number[];
}

/** The text folded for comparing, remembering where each folded character came from. */
export function foldText(text: string): FoldedText {
    let key = "";
    const sourcePositions: number[] = [];
    let position = 0;
    for (const character of text) {
        for (const folded of foldedCharacter(character)) {
            key += folded;
            sourcePositions.push(position);
        }
        position += character.length;
    }
    return { key, sourcePositions };
}

const romajiOfKana: Readonly<Record<string, string>> = {
    ア: "a", イ: "i", ウ: "u", エ: "e", オ: "o",
    カ: "ka", キ: "ki", ク: "ku", ケ: "ke", コ: "ko",
    サ: "sa", シ: "shi", ス: "su", セ: "se", ソ: "so",
    タ: "ta", チ: "chi", ツ: "tsu", テ: "te", ト: "to",
    ナ: "na", ニ: "ni", ヌ: "nu", ネ: "ne", ノ: "no",
    ハ: "ha", ヒ: "hi", フ: "fu", ヘ: "he", ホ: "ho",
    マ: "ma", ミ: "mi", ム: "mu", メ: "me", モ: "mo",
    ヤ: "ya", ユ: "yu", ヨ: "yo",
    ラ: "ra", リ: "ri", ル: "ru", レ: "re", ロ: "ro",
    ワ: "wa", ヰ: "i", ヱ: "e", ヲ: "o", ン: "n",
    ガ: "ga", ギ: "gi", グ: "gu", ゲ: "ge", ゴ: "go",
    ザ: "za", ジ: "ji", ズ: "zu", ゼ: "ze", ゾ: "zo",
    ダ: "da", ヂ: "ji", ヅ: "zu", デ: "de", ド: "do",
    バ: "ba", ビ: "bi", ブ: "bu", ベ: "be", ボ: "bo",
    パ: "pa", ピ: "pi", プ: "pu", ペ: "pe", ポ: "po",
    ヴ: "vu",
};

const romajiOfKanaPair: Readonly<Record<string, string>> = {
    キャ: "kya", キュ: "kyu", キョ: "kyo",
    シャ: "sha", シュ: "shu", ショ: "sho", シェ: "she",
    チャ: "cha", チュ: "chu", チョ: "cho", チェ: "che",
    ニャ: "nya", ニュ: "nyu", ニョ: "nyo",
    ヒャ: "hya", ヒュ: "hyu", ヒョ: "hyo",
    ミャ: "mya", ミュ: "myu", ミョ: "myo",
    リャ: "rya", リュ: "ryu", リョ: "ryo",
    ギャ: "gya", ギュ: "gyu", ギョ: "gyo",
    ジャ: "ja", ジュ: "ju", ジョ: "jo", ジェ: "je",
    ビャ: "bya", ビュ: "byu", ビョ: "byo",
    ピャ: "pya", ピュ: "pyu", ピョ: "pyo",
    ファ: "fa", フィ: "fi", フェ: "fe", フォ: "fo", フュ: "fyu",
    ティ: "ti", ディ: "di", トゥ: "tu", ドゥ: "du", テュ: "tyu", デュ: "dyu",
    ウィ: "wi", ウェ: "we", ウォ: "wo",
    ヴァ: "va", ヴィ: "vi", ヴェ: "ve", ヴォ: "vo",
    ツァ: "tsa", ツィ: "tsi", ツェ: "tse", ツォ: "tso",
};

export interface RomanizedText {
    readonly romaji: string;
    /** For each letter of `romaji`, the position in the kana text of the kana it came from. */
    readonly sourcePositions: readonly number[];
}

/**
 * Kana written in Latin letters, Hepburn style: ブーツ is "buutsu" and
 * カッター is "kattaa". Anything that is not kana is left out, apart from
 * Latin letters and digits, which are kept as they are.
 */
export function romanizeKana(kanaText: string): RomanizedText {
    const katakana = toKatakana(kanaText);
    let romaji = "";
    const sourcePositions: number[] = [];
    let doublesNextConsonant = false;
    const append = (letters: string, position: number) => {
        const written = doublesNextConsonant && /^[^aiueon]/.test(letters) ? letters[0] + letters : letters;
        doublesNextConsonant = false;
        for (const letter of written) {
            romaji += letter;
            sourcePositions.push(position);
        }
    };
    for (let position = 0; position < katakana.length; position++) {
        const kana = katakana[position] ?? "";
        const pair = romajiOfKanaPair[kana + (katakana[position + 1] ?? "")];
        if (pair !== undefined) {
            append(pair, position);
            position++;
        } else if (kana === "ッ") {
            doublesNextConsonant = true;
        } else if (kana === "ー") {
            const lastVowel = /[aiueo](?=[^aiueo]*$)/.exec(romaji)?.[0];
            if (lastVowel !== undefined && /[aiueo]$/.test(romaji)) {
                append(lastVowel, position);
            }
        } else if (romajiOfKana[kana] !== undefined) {
            append(romajiOfKana[kana], position);
        } else if (largeKanaOfSmall[kana] !== undefined) {
            append(romajiOfKana[largeKanaOfSmall[kana]] ?? "", position);
        } else if (/^[a-z0-9]$/i.test(kana)) {
            append(kana.toLowerCase(), position);
        }
    }
    return { romaji, sourcePositions };
}

/**
 * Romaji brought to one spelling, so that the ways people type the same
 * sound compare equal: long vowels shortened (buutsu, bu-tsu, butsu),
 * shi/si, tsu/tu, chi/ti, fu/hu, ji/zi, doubled consonants, l for r.
 * Keeps, for each letter left, the position of the letter it came from.
 */
export function canonicalizeRomaji(romaji: string, sourcePositions?: readonly number[]): RomanizedText {
    const letters: { letter: string; position: number }[] = [];
    Array.from(romaji.toLowerCase()).forEach((letter, index) => {
        if (/[a-z0-9]/.test(letter)) {
            letters.push({ letter, position: sourcePositions?.[index] ?? index });
        }
    });
    const replace = (pattern: RegExp, replacement: string) => {
        let text = letters.map(({ letter }) => letter).join("");
        for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
            const position = letters[match.index]?.position ?? 0;
            letters.splice(match.index, match[0].length, ...Array.from(replacement, (letter) => ({ letter, position })));
            text = letters.map(({ letter }) => letter).join("");
            pattern.lastIndex = match.index + replacement.length;
        }
    };
    replace(/l/g, "r");
    replace(/v/g, "b");
    replace(/sh/g, "sy");
    replace(/ch/g, "ty");
    replace(/tsu/g, "tu");
    replace(/fu/g, "hu");
    replace(/j/g, "zy");
    replace(/syi/g, "si");
    replace(/tyi/g, "ti");
    replace(/zyi/g, "zi");
    replace(/dz/g, "z");
    replace(/m(?=[bp])/g, "n");
    // ダイヤ and ダイア are both written.
    replace(/iy(?=[aueo])/g, "i");
    // A doubled consonant (small tsu) and a doubled or lengthened vowel count once.
    const collapsed: { letter: string; position: number }[] = [];
    for (const entry of letters) {
        const previous = collapsed.at(-1);
        const isRepeat = previous !== undefined && previous.letter === entry.letter && /[aiueobcdfghkmprstwyz]/.test(entry.letter);
        const lengthensO = previous?.letter === "o" && entry.letter === "u";
        if (!isRepeat && !lengthensO) {
            collapsed.push(entry);
        }
    }
    return { romaji: collapsed.map(({ letter }) => letter).join(""), sourcePositions: collapsed.map(({ position }) => position) };
}
