#!/usr/bin/env python3
"""Audit a repository for portfolio readiness.

Answers one question: if a stranger — a recruiter, a hiring manager, a
potential contributor — landed on this repo right now, what would stop them
from understanding it in 30 seconds?

The checks are deliberately split in two:

  blocking  Things that make a public repo look unfinished or leak data.
            These fail the audit (exit code 1 with --strict).
  advisory  Things that make a repo look cared for. Worth doing, but a repo
            without them is still publishable.

Standard library only, no network access. Works with or without git.

Usage:
    python audit_repo.py [PATH] [--json] [--strict] [--quiet]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

PASS, FAIL, WARN, INFO = "pass", "fail", "warn", "info"

MAX_TRACKED_FILE_BYTES = 5 * 1024 * 1024
README_THIN_WORDS = 80

# Files that should never be committed. Matched against the tracked-file list.
SECRET_PATTERNS = [
    re.compile(r"(^|/)\.env(\.|$)(?!example|sample|template)", re.I),
    re.compile(r"\.pem$", re.I),
    re.compile(r"\.p12$|\.pfx$|\.keystore$|\.jks$", re.I),
    re.compile(r"(^|/)id_(rsa|dsa|ecdsa|ed25519)$"),
    re.compile(r"(^|/)\.npmrc$|(^|/)\.pypirc$|(^|/)\.netrc$"),
    re.compile(r"(^|/)credentials\.json$|(^|/)service[-_]account.*\.json$", re.I),
    re.compile(r"(^|/)secrets?\.(ya?ml|json|toml|ini)$", re.I),
]

# Directories that belong in .gitignore, not in the repo.
VENDORED_DIRS = [
    "node_modules/",
    "vendor/bundle/",
    ".venv/",
    "venv/",
    "env/lib/",
    "__pycache__/",
    "target/debug/",
    "target/release/",
    "dist/",
    "build/",
    ".next/",
    ".gradle/",
    "Pods/",
]

# Text that means "nobody finished writing this".
PLACEHOLDER_PATTERNS = [
    (re.compile(r"\byour[-_ ]?(user)?name\b", re.I), "your-username placeholder"),
    (re.compile(r"\blorem ipsum\b", re.I), "lorem ipsum filler"),
    (re.compile(r"\bTODO\b|\bTBD\b|\bFIXME\b"), "TODO/TBD/FIXME marker"),
    (re.compile(r"<[A-Z_]{3,}>"), "<PLACEHOLDER> token"),
    (re.compile(r"Getting Started with Create React App", re.I), "unmodified CRA scaffold"),
    (re.compile(r"^#+\s*(Project|Repo(sitory)?) ?(Title|Name)\s*$", re.M | re.I), "unfilled title heading"),
    (re.compile(r"\bcoming soon\b|\bunder construction\b", re.I), "coming-soon notice"),
]

# manifest filename -> (project label, how to say "install" for this ecosystem)
MANIFESTS = {
    "package.json": ("JavaScript / TypeScript", "npm install"),
    "pyproject.toml": ("Python", "pip install -e ."),
    "setup.py": ("Python", "pip install -e ."),
    "requirements.txt": ("Python", "pip install -r requirements.txt"),
    "Cargo.toml": ("Rust", "cargo build"),
    "go.mod": ("Go", "go build ./..."),
    "pom.xml": ("Java (Maven)", "mvn install"),
    "build.gradle": ("Java / Kotlin (Gradle)", "./gradlew build"),
    "build.gradle.kts": ("Kotlin (Gradle)", "./gradlew build"),
    "Gemfile": ("Ruby", "bundle install"),
    "composer.json": ("PHP", "composer install"),
    "pubspec.yaml": ("Dart / Flutter", "flutter pub get"),
    "Package.swift": ("Swift", "swift build"),
    "mix.exs": ("Elixir", "mix deps.get"),
    "CMakeLists.txt": ("C / C++", "cmake -B build && cmake --build build"),
}

README_SECTIONS = {
    "what it is": re.compile(r"about|overview|what is|introduction|why\b", re.I),
    "install": re.compile(r"install|setup|set up|getting started|quick ?start|requirement", re.I),
    "usage": re.compile(r"usage|how to use|example|quick ?start|running|commands?\b", re.I),
    "license": re.compile(r"licen[sc]e", re.I),
}

SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build", ".next", "target"}


@dataclass
class Check:
    id: str
    title: str
    status: str
    detail: str = ""
    fix: str = ""
    blocking: bool = False


@dataclass
class Audit:
    root: Path
    checks: list[Check] = field(default_factory=list)
    facts: dict = field(default_factory=dict)

    def add(self, check: Check) -> None:
        self.checks.append(check)

    @property
    def failures(self) -> list[Check]:
        return [c for c in self.checks if c.status == FAIL]

    @property
    def warnings(self) -> list[Check]:
        return [c for c in self.checks if c.status == WARN]

    @property
    def score(self) -> tuple[int, int]:
        scored = [c for c in self.checks if c.status in (PASS, FAIL, WARN)]
        return sum(1 for c in scored if c.status == PASS), len(scored)


# --------------------------------------------------------------------------
# collecting facts
# --------------------------------------------------------------------------


def git(root: Path, *args: str) -> str | None:
    try:
        out = subprocess.run(
            ["git", *args],
            cwd=root,
            capture_output=True,
            text=True,
            timeout=20,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return out.stdout if out.returncode == 0 else None


def list_files(root: Path) -> tuple[list[str], bool]:
    """Return repo-relative paths. Prefers git's index, falls back to walking."""
    tracked = git(root, "ls-files")
    if tracked is not None:
        files = [line for line in tracked.splitlines() if line]
        if files:
            return files, True

    files = []
    for dirpath, dirnames, filenames in os.walk(root):
        pruned = [d for d in dirnames if d in SKIP_DIRS]
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        # Record pruned directories as markers so the hygiene checks can still
        # see a node_modules/ or dist/ sitting in the tree without walking it.
        for name in pruned:
            if name == ".git":
                continue
            rel = os.path.relpath(os.path.join(dirpath, name), root)
            files.append(rel.replace(os.sep, "/") + "/")
        for name in filenames:
            rel = os.path.relpath(os.path.join(dirpath, name), root)
            files.append(rel.replace(os.sep, "/"))
    return files, False


