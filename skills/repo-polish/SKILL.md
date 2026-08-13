---
name: repo-polish
description: Turn a rough repository into a portfolio-quality GitHub project — audit what is missing, write or rewrite the README, add honest badges, a LICENSE, a .gitignore, and repo metadata (description, topics, social preview). Use this whenever the user talks about publishing or open-sourcing a repo, "cleaning up" a project, getting a repo ready for recruiters or a job application, building a portfolio, writing or improving a README, adding badges or a license, or wonders why their GitHub project looks empty or unfinished — even if they never say the word "README".
---

# Repo Polish

Most side projects are judged in under a minute, by someone who will never
read the source. They look at the README's first screen, glance at the file
tree, and decide whether this is a finished thing or an abandoned one. The
code is usually fine. The packaging is what fails.

This skill closes that gap: audit the repo, learn what it actually does, then
write documentation that a stranger can act on.

## The one rule

**Every claim you write must be traceable to something in the repo.**

You will be tempted to write "blazingly fast", "production-ready", "99%
coverage", or an install command you never ran. Don't. A README that
overpromises is worse than a thin one — the first command that fails destroys
the reader's trust in everything else on the page. When you cannot verify
something, either leave it out or mark it plainly (`Roadmap`, `Not yet
implemented`).

The same applies to badges. A green "build passing" badge on a repo with no
CI is a lie that takes one click to catch. See `references/badges.md`.

## Workflow

### 1. Audit

```bash
python skills/repo-polish/scripts/audit_repo.py . 
```

Adjust the path to wherever the skill lives. The script is standard-library
Python, offline, and read-only — it never edits the repo. It reports blocking
problems (missing README or LICENSE, committed secrets or `node_modules`,
placeholder text, broken links) separately from advisory ones (no CI, no
tests, no screenshot).

`--json` gives machine-readable output, `--strict` exits non-zero on blocking
failures, which makes it usable as a CI step.

Deal with committed credentials before anything else, and say so clearly:
removing the file in a new commit does **not** remove it from history, so any
key that was pushed must be treated as burned and rotated.

### 2. Learn the project before writing a word about it

The audit tells you what is missing; it cannot tell you what the project *is*.
Spend real effort here — this is the step that separates a useful README from
generic filler.

- Read the manifest (`package.json`, `pyproject.toml`, `go.mod`, …) for the
  name, entry points, scripts, and dependencies. Dependencies are the fastest
  read on what a project actually does.
- Find the entry point and follow it far enough to describe the main flow in
  one sentence.
- Run the thing if you safely can: `--help`, the test suite, the dev server.
  Real output pasted into the README beats prose describing it.
- Check the git log and any existing docs or issues for the project's purpose
  in the author's own words.
- Note the gaps you cannot resolve — the intended audience, the deployed URL,
  where a screenshot should go. Ask the user about these in one batch rather
  than guessing or leaving `<PLACEHOLDER>` tokens behind.

### 3. Write the README

Structure and section-by-section guidance: `references/readme-anatomy.md`.
A fill-in skeleton: `assets/README.template.md`.

The load-bearing part is the first screen — name, one sentence on what it
does and who it is for, and proof it works (screenshot, GIF, or pasted
terminal output). Everything below that is for people who already decided to
keep reading.

Two habits that matter more than the template:

- **Write install and usage as copy-pasteable blocks**, starting from a fresh
  clone. Then actually run them. The most common README bug is a first command
  that fails on a clean machine.
- **Match the project's real size.** A 200-line script does not need an
  architecture diagram; a framework does. Padding a small project with
  ceremonial sections reads as insecurity.

If the repo already has a README, rewrite rather than replace: keep the
author's accurate content and voice, fix what is stale, add what is missing.
Silently deleting someone's writing is rarely what they wanted.

### 4. Fill in the supporting files

- **LICENSE** — a repo without one is legally closed source, whatever the
  author intended. MIT is the common default for portfolio work; Apache-2.0
  adds a patent grant; GPL-3.0 requires derivatives to stay open. Recommend
  one, state the tradeoff in a sentence, and let the user choose — it is their
  legal decision, not yours. Put the real name and year in the copyright line.
- **.gitignore** — generate for the actual stack, and check whether anything
  it covers is already tracked (`git rm -r --cached` those).
- **CI** — a minimal workflow that installs and runs the tests is enough, and
  it makes the build badge honest. Only add one if there is something to run.
- **CONTRIBUTING / CODE_OF_CONDUCT** — only when the user genuinely wants
  outside contributors. On a solo portfolio repo they are noise.

### 5. Set the repo metadata

The description and topics are what show up in search results and on the
user's profile, and they are the most commonly forgotten step. The
description should read as one plain sentence, not a keyword list. Topics
should be terms someone would actually search.

With the `gh` CLI:

```bash
gh repo edit --description "One sentence on what this does." \
             --add-topic python --add-topic cli
```

If `gh` is unavailable, do it through the GitHub MCP tools or hand the user
the exact values to paste into the repo's settings.

### 6. Verify, then report

Re-run the audit. Then check the things a script cannot: run the install and
usage commands from a clean directory, confirm links and image paths resolve,
and read the first screen once as a stranger would.

Tell the user what you changed, what you assumed, and what still needs them —
a screenshot, a deployed URL, a decision about the license. Be specific about
the leftovers; a vague "you may want to add a screenshot" tends to get
ignored, while "drop a PNG at `docs/demo.png` and the README will pick it up"
gets done.

## Reference files

- `references/readme-anatomy.md` — what belongs in each section, plus
  variants for CLI tools, web apps, libraries, and data/ML projects.
- `references/badges.md` — badge recipes and which ones are honest.
- `assets/README.template.md` — skeleton to fill in.
- `scripts/audit_repo.py` — the audit described in step 1.
