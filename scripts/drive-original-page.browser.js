// Helpers for making a save on the original page through its own controls.
//
// Open https://roratorio-hub.github.io/ratorio/ro4/m/calcx.html, paste this
// file into the browser console, then build a character with the helpers and
// call saveUrl(). The result goes into savesMadeOnTheOriginal in
// packages/core/src/sharing/golden-save-urls.ts, with the numbers shown().
//
// The helpers refuse anything a control does not offer, which is the point:
// a save made this way is proof that the page offered every value in it.
//
//   pick("OBJID_SELECT_JOB", 69)            choose a dropdown option by value
//   pick("OBJID_ARMS_RIGHT", /ボウ/)         ...or by a pattern on its label
//   setNumber("OBJID_SELECT_BASE_LEVEL", 240)
//   optionsOf("OBJID_SELECT_ARROW")         see what a dropdown offers
//
// Controls worth knowing: OBJID_SELECT_JOB, OBJID_SELECT_BASE_LEVEL,
// OBJID_SELECT_JOB_LEVEL, OBJID_SELECT_STATUS_STR (and AGI, VIT, INT, DEX,
// LUK, POW, STA, WIS, SPL, CON, CRT), OBJID_ARMS_TYPE_RIGHT then
// OBJID_ARMS_RIGHT, OBJID_ARMS_RIGHT_REFINE, OBJID_ARMS_RIGHT_TRANSCENDENCE,
// OBJID_ARMS_TYPE_LEFT and OBJID_ARMS_LEFT for jobs that wield two weapons,
// OBJID_SELECT_ARROW (appears with a bow or a gun), OBJID_SELECT_ARMS_ELEMENT,
// OBJID_SHADOW_WEAPON and OBJID_SHADOW_WEAPON_REFINE.
// Random options appear after showRandomOptions():
// OBJID_EQUIP_REGION_ID_ARMS_RNDOPT_KIND_0 to _4 and ..._VALUE_0 to _4, and the
// same with ARMS_LEFT, HEAD_TOP, HEAD_MID, HEAD_UNDER, SHIELD, BODY, SHOULDER,
// SHOES, ACCESSORY_1, ACCESSORY_2. Shadow gear has its own, without IDs:
// the .rndopt-kind-select and .rndopt-value-select inside the piece's
// .equip-block.
//
// A job change rebuilds the page; wait for it before the next step:
//   pick("OBJID_SELECT_JOB", 69); await settle();

function control(id) {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`The page has no control ${id}`);
    }
    return element;
}

function choose(dropdown, wanted) {
    const option = [...dropdown.options].find((candidate) =>
        typeof wanted === "number" ? Number(candidate.value) === wanted : wanted.test(candidate.textContent),
    );
    if (!option) {
        throw new Error(`${dropdown.id || "The dropdown"} does not offer ${wanted}`);
    }
    dropdown.value = option.value;
    dropdown.dispatchEvent(new Event("change", { bubbles: true }));
    return `${option.textContent.trim()} (${option.value})`;
}

window.pick = (id, wanted) => choose(control(id), wanted);
window.choose = choose;

window.setNumber = (id, value) => {
    const input = control(id);
    if (input.tagName === "SELECT") {
        return choose(input, value);
    }
    if ((input.min !== "" && value < Number(input.min)) || (input.max !== "" && value > Number(input.max))) {
        throw new Error(`${id} takes ${input.min} to ${input.max}, not ${value}`);
    }
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return `${id} = ${input.value} (${input.min} to ${input.max})`;
};

window.optionsOf = (id) => [...control(id).options].map((option) => `${option.value}: ${option.textContent.trim()}`);

window.settle = (milliseconds = 700) => new Promise((resolve) => setTimeout(resolve, milliseconds));

window.showRandomOptions = () => control("OBJID_SLOT_MODE_BUTTON").click();

window.saveUrl = () => {
    control("OBJID_BUTTON_URL_OUT_MIG").click();
    return control("OBJID_INPUT_URL_OUT_MIG").value;
};

// The page's own engine, asked for what it calculates from the controls as
// they are now. The numbers written on the page can lag behind a change.
window.shown = async () => {
    const engineUrl = new URL("/ratorio/engine/", location.href).href;
    const engineRegistry = await import(`${engineUrl}runtime/engine-registry.js`);
    const battleResult = engineRegistry.get("calcFromModel")(engineRegistry.get("extractModelFromDom")());
    return {
        averageDamagePerAttack: battleResult.GetDamageSummaryAvePerAtk(),
        averageDamagePerSecond: battleResult.GetDamageSummaryAvePerSec(),
    };
};

"pick, choose, setNumber, optionsOf, settle, showRandomOptions, saveUrl and shown are ready";
