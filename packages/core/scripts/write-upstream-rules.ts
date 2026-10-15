import { readFileSync, writeFileSync } from "node:fs";
import {
    documentTableOf,
    documentUrl,
    manifestUrl,
    readManifest,
    serializeManifest,
    withCurrentFingerprints,
    withDocumentTable,
} from "../src/engine-adapter/upstream-rules/upstream-rules.ts";

// Accepts upstream as it is pinned now: takes every fingerprint again and
// rewrites the table of rewritten rules in the document. Run it only after
// re-reading the upstream functions whose fingerprint the test reported.
const manifest = withCurrentFingerprints(readManifest());
writeFileSync(manifestUrl, serializeManifest(manifest));

const documentText = withDocumentTable(readFileSync(documentUrl, "utf8"), documentTableOf(manifest));
if (documentText === undefined) {
    throw new Error("docs/upstream-ui-logic.md has no place marked for the table of rewritten rules");
}
writeFileSync(documentUrl, documentText);
