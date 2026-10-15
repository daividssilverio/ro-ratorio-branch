---
name: working-modes
description: 'How to work in this repository: four modes (query, build, review, brainstorm), the checks every change passes, how tests assert, and the handoff note that ends a chunk. Use it for any task here; when a message starts with "query:", "build:", "review:" or "brainstorm:" use that mode, otherwise pick the closest one and say which in the first line.'
---

# Working modes

Whoever asked for the work should come away able to explain what was done, why it exists, how it fits the engine adapter and the app, and how to extend it without help. Every mode serves that.

## Pick a mode

| Mode | What the asker wants | Who writes code |
| --- | --- | --- |
| query | One thing, with the smallest example, explained well | you, about 20 lines at most |
| build | Delegated, specified work, done in small verifiable chunks | you |
| review | What is wrong in the code and in how it fits the system | nobody; findings and fix directions |
| brainstorm | A decision or a spec: options, costs, diagrams | nobody |

1. A prefix (`build:`) wins.
2. Without one, infer the mode and name it in the first line ("Build mode."). A visible misfire is cheap; a silent one wastes time.
3. If a query turns out to be large, answer the small version and offer a brainstorm in one line.

## Every mode

**Shape.** The answer first, then the big picture, then the details, then how to check it.

**Confidence flags** on claims that matter (engine behaviour, upstream data, APIs, limits):

- **Solid**: checked here, by a file read, a test run, a page fetched or the original page compared. Say how.
- **Check me**: from memory. Give the smallest pointer that confirms it (a function, a file, a doc page).
- **Speculative**: reasoning. Say what observation would confirm or kill it.

**Diagrams** are mermaid, in `docs/diagrams/<topic>.md`; the terminal cannot draw them, so the reply carries the path and a two-line summary.

**Code** reads on its own: full-word names (`attackMethodsOfBuild`, not `ams`), comments only for a non-obvious why, never a mention of a conversation, a plan or a local-only document. A new abstraction or pattern states in one line what it buys and what the code would look like without it.

## query

TLDR in a line or two, the smallest example in TypeScript with this repo's names, two to five sentences on why it works, one line on how to check it, one flagged source.

## build

1. Restate the task in at most five bullets: what, inputs, outputs, constraints, done when. With no spec, ask, or suggest a brainstorm; do not invent one.
2. Work on a branch named after the change, in chunks small enough to read and check in a few minutes.
3. Each chunk passes, in this order, before it is committed:
   - `mise exec -- pnpm typecheck` with no errors;
   - `mise exec -- pnpm test`;
   - for a screen: both sizes (phone and 900 px and up) checked in the browser, in Japanese and English;
   - the `commit-privacy-check` skill, then `git commit` (the hooks run it again; never `--no-verify`).
4. One commit per green chunk, fast-forwarded into `main`. Nothing is pushed unless asked.
5. Stay in scope. Anything worth doing outside it goes under open questions in the handoff.
6. End with the handoff note below.

Tests are written where correctness is defined: by upstream's numbers, by an existing test, or by the person asking. When it is not defined, ask rather than inventing the behaviour in a test.

## review

Read the context first: the callers, the engine adapter rule or catalog method involved, the view model behind a screen. Then:

- **TLDR**: ship, fix first, or rethink, and the biggest issue.
- **System view**: a mermaid diagram of where the code sits (engine frame, core, web, CLI, MCP).
- **Findings** by severity (bug, risk, smell). Each says where, what, why it matters, how to see it (a failing test or a repro) and the direction of the fix.
- Two lenses, both required: the implementation (edge cases, error paths, names that mislead, tests that assert on the wrong thing) and the integration (parity with the original page, the build format, undo history, the offline cache, upstream index constants instead of raw indices).

## brainstorm

The recommendation and the decisions still open first; then a diagram of what exists and what is new; two to four options, each with what it buys, what it costs and when it wins; then the points to push back on, each with a recommendation. Push back freely and do not soften the costs. Once the decisions are made, write a short spec: goal, out of scope, pieces, decisions with reasons, done when.

## Tests

- Assert on types, IDs and numbers, never on message text: the wording changes, and a test tied to it fails for no logical reason.

  ```ts
  // Breaks when the wording changes, and says nothing about the cause.
  expect(error.message).toBe("unknown weapon element 99");

  // Names the branch that went wrong.
  expect(issues).toEqual([{ kind: "unknownWeaponElement", elementId: 99 }]);
  ```

- One behaviour per test, named as the behaviour: `it("gives way to an element the character is endowed with")`.
- Table-driven tests (`it.each`) for one behaviour over many inputs, such as the market listings in `listings-from-the-official-tool.ts`.
- Golden damage tests compare with numbers read off the original page. A changed number is traced to an upstream commit before it is accepted.

## Handoff note

Every build chunk ends with:

- **Done**: what changed, and the commit.
- **Why**: the reason, in a line or two.
- **How to extend**: where the next case goes (a new row, a new catalog method, a new host request).
- **Delegable**: what is routine enough to hand off.
- **Open questions**: anything out of scope, and the claims flagged Check me or Speculative.
- **Patterns**: when one was introduced, why it exists and what it costs.
