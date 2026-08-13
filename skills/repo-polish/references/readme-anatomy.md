# README anatomy

How to fill each section, and how the shape changes by project type.

- [The first screen](#the-first-screen)
- [Section by section](#section-by-section)
- [Variants by project type](#variants-by-project-type)
- [Common failure modes](#common-failure-modes)

## The first screen

Everything above the reader's first scroll has one job: let them decide
whether this project is relevant to them. Four elements, in this order:

1. **Name** as an `H1`, and nothing else on that line.
2. **One sentence** — what it does, for whom. Not a mission statement.
   Good: "A CLI that converts Notion exports into Hugo-ready Markdown,
   preserving nested pages and image links."
   Bad: "A powerful and flexible tool for content transformation."
3. **Badges**, if any are honest (see `badges.md`). One line, three to five.
4. **Proof it works** — a screenshot, a GIF, or a pasted terminal session.

That fourth element is the one people skip and the one that changes the
impression most. A repo that shows its output reads as finished; a repo that
only describes itself reads as an idea.

If there is no visual to show, paste a real run:

````markdown
```console
$ notion2hugo export.zip --out content/
✓ 42 pages converted
✓ 118 images rewritten to /static/img
```
````

## Section by section

### What it is / Why it exists

Two to four sentences. The useful content here is the problem, not the
solution — what was annoying enough that this got built, and what the
alternatives don't do. This is also where a reader self-selects out, which is
a feature.

Skip a separate "Features" list unless the project has genuinely distinct
capabilities. On small projects a bulleted feature list is usually the same
sentence three times.

### Install

Start from a fresh clone and assume nothing is installed. Include the
prerequisite versions that actually matter (`Node 20+`, `Python 3.10+`), and
prefer the ecosystem's normal path:

````markdown
```bash
git clone https://github.com/OWNER/REPO.git
cd REPO
pip install -e .
```
````

If the project needs configuration to run at all — an API key, a `.env`, a
database — that belongs here, not buried below usage. Show the variable
names and a `.env.example`, never a real key.

### Usage

Lead with the single most common invocation, then the two or three next most
common. Show output, not just input. Keep the exhaustive flag reference for
`--help` or a separate docs page; a wall of options in a README pushes
everything else off the screen.

For libraries, the equivalent is a minimal working snippet the reader can
paste into a file and run — imports included, no `...` elisions.

### How it works (optional)

Worth writing when the project has a non-obvious design decision, and worth
skipping otherwise. Two to five sentences, or a small diagram. This is the
section that shows judgement to a technical reader, so make it about
tradeoffs — why this approach over the obvious one — rather than a narration
of the call stack.

### Development / Tests

How to run the test suite and the linter. Short.

### Roadmap / Limitations

Naming what the project does *not* do is a credibility gain, not a
weakness — it shows you know the boundaries of your own work. Keep it to
honest bullets, not aspirational features you will never build.

### License

One line, linking to the LICENSE file. Match the actual file — a README
saying MIT over an Apache LICENSE is a real problem, not a typo.

## Variants by project type

**CLI tool** — Usage is the star. Show a real session with output, list the
handful of flags people actually use, and mention how to install it globally
(`pipx`, `npm i -g`, `brew`). A terminal GIF is worth the effort here.

**Web app** — Lead with a screenshot and a live demo link if one exists.
Cover environment variables and the deploy story explicitly; a web app README
without setup config is the most common broken one. Note the stack in one
line so readers can tell if it is relevant to them.

**Library / package** — Lead with the install line and a working code
snippet, in that order. Document the public API surface, but link out for the
full reference. Include the version support policy if it has one.

**Data / ML project** — State the question being answered and the headline
result up front, with the key figure embedded. Say where the data comes from
and whether it is included, licensed, or must be downloaded. Note the
compute needed to reproduce, and be explicit about what was measured on what
split — vague metric claims are the fastest way to lose a technical reader.

**Learning project / clone** — Say so plainly in the first sentence. "A
Redis clone written to learn how event loops work" is a strong opening;
presenting it as a production database is not. Then write what you learned
and what you would do differently, which is the part a reviewer actually
wants to read.

## Common failure modes

- **The scaffold README.** Whatever `create-next-app` generated is still
  sitting there. Delete all of it.
- **Placeholders shipped.** `your-username`, `<YOUR_API_KEY>`, `TODO: add
  description`. The audit script catches these.
- **Install that doesn't work.** Missing prerequisite, wrong package name, a
  step the author has had in their shell history for a year. Run it clean.
- **Screenshot rot.** An image of a UI that no longer exists. Worse than none.
- **Description drift.** The README describes v1; the code is v3.
- **Wall of badges.** Eight badges, six of them meaningless, pushing the
  actual content below the fold.
- **No license.** The single most common reason a good repo can't be reused.
