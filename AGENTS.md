# AGENTS.md

Official StarPivot marketplace catalog. The marketplace installer lives in `StarPivotNet/dsh-plugins-public`.

## Architecture

`catalog.json` is the only runtime artifact. The marketplace Host fetches it over HTTPS and parses marketplace protocol version 1. `.github/workflows/refresh-catalog.yml` runs `scripts/refresh-catalog-versions.mjs` every 30 minutes and on `workflow_dispatch`. The script reads each listing's npm `latest` tag and rewrites that row's `version` when the published manifest still declares `dsh.bundle.patch`. It does not add, remove, or rewrite title, description, homepage, or kind.

A failed refresh or push opens or comments on a GitHub Issue labelled `catalog-refresh-failure` and @-mentions every StarPivotNet member (`scripts/notify-refresh-failure.mjs`). GitHub then emails each mentioned person through their notification settings. There is no SMTP path and no custom HTML mail. Members who want inbox mail must keep GitHub email notifications on for Issues.

## Conventions

- List only npm packages that declare `dsh.bundle.patch`.
- Pin the published version that was verified at listing time.
- Keep `homepage` on `http:` or `https:`.
- Duplicate package names are invalid.
- A scheduled pin update is a version-only rewrite of an existing row.

## Commands

```sh
node scripts/refresh-catalog-versions.spec.mjs
node scripts/notify-refresh-failure.spec.mjs
node scripts/refresh-catalog-versions.mjs
```

There is no build. Adding or removing a listing is still a hand edit of `catalog.json` in the same turn as the listing change, then push `main`. Discover reads the raw `main` file; an unpushed edit is invisible.

When a package in `StarPivotNet/dsh-plugins-public` is published with a new name, title, or description, update those curated fields immediately. Do not wait for the scheduled job. A version-only publish can wait for the next refresh.