def find_one(files: list[str], *names: str) -> str | None:
    """Find a root-level file by name, case-insensitively, extension-agnostic."""
    wanted = {n.lower() for n in names}
    for path in files:
        if "/" in path:
            continue
        stem = path.lower()
        base = stem.rsplit(".", 1)[0] if "." in stem else stem
        if stem in wanted or base in wanted:
            return path
    return None


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def strip_code_fences(text: str) -> str:
    return re.sub(r"^```.*?^```", "", text, flags=re.S | re.M)


# --------------------------------------------------------------------------
# checks
# --------------------------------------------------------------------------


def check_readme(audit: Audit, files: list[str]) -> None:
    root = audit.root
    readme = find_one(files, "readme")
    audit.facts["readme"] = readme

    if not readme:
        audit.add(Check(
            "readme.exists", "README exists", FAIL, blocking=True,
            detail="No README found at the repo root.",
            fix="Write README.md — it is the only file most visitors will ever read.",
        ))
        return

    text = read_text(root / readme)
    body = strip_code_fences(text)
    words = len(body.split())
    audit.facts["readme_words"] = words

    audit.add(Check("readme.exists", "README exists", PASS, detail=readme, blocking=True))

    if words < README_THIN_WORDS:
        audit.add(Check(
            "readme.substance", "README says enough to be useful", FAIL, blocking=True,
            detail=f"{words} words of prose — too thin to explain the project.",
            fix="Cover what it is, who it's for, how to run it, and what it looks like.",
        ))
    else:
        audit.add(Check("readme.substance", "README says enough to be useful", PASS,
                        detail=f"{words} words of prose", blocking=True))

    headings = [h.strip() for h in re.findall(r"^#{1,4}\s+(.+)$", body, re.M)]
    audit.facts["readme_headings"] = headings
    missing = [
        label for label, pattern in README_SECTIONS.items()
        if not any(pattern.search(h) for h in headings)
    ]
    # The opening paragraph often covers "what it is" without a heading.
    if "what it is" in missing:
        opening = body.split("\n#", 1)[0]
        if len(opening.split()) > 25:
            missing.remove("what it is")
    if missing:
        audit.add(Check(
            "readme.sections", "README covers the core sections", WARN,
            detail="missing: " + ", ".join(missing),
            fix="See references/readme-anatomy.md for what each section should contain.",
        ))
    else:
        audit.add(Check("readme.sections", "README covers the core sections", PASS,
                        detail=f"{len(headings)} headings"))

    found = [label for pattern, label in PLACEHOLDER_PATTERNS if pattern.search(body)]
    if found:
        audit.add(Check(
            "readme.placeholders", "README has no leftover placeholder text", FAIL, blocking=True,
            detail="; ".join(sorted(set(found))),
            fix="Replace every placeholder with a real value, or delete the section.",
        ))
    else:
        audit.add(Check("readme.placeholders", "README has no leftover placeholder text",
                        PASS, blocking=True))

    badges = len(re.findall(r"!\[[^\]]*\]\(https://(img\.shields\.io|badgen\.net)/", text))
    audit.facts["badges"] = badges
    if badges:
        audit.add(Check("readme.badges", "README carries status badges", PASS,
                        detail=f"{badges} badge(s)"))
    else:
        audit.add(Check(
            "readme.badges", "README carries status badges", WARN,
            detail="no shields.io badges found",
            fix="Add only badges backed by something real — see references/badges.md.",
        ))

    has_image = bool(re.search(r"!\[[^\]]*\]\([^)]+\.(png|jpe?g|gif|svg|webp)", text, re.I)) \
        or "<img" in text
    has_demo_block = bool(re.search(r"```(console|shell|bash|sh|text)\b", text))
    if has_image:
        audit.add(Check("readme.visual", "README shows the project, not just describes it",
                        PASS, detail="image or screenshot embedded"))
    elif has_demo_block:
        audit.add(Check("readme.visual", "README shows the project, not just describes it",
                        WARN, detail="terminal transcript only, no screenshot",
                        fix="A screenshot or GIF is what makes a repo look alive."))
    else:
        audit.add(Check(
            "readme.visual", "README shows the project, not just describes it", WARN,
            detail="no screenshot, GIF, or sample output",
            fix="Add one image or a copy-pasted run of the tool near the top.",
        ))

    broken = broken_relative_links(root, readme, text)
    if broken:
        audit.add(Check(
            "readme.links", "README links resolve", FAIL, blocking=True,
            detail="broken: " + ", ".join(broken[:6]) + (" …" if len(broken) > 6 else ""),
            fix="Fix or remove links pointing at files that do not exist.",
        ))
    else:
        audit.add(Check("readme.links", "README links resolve", PASS, blocking=True))


