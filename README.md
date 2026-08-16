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

## First shelf

- `@dsh-plugin/dsh-auxiliary@0.4.2`
- `@dsh-plugin/dsh-thought-buddy@0.1.1`
- `dsh-find-plugin@0.3.6`
