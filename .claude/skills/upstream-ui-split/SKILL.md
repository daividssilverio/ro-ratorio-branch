---
name: upstream-ui-split
description: Keep the data and rules that ROラトリオHUB buries in its page-building code separated into this project's plain data (view model) and screens (view). Use when bumping the vendor/ratorio pin, when the upstream-panels staleness test fails, when adding a setting, panel or picker that the original has, and whenever a parity question turns on what a control of the original offers.
---

# upstream-ui-split

The original keeps much of what a setting is (its choices, labels, limits, who may use it) inside the code that builds its page. Here that knowledge lives in `packages/core` as plain data or plain functions, and `packages/web` only renders it. Upstream page code never runs in the app, the CLI or the adapter's run-time path. `docs/upstream-ui-logic.md` is the list of every such place; this skill keeps that list and the code true.

## When the pin moves, or the staleness test fails

1. **Regenerate the extracted data.**

   ```bash
   mise exec -- pnpm --filter @ro-ratorio-branch/core run panels
   git diff --stat packages/core/src/panels/upstream-panels.json
   ```

   The file has one setting per line, so the diff is the list of what upstream changed. Read it: a new line is a new buff, a changed line is a new range or label. Neither needs code unless the build format keys on it.

2. **If the extractor itself fails**, upstream changed how it builds the panel. Open the builder named in the extractor's comment for that section, see what it now creates (control IDs, names, how options are added), and adjust the extractor. The extractor is the only place allowed to run upstream page code and to touch the DOM.

3. **Re-read the rules whose source changed.** Run the tests. The one in `upstream-rules.test.ts` lists every rewritten rule whose upstream function changed, as `{ rule, upstreamFile, upstreamFunction }`. For each one:

   ```bash
   git -C vendor/ratorio diff "$OLD" "$NEW" -- <upstreamFile>
   ```

   Read what changed in that function and decide whether the rule in `engine-catalog.ts` still says the same thing. If it does not, change the rule and the test named in the manifest. A function that was renamed or moved needs its entry in `upstream-rules.json` edited by hand. Only then accept the new state:

   ```bash
   mise exec -- pnpm --filter @ro-ratorio-branch/core run upstream-rules
   ```

   That command takes every fingerprint again and rewrites the table in the doc. Running it without the re-read defeats it.

4. **Check it against the page**, in both directions.
   - Ours to the page: export a build that uses the thing (`writeSave`), open the URL on the official page and compare what the page shows. The page drops what its own controls would not offer.
   - The page to ours: make a save on the page through its own controls with `scripts/drive-original-page.browser.js` (paste it into the console, or run its helpers through the browser tool). Its helpers refuse anything a control does not offer. Add the URL and the numbers from `shown()` to `savesMadeOnTheOriginal`; the saves test then requires that our catalog offers every value in it and that our engine gives the same numbers. Prefer this direction when in doubt about what the original allows: a refusal by the page is an answer.

## When taking on something the original has and we do not

1. Find where the original defines it. Look for a data table first (`*.dat.js`, `confDataObj` rows). If the definition is only in a builder function or an HTML template of `ro4/m/calcx.html`, it is page-embedded.
2. Split it:
   - **Data** (choices, labels, ranges) that upstream exports: read it in the engine adapter and expose it through `EngineCatalog`.
   - **Data that exists only in builder code or a template:** add a section to the extractor and to `PanelDefinitions`, regenerate, and read the JSON from the adapter. Never run the builder at run time.
   - **Rules** (who is offered what): rewrite them as a plain `EngineCatalog` method, and add an entry to `packages/core/src/engine-adapter/upstream-rules/upstream-rules.json` naming the upstream functions it was rewritten from and the test that pins it; then run the `upstream-rules` command to take the fingerprints and regenerate the doc table. A catalog method that only reads exported data goes under `dataReaders` instead. A method in neither list fails a test.
   - **View:** the screen takes the catalog's plain values and renders them; it holds no knowledge of upstream.
3. Make `notOfferedIn()` in `packages/core/src/sharing/saves-made-on-the-original.test.ts` check the new thing, and add a save made on the original that uses it to `savesMadeOnTheOriginal` (`sharing/golden-save-urls.ts`). The save needs no reference numbers; it is proof that the page offered every value in it.
4. Check it against the page as in step 4 above.

## What done looks like

- `grep -rn "document\b" packages/core/src/engine-adapter --include="*.ts"` finds the DOM only in `browser-globals.ts` (what the engine needs to load) and under `panel-extraction/`.
- The panel staleness test, the rule fingerprints and the saves test all pass, and the doc's generated table is current.