def broken_relative_links(root: Path, readme: str, text: str) -> list[str]:
    base = (root / readme).parent
    broken = []
    for target in re.findall(r"\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)", text):
        if re.match(r"^(https?:|mailto:|#|data:|<)", target):
            continue
        path = target.split("#", 1)[0].split("?", 1)[0]
        if not path:
            continue
        candidate = (base / path).resolve()
        if not candidate.exists():
            broken.append(target)
    return broken


def check_repo_files(audit: Audit, files: list[str]) -> None:
    root = audit.root

    license_file = find_one(files, "license", "licence", "copying")
    if license_file:
        audit.add(Check("files.license", "LICENSE present", PASS,
                        detail=license_file, blocking=True))
    else:
        audit.add(Check(
            "files.license", "LICENSE present", FAIL, blocking=True,
            detail="no LICENSE file",
            fix="Without a license, nobody may legally reuse the code. MIT is the usual default.",
        ))

    if find_one(files, ".gitignore") or (root / ".gitignore").exists():
        audit.add(Check("files.gitignore", ".gitignore present", PASS, blocking=True))
    else:
        audit.add(Check(
            "files.gitignore", ".gitignore present", FAIL, blocking=True,
            detail="no .gitignore",
            fix="Add one for your stack before build output or secrets get committed.",
        ))

    has_ci = any(f.startswith(".github/workflows/") for f in files) \
        or any(f.startswith(p) for f in files for p in (".gitlab-ci", ".circleci/", "azure-pipelines"))
    audit.facts["ci"] = has_ci
    audit.add(Check(
        "files.ci", "Continuous integration configured",
        PASS if has_ci else WARN,
        detail="workflow found" if has_ci else "no CI workflow",
        fix="" if has_ci else "A green CI badge is the cheapest credibility signal there is.",
    ))

    test_files = [f for f in files if re.search(r"(^|/)(tests?|spec|__tests__)/", f)
                  or re.search(r"(^|/)(test_[^/]+|[^/]+_test|[^/]+\.(test|spec))\.[a-z]+$", f)]
    audit.facts["test_files"] = len(test_files)
    audit.add(Check(
        "files.tests", "Tests exist",
        PASS if test_files else WARN,
        detail=f"{len(test_files)} test file(s)" if test_files else "no test files found",
        fix="" if test_files else "Even a handful of tests signals the code is meant to be trusted.",
    ))

    if find_one(files, "contributing") or any(f.lower().startswith(".github/contributing") for f in files):
        audit.add(Check("files.contributing", "CONTRIBUTING guide", PASS))
    else:
        audit.add(Check("files.contributing", "CONTRIBUTING guide", WARN,
                        detail="none",
                        fix="Only worth adding if you actually want outside contributions."))


