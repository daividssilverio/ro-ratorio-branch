# Bumping the ratorio pin

`vendor/ratorio` is pinned to one upstream `master` commit. A bump is a deliberate change with its own commit: move the pin, check what the adapter depends on, rerun the golden tests, and explain every number that changed.

Run everything from the repository root. `OLD` is the current pin and `NEW` the commit you are moving to.

## 1. See what changed

```bash
OLD=$(git -C vendor/ratorio rev-parse --short HEAD)
git -C vendor/ratorio fetch origin
NEW=$(git -C vendor/ratorio rev-parse --short origin/master)
git -C vendor/ratorio log --oneline "$OLD..$NEW" | wc -l
```

## 2. Check the calc model

The model is the engine's input contract. Any change here must be mirrored in `packages/core/src/engine-adapter/ratorio-calc-model.ts` and in `createBaselineCalcModel()`.

```bash
git -C vendor/ratorio diff "$OLD" "$NEW" -- engine/runtime/calc-model.js
```

## 3. Check the files the adapter touches

The adapter imports a fixed list of upstream modules, declared in `ratorio-modules.d.ts`. This prints which of them changed, moved or disappeared:

```bash
grep -o 'vendor/ratorio/[^"]*' packages/core/src/engine-adapter/ratorio-modules.d.ts \
    | sed 's|vendor/ratorio/||' | sort -u \
    | xargs git -C vendor/ratorio diff --stat --find-renames "$OLD" "$NEW" --
```

A renamed or deleted file needs its path updated in both `ratorio-modules.d.ts` and `ratorio-engine.ts`. Upstream has renamed hundreds of files in one go before.

## 4. Check the workarounds

Each file in `docs/upstream/` describes an engine gap and the workaround the adapter carries for it. For each one, look at whether upstream fixed it between `OLD` and `NEW`. If it did, delete the workaround and mark the proposal as resolved; the tests named in the workaround's comment tell you whether it is still needed.

## 5. Check what the original keeps in its page code

Run the `upstream-ui-split` skill (`.claude/skills/upstream-ui-split/SKILL.md`). It regenerates `packages/core/src/panels/upstream-panels.json`, and walks `docs/upstream-ui-logic.md`: the rules this project rewrote from upstream's page-building code, and the two literals repeated from it.

Names are read the same way: rebuild the readings of names with kanji with `mise exec -- pnpm text-index`. `readings.test.ts` fails for every name that is new or has changed until that is done. Look through what the run adds to `packages/core/src/text/readings-to-check.txt`, and put a reading that is wrong into `reading-overrides.json`. The same run rebuilds the English names (`packages/core/src/text/english/`); `english.test.ts` fails until it is done.

Builds, trees and workspaces that people saved hold upstream names and option positions: support buff names (`CONF_ID_` without the prefix) in `supportBuffs` and in `setSupportBuff` changes, and attack options as `skillOptions` in the order a skill asks for them. When upstream renames one, or adds, removes or reorders a skill's options, saved content would be refused or, worse, read as something else. Look for both in the diff:

```bash
git -C vendor/ratorio diff "$OLD" "$NEW" -- engine/skill engine/chara engine/battle/CAttackMethodAreaComponentManager.js
```

Support buff names are the `CONF_ID_` constants of `engine/chara/` (`CCharaConfYozi.js` and the like); a skill's options are listed in its job file under `engine/skill/` and in `CAttackMethodAreaComponentManager.js`.

Then add the old shape to `packages/core/src/build/earlier-upstream-content.ts`, which the build, tree and workspace parsers run before checking the content, with a test in `earlier-upstream-content.test.ts`. Tell each old shape apart by the content itself (a name that no longer exists, a count of options that no longer fits), so current content comes back as the same object.

## 6. Move the pin and run the tests

```bash
git -C vendor/ratorio checkout "$NEW"
mise exec -- pnpm typecheck
mise exec -- pnpm test
```

## 7. Explain every changed golden number

The golden tests in `reference-build.golden.test.ts` compare whole builds against the numbers the upstream page showed at the old pin. A failing golden test is not fixed by editing the expected number. For each one:

1. Find the upstream commit that changed it. Start from the files of the skill, item or formula involved:

   ```bash
   git -C vendor/ratorio log --oneline "$OLD..$NEW" -- engine/skill engine/battle engine/status
   ```

2. Confirm the new number on the upstream page. Open the build there and run `scripts/extract-reference-build.browser.js`; the published page must be at `NEW` for this to be a fair comparison.
3. Only then update the fixture: the numbers and its `upstreamCommit`.
4. Name the upstream commit and the reason in the bump's commit message.

If the adapter and the upstream page disagree at the same commit, the bump did not cause it: a headless gap did. Write it up in `docs/upstream/` before going further.

## 8. Commit

Commit the pin by itself, then anything it required (model types, paths, fixtures) in the same or a following commit, with the explanation from step 7.

```bash
git add vendor/ratorio
git commit -m "Bump ratorio to $NEW"
```

Afterwards update the commit named in the "Engine notes" heading of `CLAUDE.md` and in the `Status` line of each open proposal in `docs/upstream/`.
