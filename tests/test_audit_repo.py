"""Tests for the repo-polish audit script.

Each test builds a throwaway repo on disk and checks which checks fire, so the
script is exercised end to end rather than through mocks.
"""

from __future__ import annotations

import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "skills" / "repo-polish" / "scripts"))

import audit_repo  # noqa: E402

GOOD_README = """# Widget

Widget converts CSV exports into tidy Parquet files without loading the whole
thing into memory, which is the part that usually breaks on laptops.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

![Screenshot](docs/demo.png)

## Install

```bash
pip install -e .
```

## Usage

```bash
widget input.csv --out data/
```

It streams the file in chunks and writes one Parquet part per chunk, so peak
memory stays flat regardless of input size. Column types are inferred from the
first chunk and reused for the rest, which keeps the schema stable across
parts; pass `--infer-full` if the first chunk is not representative of the
whole file.

## License

MIT.
"""


def build_repo(root: Path, files: dict[str, str]) -> None:
    for name, content in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")


class AuditTestCase(unittest.TestCase):
    def audit(self, files: dict[str, str]) -> audit_repo.Audit:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        build_repo(root, files)
        return audit_repo.run(root)

    def status(self, audit: audit_repo.Audit, check_id: str) -> str:
        for check in audit.checks:
            if check.id == check_id:
                return check.status
        self.fail(f"check {check_id!r} was not reported")


class TestHealthyRepo(AuditTestCase):
    def setUp(self) -> None:
        self.result = self.audit({
            "README.md": GOOD_README,
            "LICENSE": "MIT License\n\nCopyright (c) 2026\n",
            ".gitignore": "__pycache__/\n",
            "pyproject.toml": "[project]\nname = 'widget'\n",
            "docs/demo.png": "not really a png",
            "tests/test_widget.py": "def test_ok():\n    assert True\n",
            ".github/workflows/ci.yml": "name: CI\n",
        })

    def test_no_blocking_failures(self) -> None:
        self.assertEqual([c.id for c in self.result.failures], [])

    def test_core_checks_pass(self) -> None:
        for check_id in ("readme.exists", "readme.substance", "readme.sections",
                         "readme.visual", "readme.links", "files.license",
                         "files.gitignore", "files.ci", "files.tests"):
            self.assertEqual(self.status(self.result, check_id), audit_repo.PASS, check_id)

    def test_detects_ecosystem(self) -> None:
        self.assertEqual(self.result.facts["project_types"], ["Python"])


class TestMissingEssentials(AuditTestCase):
    def test_missing_readme_and_license_block(self) -> None:
        result = self.audit({"main.py": "print('hi')\n"})
        failed = {c.id for c in result.failures}
        self.assertIn("readme.exists", failed)
        self.assertIn("files.license", failed)
        self.assertIn("files.gitignore", failed)

    def test_thin_readme_fails(self) -> None:
        result = self.audit({
            "README.md": "# Thing\n\nA thing.\n",
            "LICENSE": "MIT",
            ".gitignore": "",
        })
        self.assertEqual(self.status(result, "readme.substance"), audit_repo.FAIL)

    def test_prose_word_count_ignores_code_blocks(self) -> None:
        padding = "```\n" + "token " * 400 + "\n```\n"
        result = self.audit({
            "README.md": "# Thing\n\nA thing.\n\n" + padding,
            "LICENSE": "MIT",
            ".gitignore": "",
        })
        self.assertEqual(self.status(result, "readme.substance"), audit_repo.FAIL)


class TestPlaceholdersAndLinks(AuditTestCase):
    def test_placeholder_text_fails(self) -> None:
        result = self.audit({
            "README.md": GOOD_README + "\nClone from https://github.com/your-username/repo\n",
            "LICENSE": "MIT",
            ".gitignore": "",
            "docs/demo.png": "x",
        })
        self.assertEqual(self.status(result, "readme.placeholders"), audit_repo.FAIL)

    def test_broken_relative_link_fails(self) -> None:
        result = self.audit({
            "README.md": GOOD_README + "\nSee the [design notes](docs/design.md).\n",
            "LICENSE": "MIT",
            ".gitignore": "",
            "docs/demo.png": "x",
        })
        self.assertEqual(self.status(result, "readme.links"), audit_repo.FAIL)

    def test_external_and_anchor_links_are_not_checked(self) -> None:
        result = self.audit({
            "README.md": GOOD_README + "\n[docs](https://example.com/x) and [top](#widget)\n",
            "LICENSE": "MIT",
            ".gitignore": "",
            "docs/demo.png": "x",
        })
        self.assertEqual(self.status(result, "readme.links"), audit_repo.PASS)


class TestHygiene(AuditTestCase):
    def test_committed_env_file_is_blocking(self) -> None:
        result = self.audit({
            "README.md": GOOD_README,
            "LICENSE": "MIT",
            ".gitignore": "",
            "docs/demo.png": "x",
            ".env": "API_KEY=sk-live-nope\n",
        })
        self.assertEqual(self.status(result, "hygiene.secrets"), audit_repo.FAIL)

    def test_env_example_is_allowed(self) -> None:
        result = self.audit({
            "README.md": GOOD_README,
            "LICENSE": "MIT",
            ".gitignore": "",
            "docs/demo.png": "x",
            ".env.example": "API_KEY=\n",
        })
        self.assertEqual(self.status(result, "hygiene.secrets"), audit_repo.PASS)

    def test_vendored_dependencies_are_blocking(self) -> None:
        result = self.audit({
            "README.md": GOOD_README,
            "LICENSE": "MIT",
            ".gitignore": "",
            "docs/demo.png": "x",
            "node_modules/left-pad/index.js": "module.exports = 1\n",
        })
        self.assertEqual(self.status(result, "hygiene.vendored"), audit_repo.FAIL)

    def test_oversized_file_is_blocking(self) -> None:
        result = self.audit({
            "README.md": GOOD_README,
            "LICENSE": "MIT",
            ".gitignore": "",
            "docs/demo.png": "x",
            "data/dump.bin": "0" * (audit_repo.MAX_TRACKED_FILE_BYTES + 1),
        })
        self.assertEqual(self.status(result, "hygiene.large_files"), audit_repo.FAIL)


class TestOutput(AuditTestCase):
    def test_strict_exit_code_reflects_blocking_failures(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        build_repo(root, {"main.py": "print('hi')\n"})
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(audit_repo.main([str(root), "--quiet", "--strict"]), 1)
            self.assertEqual(audit_repo.main([str(root), "--quiet"]), 0)

    def test_json_output_is_parseable(self) -> None:
        import json

        result = self.audit({"README.md": GOOD_README, "LICENSE": "MIT", ".gitignore": ""})
        payload = json.loads(audit_repo.to_json(result))
        self.assertIn("checks", payload)
        self.assertEqual(payload["score"]["total"], len(
            [c for c in result.checks if c.status != audit_repo.INFO]))

    def test_report_lists_fixes_for_failures(self) -> None:
        result = self.audit({"main.py": "print('hi')\n"})
        report = audit_repo.render(result)
        self.assertIn("Blocking", report)
        self.assertIn("LICENSE", report)


if __name__ == "__main__":
    unittest.main()
