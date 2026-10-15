import { createHash } from "node:crypto";

/**
 * The source text of one function or method of an upstream file, from its
 * name to its closing brace. `undefined` when the file declares no such
 * function.
 */
export function sourceOfFunction(fileText: string, functionName: string): string | undefined {
    // A declaration, unlike a call, has its opening brace right after the parameter list.
    const declaration = new RegExp(`(?:^|\\n)[ \\t]*(?:(?:export\\s+)?function\\s+${functionName}|(?:static\\s+|async\\s+)*${functionName})\\s*\\([^)]*\\)\\s*\\{`).exec(fileText);
    if (declaration === null) {
        return undefined;
    }
    const start = declaration.index + declaration[0].indexOf(functionName);
    const bodyStart = fileText.indexOf("{", start);
    if (bodyStart < 0) {
        return undefined;
    }
    const bodyEnd = indexOfClosingBrace(fileText, bodyStart);
    return bodyEnd === undefined ? undefined : fileText.slice(start, bodyEnd + 1);
}

/** The position of the brace that closes the one at `openingBraceIndex`, not counting braces in strings and comments. */
function indexOfClosingBrace(text: string, openingBraceIndex: number): number | undefined {
    let depth = 0;
    for (let index = openingBraceIndex; index < text.length; index++) {
        const character = text[index];
        const nextCharacter = text[index + 1];
        if (character === "/" && nextCharacter === "/") {
            index = endOf(text, "\n", index);
        } else if (character === "/" && nextCharacter === "*") {
            index = endOf(text, "*/", index) + 1;
        } else if (character === '"' || character === "'" || character === "`") {
            index = indexOfClosingQuote(text, index);
        } else if (character === "{") {
            depth++;
        } else if (character === "}") {
            depth--;
            if (depth === 0) {
                return index;
            }
        }
    }
    return undefined;
}

function endOf(text: string, terminator: string, from: number): number {
    const found = text.indexOf(terminator, from);
    return found < 0 ? text.length : found;
}

function indexOfClosingQuote(text: string, openingQuoteIndex: number): number {
    const quote = text[openingQuoteIndex];
    for (let index = openingQuoteIndex + 1; index < text.length; index++) {
        if (text[index] === "\\") {
            index++;
        } else if (text[index] === quote) {
            return index;
        }
    }
    return text.length;
}

const fingerprintLength = 16;

/**
 * A short fingerprint of source text that ignores how it is laid out: the
 * same code re-indented or re-wrapped keeps its fingerprint.
 */
export function fingerprintOf(sourceText: string): string {
    return createHash("sha256").update(sourceText.replaceAll(/\s+/g, "")).digest("hex").slice(0, fingerprintLength);
}
