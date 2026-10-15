import { settingSlotsOf } from "../named-settings.ts";
import type { PanelBuffDefinition, PanelDefinitions, PanelSettingDefinition } from "../../panels/panel-definitions.ts";
import { readFileSync } from "node:fs";
import { loadRatorioEngine } from "../load-ratorio-engine-in-node.ts";

// A development tool, not part of what the app, the CLI or the adapter run.
// Upstream keeps what its buff panels offer inside the code that builds them
// on its page. This runs that code once against elements that are never
// shown, reads the controls it creates, and returns them as plain data for
// packages/core/src/panels/upstream-panels.json. docs/upstream-ui-logic.md
// lists every panel handled here.

interface ExtractionNode {
    readonly nodeType: number;
    readonly textContent: string | null;
    readonly previousSibling: ExtractionNode | null;
    readonly firstChild: ExtractionNode | null;
}
interface ExtractionElement extends ExtractionNode {
    readonly id: string;
    readonly tagName: string;
    readonly parentElement: ExtractionElement | null;
    readonly previousElementSibling: ExtractionElement | null;
    readonly nextElementSibling: ExtractionElement | null;
    readonly firstElementChild: ExtractionElement | null;
    getAttribute(name: string): string | null;
    innerHTML: string;
    checked: boolean;
    value: string;
    textContent: string | null;
    setAttribute(name: string, value: string): void;
    appendChild(child: ExtractionElement): unknown;
    replaceWith(replacement: ExtractionElement): void;
    remove(): void;
    querySelector(selector: string): ExtractionElement | null;
    querySelectorAll(selector: string): ArrayLike<ExtractionElement> & Iterable<ExtractionElement>;
}
interface ExtractionDocument {
    readonly body: ExtractionElement;
    createElement(tagName: string): ExtractionElement;
    getElementById(id: string): ExtractionElement | null;
}

type Choice = readonly [value: number, label: string];

function definitionOf(choices: readonly Choice[]): PanelSettingDefinition {
    const highest = Math.max(...choices.map(([value]) => value));
    const isPlainLevels = choices.every(([value, label]) => label === String(value));
    const isOffAndOn = choices.length === 2 && choices[0]?.[0] === 0 && choices[1]?.[0] === 1 && choices[0][1].toLowerCase() === "off" && choices[1][1].toLowerCase() === "on";
    return isPlainLevels || isOffAndOn ? { highest } : { highest, choices };
}

const choicesIn = (container: ExtractionElement): Choice[] => [...container.querySelectorAll("option")].map((option) => [Number(option.value), option.textContent ?? ""]);

/**
 * Upstream's builders fill dropdowns the way old pages do: `select.options[2]
 * = new Option("label", 2)`, and `= null` to take one out. happy-dom has
 * neither, so both are supplied for the duration of the extraction.
 */
function letDropdownsTakeOptionsByPosition(document: ExtractionDocument): void {
    Object.defineProperty(globalThis, "Option", {
        configurable: true,
        writable: true,
        value: function Option(text?: unknown, value?: unknown) {
            const option = document.createElement("option");
            option.textContent = text === undefined ? "" : String(text);
            option.value = value === undefined ? "" : String(value);
            return option;
        },
    });
    Object.defineProperty(Object.getPrototypeOf(document.createElement("select")), "options", {
        configurable: true,
        get(this: ExtractionElement) {
            const dropdown = this;
            const optionAt = (position: number) => dropdown.querySelectorAll("option")[position];
            return new Proxy(
                {},
                {
                    get: (_collection, key) =>
                        key === "length" ? dropdown.querySelectorAll("option").length : typeof key === "string" && /^\d+$/.test(key) ? optionAt(Number(key)) : undefined,
                    set(_collection, key, option: ExtractionElement | null) {
                        if (typeof key === "string" && /^\d+$/.test(key)) {
                            const present = optionAt(Number(key));
                            if (option === null) {
                                present?.remove();
                            } else if (present === undefined) {
                                dropdown.appendChild(option);
                            } else {
                                present.replaceWith(option);
                            }
                        }
                        return true;
                    },
                },
            );
        },
    });
}

