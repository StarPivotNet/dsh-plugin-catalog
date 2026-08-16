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

If that job fails, it emails StarPivotNet members a Chinese HTML notice with the run link and the failure log. Recipients are each member's public GitHub profile email plus `notify-recipients.txt`. Configure repository secrets `SMTP_HOST`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `SMTP_FROM`. Optional repository variables: `SMTP_PORT` (default `587`) and `SMTP_SECURE` (`true` for port 465).

## First shelf

The live pins are in `catalog.json`. The scheduled Action rewrites only the `version` field.

- `@starpivot/dsh-plugin-marketplace`
- `@dsh-plugin/dsh-auxiliary`
- `@dsh-plugin/dsh-thought-buddy`
- `dsh-find-plugin`
