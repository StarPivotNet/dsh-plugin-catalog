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
      "kind": "bundle"
    }
  ]
}
```

Do not list git-only checkouts, skills, or packages that need a hand-written `cordis.patch.yml` after install.

A scheduled GitHub Action checks each listed package against its npm `latest` tag every 30 minutes and pins `catalog.json` when that published version still declares `dsh.bundle.patch`. Title, description, homepage, and kind stay as written here. Run the workflow manually from the Actions tab to refresh without waiting.

If that job fails, it opens a GitHub Issue (or comments on the open `catalog-refresh-failure` Issue) and @-mentions every StarPivotNet member. GitHub then emails those members through their own notification settings. There is no SMTP setup. Keep Issue email notifications on if you want the inbox copy.

## First shelf

The live pins are in `catalog.json`. The scheduled Action rewrites only the `version` field.

- `@starpivot/dsh-plugin-marketplace`
- `@dsh-plugin/dsh-auxiliary`
- `@dsh-plugin/dsh-thought-buddy`
- `dsh-find-plugin`
