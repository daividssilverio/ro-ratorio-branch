import type { Build } from "../build/build-format.ts";
import { calculateBuildInDetail } from "../build/calculate-build.ts";
import type { RatorioEngine } from "../engine-adapter/ratorio-engine.ts";
import { type ActiveSpEffects, type SpEffectChances, spSustainSettingsOf } from "./sp-effect-chances.ts";
import { type SpSustain, spSustainFrom } from "./sp-sustain.ts";

/**
 * Calculates a build and how its SP holds up using its scenario's attack
 * again and again, with the chances given and the states counted as on; `null`
 * when the attack never kills.
 * @throws {BuildConversionError} listing everything the engine cannot take.
 */
export function spSustainOfBuild(build: Build, engine: RatorioEngine, chances?: SpEffectChances, active?: ActiveSpEffects): SpSustain | null {
    const { spSustainBasis } = calculateBuildInDetail(build, engine);
    return spSustainBasis === null ? null : spSustainFrom(spSustainBasis, spSustainSettingsOf(chances, active));
}
