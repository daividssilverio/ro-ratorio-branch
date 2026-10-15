import { installBrowserGlobals } from "./browser-globals.ts";
import { loadRatorioEngineWhereDomExists, type RatorioEngine } from "./ratorio-engine.ts";

/** Loads the single engine copy this process can hold, behind browser globals from happy-dom. */
export function loadRatorioEngine(): Promise<RatorioEngine> {
    installBrowserGlobals();
    return loadRatorioEngineWhereDomExists();
}
