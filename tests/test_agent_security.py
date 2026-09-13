from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from reliabilitykit.agent_security import AgentSecurityError, validate_manifest_path


class AgentSecurityTests(unittest.TestCase):
    def test_accepts_manifest_inside_allowed_root(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            manifest = root / "deployment.yaml"
            manifest.write_text("apiVersion: v1\nkind: ConfigMap\n", encoding="utf-8")

            self.assertEqual(validate_manifest_path(str(manifest), allowed_roots=(root,)), manifest)

    def test_rejects_path_outside_allowed_root(self) -> None:
        with tempfile.TemporaryDirectory() as allowed, tempfile.TemporaryDirectory() as outside:
            manifest = Path(outside).resolve() / "deployment.yaml"
            manifest.write_text("apiVersion: v1\nkind: ConfigMap\n", encoding="utf-8")

            with self.assertRaisesRegex(AgentSecurityError, "outside"):
                validate_manifest_path(str(manifest), allowed_roots=(Path(allowed).resolve(),))

    def test_rejects_too_many_manifest_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            for index in range(3):
                (root / f"manifest-{index}.yaml").write_text("kind: ConfigMap\n", encoding="utf-8")

            with self.assertRaisesRegex(AgentSecurityError, "file limit"):
                validate_manifest_path(str(root), allowed_roots=(root,), max_files=2)

    def test_rejects_oversized_manifest_selection(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            manifest = root / "large.yaml"
            manifest.write_text("kind: ConfigMap\n" + ("x" * 128), encoding="utf-8")

            with self.assertRaisesRegex(AgentSecurityError, "byte limit"):
                validate_manifest_path(str(manifest), allowed_roots=(root,), max_bytes=32)


if __name__ == "__main__":
    unittest.main()