export async function extractUpstreamPanels(): Promise<PanelDefinitions> {
    const engine = await loadRatorioEngine();
    const { document } = globalThis as unknown as { document: ExtractionDocument };
    letDropdownsTakeOptionsByPosition(document);

    const form = hiddenPageForm(document);
    // Some choices depend on what is equipped; a bare novice gives every panel the same clean state.
    engine.calculateBattleResult(engine.createBaselineCalcModel(engine.jobIds.novice), engine.catalog.monsters()[0]?.id ?? 0);

    return {
        gearLimits: extractGearLimits(),
        ...(await extractSelfBuffs(engine, document, form)),
        supportBuffChoices: await extractSupportBuffChoices(document),
        customizationChoices: await extractCustomizationChoices(document),
        targetSettingChoices: await extractTargetSettingChoices(document),
        guildBuffs: positionalBuffsBuiltBy((await import("../../../../../vendor/ratorio/engine/ui/BuffGuildAndGospel.js")).Click_Skill4SW, form, "A4_Skill"),
        itemBuffs: positionalBuffsBuiltBy((await import("../../../../../vendor/ratorio/engine/ui/BuffItemAndFood.js")).Click_Skill7SW, form, "A7_Skill"),
        otherBuffs: positionalBuffsBuiltBy((await import("../../../../../vendor/ratorio/engine/ui/BuffOtherCategory.js")).Click_Skill8SW, form, "A8_Skill"),
    };
}

const pageText = () => readFileSync(new URL("../../../../../vendor/ratorio/ro4/m/calcx.html", import.meta.url), "utf8");

/**
 * A form that is never shown, holding the places the panel builders write
 * into, each with its "panel is open" switch, and the two page templates
 * some of them copy from.
 */
function hiddenPageForm(document: ExtractionDocument): ExtractionElement {
    const templateOf = (templateId: string) => new RegExp(`<template id="${templateId}">[\\s\\S]*?</template>`).exec(pageText())?.[0];
    const guildTemplate = templateOf("TPL_BUFF_GUILD");
    const otherTemplate = templateOf("TPL_BUFF_OTHER");
    if (guildTemplate === undefined || otherTemplate === undefined) {
        throw new Error("Upstream's page no longer has the templates TPL_BUFF_GUILD and TPL_BUFF_OTHER");
    }
    const form = document.createElement("form");
    form.innerHTML = `
        <div id="ID_PASS_SKILL"><input type="checkbox" name="A1_SKILLSW"></div>
        <div id="SP_SIEN02"><input type="checkbox" name="A4_SKILLSW"></div>
        <div id="OBJID_SP_SIEN05"><input type="checkbox" id="OBJID_CHECK_A7_SKILLSW" name="A7_SKILLSW"></div>
        <div id="ID_ETC"><input type="checkbox" name="A8_SKILLSW"></div>
        ${guildTemplate}${otherTemplate}`;
    document.body.appendChild(form);
    // The builders reach their controls as document.calcForm.<name>.
    Object.defineProperty(document, "calcForm", {
        configurable: true,
        value: new Proxy(form, { get: (_form, name) => (typeof name === "string" ? form.querySelector(`[name="${name}"]`) : undefined) }),
    });
    return form;
}

function openEveryPanel(form: ExtractionElement): void {
    for (const panelSwitch of form.querySelectorAll(`input[type="checkbox"][name$="_SKILLSW"]`)) {
        panelSwitch.checked = true;
    }
}

/**
 * engine/ui/BuffGuildAndGospel.js, BuffItemAndFood.js and BuffOtherCategory.js:
 * each control is named with the panel's prefix and the buff's position.
 */
function positionalBuffsBuiltBy(buildPanel: () => void, form: ExtractionElement, controlNamePrefix: string): Record<string, PanelBuffDefinition> {
    openEveryPanel(form);
    buildPanel();
    const definitionOfPosition: Record<string, PanelBuffDefinition> = {};
    for (const control of form.querySelectorAll(`[name^="${controlNamePrefix}"]`)) {
        const position = (control.getAttribute("name") ?? "").slice(controlNamePrefix.length);
        // The page shows some controls switched off for good; what cannot be set there is not offered here.
        if (!/^\d+$/.test(position) || control.getAttribute("disabled") !== null) {
            continue;
        }
        const choices: Choice[] = control.tagName === "SELECT" ? choicesIn(control) : [[0, "off"], [1, "on"]];
        if (choices.length === 0) {
            continue;
        }
        const group = headingAbove(control);
        definitionOfPosition[position] = { label: labelOf(control, form, choices), ...(group === undefined ? {} : { group }), ...definitionOf(choices) };
    }
    return definitionOfPosition;
}

