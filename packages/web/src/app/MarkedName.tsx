import type { ReadingSegment } from "@ro-ratorio-branch/core/platform-neutral";
import { namePartsOf } from "./picker-model.ts";

interface MarkedNameProps {
    readonly name: string;
    /** How the kanji of the name are read, when that is known. */
    readonly reading?: readonly ReadingSegment[] | undefined;
    /** The parts of the name a search matched. */
    readonly highlights?: readonly (readonly [number, number])[];
}

/** A name with the parts a search matched marked, and furigana over its kanji. */
export function MarkedName({ name, reading, highlights = [] }: MarkedNameProps) {
    return (
        <>
            {namePartsOf(name, reading, highlights).map((part, index) => {
                const text =
                    part.reading === undefined ? (
                        part.text
                    ) : (
                        <ruby>
                            {part.text}
                            <rt>{part.reading}</rt>
                        </ruby>
                    );
                return part.isMarked ? <mark key={index}>{text}</mark> : <span key={index}>{text}</span>;
            })}
        </>
    );
}
