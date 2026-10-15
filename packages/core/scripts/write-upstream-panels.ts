import { writeFileSync } from "node:fs";
import { extractUpstreamPanels } from "../src/engine-adapter/panel-extraction/extract-upstream-panels.ts";
import { serializePanelDefinitions } from "../src/panels/panel-definitions.ts";

writeFileSync(new URL("../src/panels/upstream-panels.json", import.meta.url), serializePanelDefinitions(await extractUpstreamPanels()));
