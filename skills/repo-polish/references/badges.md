# Badges

Badges are a compression format: five small images telling a reader that this
project is tested, released, licensed, and maintained. They work because they
are *checkable* — every one is a live link to a system of record.

Which means a badge that isn't backed by anything is not decoration, it is a
false claim, and it is the easiest kind to catch. Never hardcode a status.

## The honest set

Three to five badges on one line, directly under the title. In rough order of
value:

| Badge | When it is earned | Markdown |
| --- | --- | --- |
| CI status | there is a workflow that runs on push | `[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)` |
| Package version | published to a registry | `[![PyPI](https://img.shields.io/pypi/v/PKG)](https://pypi.org/project/PKG/)` |
| | | `[![npm](https://img.shields.io/npm/v/PKG)](https://www.npmjs.com/package/PKG)` |
| License | a LICENSE file exists and matches | `[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)` |
| Language version | a real floor you support | `[![Python](https://img.shields.io/badge/python-3.10%2B-blue)](pyproject.toml)` |
| Coverage | a coverage service is wired up | `[![codecov](https://codecov.io/gh/OWNER/REPO/branch/main/graph/badge.svg)](https://codecov.io/gh/OWNER/REPO)` |
| Live demo | the URL is up right now | `[![Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://example.com)` |

The GitHub Actions badge URL is the workflow *file* path, not the workflow
name — `.github/workflows/ci.yml` becomes `/actions/workflows/ci.yml/badge.svg`.
It renders "no status" until the workflow has run at least once on the
default branch, which is normal and not a broken badge.

Badges pull the default branch unless told otherwise. If the repo's default
branch isn't `main`, append `?branch=<name>`.

## Skip these

- **Hardcoded "build passing"** with no CI behind it.
- **A coverage percentage typed by hand.** It will be wrong within a week.
- **"PRs welcome" / "made with love"** on a repo with no CONTRIBUTING and no
  intention of merging anything.
- **Stars, forks, followers.** Low numbers advertise the wrong thing; the
  reader can already see them at the top of the page.
- **A stack of "built with" logos.** The stack belongs in a sentence, where
  it is searchable.
- **Anything below the fold.** If badges push your screenshot off the first
  screen, cut badges.

## Static badges

For facts with no service behind them, `shields.io/badge` is fine and honest,
as long as the fact is true and stable:

```
https://img.shields.io/badge/<label>-<message>-<color>
```

Escape with URL encoding: `-` → `--`, spaces → `%20` or `_`, `+` → `%2B`.
So "python 3.10+" becomes `python-3.10%2B-blue`.

Use the same color family across a row (`blue`, `informational`, `slate`) and
reserve green for things that are genuinely passing. Add `?style=flat-square`
consistently or not at all — mixed styles read as accidental.
