# AGENTS.md

Official StarPivot marketplace catalog. The marketplace installer lives in `StarPivotNet/dsh-plugins-public`.

## Architecture

`catalog.json` is the only runtime artifact. The marketplace Host fetches it over HTTPS and parses marketplace protocol version 1.

## Conventions

- List only npm packages that declare `dsh.bundle.patch`.
- Pin the published version that was verified at listing time.
- Keep `homepage` on `http:` or `https:`.
- Duplicate package names are invalid.

## Commands

There is no build. Edit `catalog.json`, commit, and push `main` in the same turn as the listing change. Discover reads the raw `main` file; an unpushed edit is invisible.

When a package in `StarPivotNet/dsh-plugins-public` is published with a new name, version, title, or description, update this catalog immediately. Do not wait for a later cleanup pass.
