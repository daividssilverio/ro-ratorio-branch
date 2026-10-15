---
name: commit-privacy-check
description: Verify that a commit publishes nothing personal about the author or their computer. Use before every `git commit` in this repository, before a push, before the repository goes public, and whenever the user asks whether something is safe to commit or share. Runs the scanner, then reads the staged diff for what a pattern cannot catch.
---

# commit-privacy-check

This repository is meant to be public. The git hooks in `.githooks` already refuse a commit when a pattern matches; this skill adds the reading a pattern cannot do. The hook is the safety net, not the check: run these steps before every commit.

## Steps

1. **Stage exactly what will be committed**, then run the scanner:

   ```bash
   scripts/check-commit-privacy.sh
   ```

   Exit 0 means no pattern matched. Exit 1 prints one finding per line: the kind, then `file:line:text`.

2. **Read `git diff --cached` yourself** for what the scanner cannot know:
   - real names, handles, phone numbers, addresses, employers or clients, and anything about a person other than the author
   - game account names, character names and guild names; fixtures use made-up ones
   - machine details: shell profile contents, installed tool paths, hardware serials, network names, IP and MAC addresses
   - pasted terminal output or stack traces (prompts and traces carry user names and home paths)
   - binary files and images (the scanner skips binary content, and image metadata can hold a location or device name)
   - links that only the author can open, private repositories, internal tickets

3. **Check the commit message** the same way. The `commit-msg` hook scans it too.

4. **Author identity.** On the first commit of a session, show `git config user.name` and `git config user.email` and say that both are published with every commit. Never change git config yourself.

5. **Handle each finding.**
   - A real leak: remove or reword it, restage, rerun.
   - A false positive, or something the author publishes on purpose: show the user the line and ask. Only after a yes, add the exact text to `.commit-privacy-allowlist` with a `#` line above it saying why it is safe.
   - Never commit with `--no-verify`, and never loosen the scanner to make a commit pass.

6. **Report** in one or two lines: the scanner result, what you read, and anything added to the allowlist.

## Before the first push or going public

```bash
scripts/check-commit-privacy.sh --tracked
```

This scans every tracked file as it is now. Earlier commits are not rescanned; if a leak was committed and later removed, it is still in history. Say so, and leave rewriting history to the user.

## Extending the scanner

One `record_matches <kind> ...` line in `scan_content` adds a pattern. Give every new pattern its own kind so a finding names what was matched. After a change, stage a file holding a sample of the new leak and confirm the scanner exits 1.
