import type { Build } from "@ro-ratorio-branch/core/platform-neutral";
import { useEffect, useState } from "react";
import { type DamagePreview, damagePreviewOf } from "./damage-preview-model.ts";
import { sharedBuildCalculator } from "./use-tree-workspace.ts";

/** What a picker needs to say what each of its entries would do to the damage. Keep the same object while nothing changed. */
export interface PickerPreview {
    /** The build as it is. */
    readonly baseline: Build;
    /** The build with the entry chosen. `null` for an entry that cannot be tried. */
    withEntry(entryId: number): Build | null;
}

const pauseBeforeCalculating = 250;

/**
 * What choosing each of the given entries would do to the damage. Starts
 * once the entries have stopped changing for a moment, works through them
 * one at a time and drops what is left when they change again, so that
 * typing never waits for a calculation.
 */
export function useDamagePreviews(entryIds: readonly number[], preview: PickerPreview | undefined): ReadonlyMap<number, DamagePreview> {
    const [previews, setPreviews] = useState<ReadonlyMap<number, DamagePreview>>(new Map());
    const entryIdsKey = entryIds.join(",");

    useEffect(() => {
        const ids = entryIdsKey === "" ? [] : entryIdsKey.split(",").map(Number);
        if (preview === undefined || ids.length === 0) {
            setPreviews(new Map());
            return;
        }
        let isCurrent = true;
        setPreviews(new Map(ids.map((id) => [id, { state: "calculating" }])));
        const timer = setTimeout(() => {
            void (async () => {
                const calculate = await sharedBuildCalculator();
                const baseline = await calculate(preview.baseline);
                for (const id of ids) {
                    if (!isCurrent) {
                        return;
                    }
                    const withEntry = preview.withEntry(id);
                    const result: DamagePreview = withEntry === null ? { state: "unavailable" } : damagePreviewOf(baseline, await calculate(withEntry));
                    if (isCurrent) {
                        setPreviews((earlier) => new Map(earlier).set(id, result));
                    }
                }
            })().catch(() => {
                if (isCurrent) {
                    setPreviews(new Map(ids.map((id) => [id, { state: "unavailable" }])));
                }
            });
        }, pauseBeforeCalculating);
        return () => {
            isCurrent = false;
            clearTimeout(timer);
        };
    }, [entryIdsKey, preview]);

    return previews;
}
