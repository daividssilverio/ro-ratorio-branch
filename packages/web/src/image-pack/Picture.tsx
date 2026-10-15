import type { ReactNode } from "react";
import type { PictureKind } from "./image-pack-model.ts";
import { usePicture } from "./use-image-pack.ts";

interface PictureProps {
    readonly kind: PictureKind;
    readonly id: number;
    readonly name: string;
    /** What stands in its place when the user's pack has no picture of it. */
    readonly fallback?: ReactNode;
}

/** The picture the user's own image pack has of something from the game. The app has no pictures of its own. */
export function Picture({ kind, id, name, fallback = null }: PictureProps) {
    const address = usePicture(kind, id, name);
    return address === null ? fallback : <img className="picture" src={address} alt="" loading="lazy" />;
}