def check_hygiene(audit: Audit, files: list[str], from_git: bool) -> None:
    root = audit.root

    leaked = [f for f in files if any(p.search(f) for p in SECRET_PATTERNS)]
    if leaked:
        audit.add(Check(
            "hygiene.secrets", "No credential-shaped files committed", FAIL, blocking=True,
            detail=", ".join(leaked[:8]),
            fix="Remove them, rotate anything they contained, and gitignore the paths. "
                "Deleting in a new commit does not erase history.",
        ))
    else:
        audit.add(Check("hygiene.secrets", "No credential-shaped files committed",
                        PASS, blocking=True))

    vendored = sorted({d for d in VENDORED_DIRS
                       for f in files if f.startswith(d) or f"/{d}" in f})
    if vendored:
        audit.add(Check(
            "hygiene.vendored", "No dependency or build directories committed", FAIL, blocking=True,
            detail=", ".join(vendored[:6]),
            fix="Add these to .gitignore and `git rm -r --cached` them.",
        ))
    else:
        audit.add(Check("hygiene.vendored", "No dependency or build directories committed",
                        PASS, blocking=True))

    heavy = []
    for f in files:
        if f.endswith("/"):
            continue
        try:
            size = (root / f).stat().st_size
        except OSError:
            continue
        if size > MAX_TRACKED_FILE_BYTES:
            heavy.append(f"{f} ({size / 1024 / 1024:.1f} MB)")
    if heavy:
        audit.add(Check(
            "hygiene.large_files", "No oversized files in the tree", FAIL, blocking=True,
            detail=", ".join(sorted(heavy)[:5]),
            fix="Move large assets out of git, or use Git LFS.",
        ))
    else:
        audit.add(Check("hygiene.large_files", "No oversized files in the tree",
                        PASS, blocking=True))

    if not from_git:
        audit.add(Check("hygiene.git", "Git repository", INFO,
                        detail="not a git repo (or empty index) — walked the filesystem instead"))
        return

    count = git(root, "rev-list", "--count", "HEAD")
    branch = git(root, "rev-parse", "--abbrev-ref", "HEAD")
    if count:
        audit.facts["commits"] = int(count.strip())
    if branch:
        audit.facts["branch"] = branch.strip()

    if audit.facts.get("commits", 0) == 1:
        audit.add(Check(
            "hygiene.history", "Commit history tells a story", WARN,
            detail="a single commit",
            fix="Not fatal, but a one-commit repo reads as a code dump rather than a project.",
        ))
    elif "commits" in audit.facts:
        subjects = (git(root, "log", "--format=%s", "-30") or "").splitlines()
        noisy = [s for s in subjects
                 if re.fullmatch(r"(update|fix|wip|test|asdf|\.+|commit|changes)\.?", s.strip(), re.I)]
        if len(noisy) > max(2, len(subjects) // 3):
            audit.add(Check(
                "hygiene.history", "Commit history tells a story", WARN,
                detail=f"{len(noisy)} of the last {len(subjects)} messages are placeholders "
                       "(\"update\", \"wip\", \"fix\")",
                fix="Future commits are cheap to write well; past ones are rarely worth rewriting.",
            ))
        else:
            audit.add(Check("hygiene.history", "Commit history tells a story", PASS,
                            detail=f"{audit.facts['commits']} commits"))


def detect_project(audit: Audit, files: list[str]) -> None:
    found = [(MANIFESTS[f][0], f, MANIFESTS[f][1]) for f in files if f in MANIFESTS]
    if found:
        audit.facts["project_types"] = sorted({label for label, _, _ in found})
        audit.facts["manifests"] = [f for _, f, _ in found]
        audit.facts["install_hint"] = found[0][2]
    else:
        audit.facts["project_types"] = []
        audit.add(Check(
            "project.manifest", "Ecosystem is identifiable", WARN,
            detail="no recognised manifest (package.json, pyproject.toml, go.mod, …)",
            fix="Visitors work out how to run a project from its manifest. "
                "If there genuinely isn't one, say so explicitly in the README.",
        ))


# --------------------------------------------------------------------------
# reporting
# --------------------------------------------------------------------------


def render(audit: Audit) -> str:
    passed, total = audit.score
    lines = [f"# Repo audit — {audit.root.resolve().name}", ""]

    facts = audit.facts
    bits = []
    if facts.get("project_types"):
        bits.append("Stack: " + ", ".join(facts["project_types"]))
    if "commits" in facts:
        bits.append(f"Commits: {facts['commits']}")
    if facts.get("branch"):
        bits.append(f"Branch: {facts['branch']}")
    if facts.get("readme_words") is not None:
        bits.append(f"README: {facts['readme_words']} words")
    if bits:
        lines += ["  ·  ".join(bits), ""]

    lines += [f"**{passed}/{total} checks passed** — "
              f"{len(audit.failures)} blocking, {len(audit.warnings)} advisory.", ""]

    def block(title: str, items: list[Check], marker: str) -> list[str]:
        if not items:
            return []
        out = [f"## {title}", ""]
        for c in items:
            out.append(f"{marker} **{c.title}**" + (f" — {c.detail}" if c.detail else ""))
            if c.fix:
                out.append(f"  ↳ {c.fix}")
        out.append("")
        return out

    lines += block("Blocking", audit.failures, "- [ ]")
    lines += block("Worth fixing", audit.warnings, "- [ ]")
    lines += block("Passing", [c for c in audit.checks if c.status == PASS], "- [x]")
    notes = [c for c in audit.checks if c.status == INFO]
    if notes:
        lines += ["## Notes", ""] + [f"- {c.detail or c.title}" for c in notes] + [""]

    if not audit.failures:
        lines.append("No blocking issues. Anything above is polish, not a stop-ship.")
    return "\n".join(lines)


def to_json(audit: Audit) -> str:
    passed, total = audit.score
    return json.dumps({
        "root": str(audit.root.resolve()),
        "score": {"passed": passed, "total": total},
        "facts": audit.facts,
        "checks": [c.__dict__ for c in audit.checks],
    }, indent=2)


def run(root: Path) -> Audit:
    audit = Audit(root=root)
    files, from_git = list_files(root)
    audit.facts["file_count"] = len(files)
    detect_project(audit, files)
    check_readme(audit, files)
    check_repo_files(audit, files)
    check_hygiene(audit, files, from_git)
    return audit


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("path", nargs="?", default=".", help="repository root (default: cwd)")
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    parser.add_argument("--strict", action="store_true", help="exit 1 if any blocking check fails")
    parser.add_argument("--quiet", action="store_true", help="print only the summary line")
    args = parser.parse_args(argv)

    root = Path(args.path)
    if not root.is_dir():
        print(f"error: {root} is not a directory", file=sys.stderr)
        return 2

    audit = run(root)
    if args.json:
        print(to_json(audit))
    elif args.quiet:
        passed, total = audit.score
        print(f"{passed}/{total} checks passed, {len(audit.failures)} blocking")
    else:
        print(render(audit))

    return 1 if args.strict and audit.failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
