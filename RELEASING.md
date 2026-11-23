# Releasing

1. Set the new version in `module.json` and add a section for it at the top of `CHANGELOG.md` (e.g. `## 1.2.0`). Commit and push.
2. On GitHub: **Actions → Release → Run workflow → Run workflow**.
3. The workflow creates the `v<version>` tag and release, writes the version and links into `module.json`, builds `module.zip`, attaches both, and uses that version's changelog section as the release notes.

If the tag already exists, the run stops with an error: raise the version first. You can also type a version into the **Run workflow** box instead of editing `module.json`.