const tidy = (text: string | null | undefined) => (text ?? "").replaceAll(/[\s　]+/g, " ").trim().replace(/[：:]$/, "");

/** The first line of a table row that holds one cell of text and no controls. */
function headingTextOf(row: ExtractionElement | null | undefined): string | undefined {
    const cell = row?.firstElementChild;
    if (cell == null || cell.nextElementSibling !== null || cell.querySelector("select, input") !== null) {
        return undefined;
    }
    const firstLine = tidy(cell.firstChild?.textContent);
    return firstLine === "" ? undefined : firstLine;
}

/** The nearest heading row above the control's own row, if its table has any. */
function headingAbove(control: ExtractionElement): string | undefined {
    let row = control.parentElement;
    while (row !== null && row.tagName !== "TR") {
        row = row.parentElement;
    }
    for (let rowAbove = row?.previousElementSibling ?? null; rowAbove !== null; rowAbove = rowAbove.previousElementSibling) {
        const heading = headingTextOf(rowAbove);
        if (heading !== undefined) {
            return heading;
        }
    }
    return undefined;
}

/**
 * The text the page puts next to a control: its own label, the text before it
 * in its cell, the cell before it, the heading row above a control that has a
 * row to itself, or its first choice.
 */
function labelOf(control: ExtractionElement, form: ExtractionElement, choices: readonly Choice[]): string {
    const ownLabel = control.id === "" ? "" : tidy(form.querySelector(`label[for="${control.id}"]`)?.textContent);
    if (ownLabel !== "") {
        return ownLabel;
    }
    const textNodeType = 3;
    let textBefore = "";
    for (let node = control.previousSibling; node !== null && node.nodeType === textNodeType; node = node.previousSibling) {
        textBefore = (node.textContent ?? "") + textBefore;
    }
    if (tidy(textBefore) !== "") {
        return tidy(textBefore);
    }
    const cellBefore = control.parentElement?.previousElementSibling;
    if (cellBefore != null && cellBefore.querySelector("select, input") === null && tidy(cellBefore.textContent) !== "") {
        return tidy(cellBefore.textContent);
    }
    const cell = control.parentElement;
    const hasARowToItself = cell != null && cell.previousElementSibling === null && cell.nextElementSibling === null;
    // A first choice reads "<name> なし" where the page has no other text for the control.
    return (hasARowToItself ? headingTextOf(cell.parentElement?.previousElementSibling) : undefined) ?? tidy(choices[0]?.[1]).replace(/ なし$/, "");
}

/** ro4/m/calcx.html: the options written into the weapon's refine and transcendence dropdowns. Every piece of gear gets the same ones. */
function extractGearLimits(): PanelDefinitions["gearLimits"] {
    const highestOptionOf = (dropdownId: string): number => {
        const dropdownText = new RegExp(`<select id="${dropdownId}"[\\s\\S]*?</select>`).exec(pageText())?.[0];
        const values = [...(dropdownText ?? "").matchAll(/<option value="(\d+)"/g)].map((option) => Number(option[1]));
        if (values.length === 0) {
            throw new Error(`Upstream's page no longer has the dropdown ${dropdownId} with its options written out`);
        }
        return Math.max(...values);
    };
    return { highestRefine: highestOptionOf("OBJID_ARMS_RIGHT_REFINE"), highestTranscendence: highestOptionOf("OBJID_ARMS_RIGHT_TRANSCENDENCE") };
}

