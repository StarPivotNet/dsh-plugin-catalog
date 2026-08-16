# dsh-plugin-catalog

Official plugin catalog for the [StarPivot marketplace](https://github.com/StarPivotNet/dsh-plugins-public).

The marketplace Discover tab fetches this file:

`https://raw.githubusercontent.com/StarPivotNet/dsh-plugin-catalog/main/catalog.json`

## Listing rules

Every entry must be an npm registry package that declares `dsh.bundle.patch`. The catalog uses marketplace protocol version 1:

```json
{
  "version": 1,
  "title": "StarPivot",
  "plugins": [
    {
      "name": "@scope/pkg",
      "version": "1.2.3",
      "title": "Display name",
      "description": "Short summary",
      "homepage": "https://example.com",
      "kind": "bundle",
      "updatedAt": "2026-08-16T17:52:31.074Z"
    }
  ]
}
```

Do not list git-only checkouts, skills, or packages that need a hand-written `cordis.patch.yml` after install.

A scheduled GitHub Action checks each listed package against its npm `latest` tag every 30 minutes and pins `catalog.json` when that published version still declares `dsh.bundle.patch`. It writes `version` and the npm publish time as `updatedAt`. Title, description, homepage, and kind stay as written here. Run the workflow manually from the Actions tab to refresh without waiting.

If that job fails, it opens a GitHub Issue (or comments on the open `catalog-refresh-failure` Issue) and @-mentions every StarPivotNet member. GitHub then emails those members through their own notification settings. Keep Issue email notifications on if you want that inbox copy.

GitHub cannot send a custom HTML mail. To send one through Cloudflare on `fastaicode.top`, deploy `cf-email-worker/` and set repository secrets `CF_NOTIFY_URL=https://catalog-notify.fastaicode.top` and `CF_NOTIFY_TOKEN`. See [cf-email-worker/README.md](cf-email-worker/README.md).

## First shelf

The live pins are in `catalog.json`. The scheduled Action rewrites only `version` and `updatedAt`.

- `@starpivot/dsh-plugin-marketplace`
- `@dsh-plugin/dsh-auxiliary`
- `@dsh-plugin/dsh-thought-buddy`
- `dsh-find-plugin`
- `dsh-mnemon`
