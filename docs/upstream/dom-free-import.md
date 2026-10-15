# Proposal: load the headless calculation without a DOM

Status: not submitted. Verified on upstream `6cfd20f`. Target branch: `dev`.

## Problem

`engine/runtime/calc-headless.js` calculates without touching the DOM, and its header names a Web Worker as a future home. But importing it still needs a full DOM: about 320 modules load with it, and many build their UI components while they load.

A Web Worker has no `document`, so the import fails there. Two substitutes were tried here:

- **happy-dom in the worker.** It supplies the DOM in Node, but it imports more than a dozen Node built-ins (`vm`, `fs`, `net`, `http`, `child_process`, ...) and cannot be bundled for a browser.
- **An inert stand-in for `document`** (every property and call returns the same do-nothing object). The import then depends on real DOM behaviour in several places:

  | Where | What it needs |
  | --- | --- |
  | `engine/runtime/util.js:211` (`HtmlRemoveAllChild`) | `hasChildNodes()` to become false |
  | `engine/equip/CTimeItemAreaComponentManager.js:139` | `getElementById()` to return null for a missing element, otherwise it calls the page library `TomSelect` |
  | `engine/monster/CCustomSelectMapMonster.js:207` | a `<select>` whose `value` parses to a number, otherwise no label function is chosen |

  Each fix uncovers the next, and a stand-in that is "close enough" could change results without an error.

## Proposed change

Keep UI construction out of module load on the headless path. Either:

- move each component's `RebuildControls()` / `Initialize()` call from module scope into the page's start-up code, so importing a module only defines things; or
- give `calc-headless.js` an import graph of its own that does not reach the component managers (the monster ID proposal in `monster-id-in-model.md` removes one of those edges).

A test that imports `calc-headless.js` in Node with no DOM globals at all would keep it that way.

## Workaround carried here

In Node the adapter installs happy-dom globals before importing the engine. In the browser the engine runs in a hidden same-origin frame, which has a real, empty document of its own; the app talks to it by messages, the way it would talk to a worker. A frame shares the page's main thread, so calculations are queued one at a time and the page stays responsive between them, but they do not run in parallel. When this proposal lands, the frame can be swapped for a worker without changing the callers.