/** engine/ui/BuffJobSpecificSelf.js, Click_PassSkillSW(): one dropdown per own buff of the engine's current job. */
async function extractSelfBuffs(
    engine: Awaited<ReturnType<typeof loadRatorioEngine>>,
    document: ExtractionDocument,
    form: ExtractionElement,
): Promise<Pick<PanelDefinitions, "selfBuffs" | "selfBuffsOfJob">> {
    const { Click_PassSkillSW } = await import("../../../../../vendor/ratorio/engine/ui/BuffJobSpecificSelf.js");
    const engineState = await import("../../../../../vendor/ratorio/engine/runtime/roro-state.js");
    const definitionOfSkillId: Record<string, PanelSettingDefinition> = {};
    const differingOfJobId: Record<string, Record<string, PanelSettingDefinition>> = {};
    for (const job of engine.catalog.jobs()) {
        const skillIds = engine.skillSlotsOfJob(job.id).passiveSkillIds;
        if (skillIds.length === 0) {
            continue;
        }
        engineState.set_n_A_JOB(job.id);
        openEveryPanel(form);
        Click_PassSkillSW();
        skillIds.forEach((skillId, position) => {
            const dropdown = document.getElementById(`A_skill${position}`);
            if (dropdown === null) {
                throw new Error(`Upstream's own-buff panel has no dropdown for skill ${skillId} of job ${job.id}`);
            }
            const definition = definitionOf(choicesIn(dropdown));
            const known = definitionOfSkillId[String(skillId)];
            if (known === undefined) {
                definitionOfSkillId[String(skillId)] = definition;
            } else if (JSON.stringify(known) !== JSON.stringify(definition)) {
                (differingOfJobId[String(job.id)] ??= {})[String(skillId)] = definition;
            }
        });
    }
    return { selfBuffs: definitionOfSkillId, selfBuffsOfJob: differingOfJobId };
}

/** engine/chara/CCharaConf*.js, BuildUpSelectAreaSubForSpecial(): the dropdowns of support buffs whose values are not levels. */
/** engine/chara/CCharaConfCustom*.js, BuildUpSelectAreaSubForSpecial(): the customisation settings with their own choices. */
async function extractCustomizationChoices(document: ExtractionDocument): Promise<Record<string, PanelSettingDefinition>> {
    const { CConfBase } = await import("../../../../../vendor/ratorio/engine/ui/CConfBase.js");
    const { CONTROL_TYPE_SELECTBOX_SPECIAL } = await import("../../../../../vendor/ratorio/engine/const/EnumControlType.js");
    const settingsClassOfSection = {
        status: (await import("../../../../../vendor/ratorio/engine/chara/CCharaConfCustomStatus.js")).CCharaConfCustomStatus,
        attack: (await import("../../../../../vendor/ratorio/engine/chara/CCharaConfCustomAtk.js")).CCharaConfCustomAtk,
        defense: (await import("../../../../../vendor/ratorio/engine/chara/CCharaConfCustomDef.js")).CCharaConfCustomDef,
        skill: (await import("../../../../../vendor/ratorio/engine/chara/CCharaConfCustomSkill.js")).CCharaConfCustomSkill,
        traitStatus: (await import("../../../../../vendor/ratorio/engine/chara/CCharaConfCustomSpecStatus.js")).CCharaConfCustomSpecStatus,
    };
    const slotIdNamePrefix = "CONF_ID_";

    const definitionOfKey: Record<string, PanelSettingDefinition> = {};
    for (const [section, SettingsClass] of Object.entries(settingsClassOfSection)) {
        const settings = new SettingsClass([]);
        const nameOfPosition = new Map(
            Object.entries(SettingsClass).flatMap(([staticName, position]): [number, string][] =>
                staticName.startsWith(slotIdNamePrefix) && typeof position === "number" ? [[position, staticName.slice(slotIdNamePrefix.length)]] : [],
            ),
        );
        for (const dataRow of settings.confDataObj) {
            const name = nameOfPosition.get(dataRow[CConfBase["CONF_DATA_INDEX_ID"] as number] as number);
            if (name === undefined || dataRow[CConfBase["CONF_DATA_INDEX_CONTROL_TYPE"] as number] !== CONTROL_TYPE_SELECTBOX_SPECIAL) {
                continue;
            }
            const tableCell = document.createElement("td");
            settings.BuildUpSelectAreaSubForSpecial(tableCell, dataRow);
            const choices = choicesIn(tableCell);
            if (choices.length > 0) {
                definitionOfKey[`${section}.${name}`] = definitionOf(choices);
            }
        }
    }
    return definitionOfKey;
}

