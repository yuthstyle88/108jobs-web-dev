# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in
this repository.


## Bugs: open the issue before you fix it

Standing rule from the owner (2026-08-18) — **"กรณีเจอบักให้เปิด issue ก่อนทำงาน"**.

Before writing a fix, search — **including closed issues**, because a closed one is the
record that this was already resolved:

```
gh issue list --state all --search "<symptom keywords>"
```

Most repos here exist twice — `108-Plaza/<name>` and a `yuthstyle88/<name>-dev` mirror — so search **both** issue lists.

If there is none, open one **in the repo where the PR will merge** (`Fixes #N` only
auto-closes an issue in the same repo, and trunk is often the mirror, not the org copy).
Title it after the *symptom*, never the fix; label it `bug`; put the repro and the
evidence that proves it (file:line, sha, the actual response) in the body.

Then carry `Fixes #N` in the PR body so the merge closes the issue — that auto-close is
the whole resolution record. One issue per finding; a batched PR carries one `Fixes #N`
line per issue it closes.

A finding that turns out to be by-design or a false alarm still gets its issue **closed
with that reason** — that is what stops the next sweep re-investigating it. A bug you are
not fixing yet still gets an issue; deferred work with no issue is invisible work.

Narrow exceptions: something you broke and fixed inside your own unmerged branch, or a
typo in code being written this minute. Anything already merged, deployed, or reported by
the owner is a bug → issue first.

## `AGENTS.md` — the same file, for Codex (2026-09-02)

`AGENTS.md` beside this file is a **symlink to this file**, so Codex / ChatGPT —
which looks for `AGENTS.md` and never loads `CLAUDE.md` — starts with the same
control document Claude Code does. A symlink rather than a copy on purpose: a
copy drifts the day one side is edited. Keep it a symlink; edit only this file.
Rolled out across the ecosystem 2026-09-02; `CLAUDE.md` stays the canonical name
because the control-doc standard names it (`108-ting-ecosystem-docs/CONTROL_DOC_COVERAGE.md`).
