import { writeFileSync } from "node:fs";
import { buildJsonSchema } from "../src/build/build-format.ts";
import { serializePublishedSchema } from "../src/build/published-schema.ts";
import { treeJsonSchema } from "../src/tree/tree-format.ts";
import { workspaceJsonSchema } from "../src/workspace/workspace-format.ts";

writeFileSync(new URL("../schema/build.v1.schema.json", import.meta.url), serializePublishedSchema(buildJsonSchema));
writeFileSync(new URL("../schema/tree.v1.schema.json", import.meta.url), serializePublishedSchema(treeJsonSchema));
writeFileSync(new URL("../schema/workspace.v1.schema.json", import.meta.url), serializePublishedSchema(workspaceJsonSchema));