/**
 * engine/monster/mobconfplayer.js, mobconfdebuf.js and mobconfbuf.js: each
 * builds its whole panel in one function, naming a dropdown after its
 * setting's slot number. Only the dropdowns whose choices are not plain
 * numbers are kept.
 */
async function extractTargetSettingChoices(document: ExtractionDocument): Promise<Record<string, PanelSettingDefinition>> {
    const byName = (moduleExports: object): Readonly<Record<string, unknown>> => moduleExports as Readonly<Record<string, unknown>>;
    const player = await import("../../../../../vendor/ratorio/engine/monster/mobconfplayer.js");
    const ailments = await import("../../../../../vendor/ratorio/engine/monster/mobconfdebuf.js");
    const buffs = await import("../../../../../vendor/ratorio/engine/monster/mobconfbuf.js");
    const panels = [
        { section: "asPlayer", exports: byName(player), build: player.BuildUpMobConfPlayerSelectArea, prefix: "MOB_CONF_PLAYER_" },
        { section: "ailments", exports: byName(ailments), build: ailments.BuildUpMobConfDebufSelectArea, prefix: "MOB_CONF_DEBUF_" },
        { section: "buffs", exports: byName(buffs), build: buffs.BuildUpMobConfBufSelectArea, prefix: "MOB_CONF_BUF_" },
    ];

    const definitionOfKey: Record<string, PanelSettingDefinition> = {};
    for (const { section, exports, build, prefix } of panels) {
        const panelRoot = document.createElement("div");
        document.body.appendChild(panelRoot);
        build(panelRoot, true);
        for (const [name, position] of settingSlotsOf(exports, `${prefix}ID_`)) {
            const dropdown = panelRoot.querySelector(`#OBJID_SELECT_${prefix}${position}`);
            const definition = dropdown === null ? undefined : definitionOf(choicesIn(dropdown));
            if (definition?.choices !== undefined) {
                definitionOfKey[`${section}.${name}`] = definition;
            }
        }
    }
    return definitionOfKey;
}

async function extractSupportBuffChoices(document: ExtractionDocument): Promise<Record<string, PanelSettingDefinition>> {
    const { CConfBase } = await import("../../../../../vendor/ratorio/engine/ui/CConfBase.js");
    const { CONTROL_TYPE_SELECTBOX_SPECIAL } = await import("../../../../../vendor/ratorio/engine/const/EnumControlType.js");
    const settingsClasses = [
        (await import("../../../../../vendor/ratorio/engine/chara/CCharaConfIchizi.js")).CCharaConfIchizi,
        (await import("../../../../../vendor/ratorio/engine/chara/CCharaConfNizi.js")).CCharaConfNizi,
        (await import("../../../../../vendor/ratorio/engine/chara/CCharaConfSanzi.js")).CCharaConfSanzi,
        (await import("../../../../../vendor/ratorio/engine/chara/CCharaConfYozi.js")).CCharaConfYozi,
        (await import("../../../../../vendor/ratorio/engine/chara/CCharaConfDebuff.js")).CCharaConfDebuff,
    ];
    const slotIdNamePrefix = "CONF_ID_";

    const definitionOfBuffName: Record<string, PanelSettingDefinition> = {};
    for (const SupportBuffSettings of settingsClasses) {
        const settings = new SupportBuffSettings([]);
        const nameOfPosition = new Map(
            Object.entries(SupportBuffSettings).flatMap(([staticName, position]): [number, string][] =>
                staticName.startsWith(slotIdNamePrefix) && typeof position === "number" ? [[position, staticName.slice(slotIdNamePrefix.length)]] : [],
            ),
        );
        for (const dataRow of settings.confDataObj) {
            const name = nameOfPosition.get(dataRow[CConfBase["CONF_DATA_INDEX_ID"] as number] as number);
            if (name === undefined || dataRow[CConfBase["CONF_DATA_INDEX_CONTROL_TYPE"] as number] !== CONTROL_TYPE_SELECTBOX_SPECIAL) {
                continue;
            }
            const tableCell = document.createElement("td");
            settings.BuildUpSelectAreaSubForSpecial(tableCell, dataRow);
            const choices = choicesIn(tableCell);
            if (choices.length > 0) {
                definitionOfBuffName[name] = definitionOf(choices);
            }
        }
    }
    return definitionOfBuffName;
}
