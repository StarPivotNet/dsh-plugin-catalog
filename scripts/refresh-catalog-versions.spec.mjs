import assert from 'node:assert/strict'
import {
  latestBundleVersion, pinCatalogVersions, refreshCatalog, registryPackumentUrl,
} from './refresh-catalog-versions.mjs'

const packument = {
  'dist-tags': { latest: '0.1.5' },
  versions: {
    '0.1.4': { dsh: { bundle: { patch: './cordis.patch.yml' } } },
    '0.1.5': { dsh: { bundle: { patch: './cordis.patch.yml' } } },
  },
  time: {
    '0.1.4': '2026-08-10T00:00:00.000Z',
    '0.1.5': '2026-08-16T17:52:31.074Z',
  },
}

assert.equal(
  registryPackumentUrl('@starpivot/dsh-plugin-marketplace'),
  'https://registry.npmjs.org/%40starpivot%2Fdsh-plugin-marketplace',
)
assert.deepEqual(latestBundleVersion(packument), {
  ok: true,
  version: '0.1.5',
  updatedAt: '2026-08-16T17:52:31.074Z',
})
assert.equal(
  latestBundleVersion({
    'dist-tags': { latest: '0.2.0' },
    versions: { '0.2.0': { dsh: {} } },
  }).ok,
  false,
)
assert.equal(
  latestBundleVersion({
    'dist-tags': { latest: '0.1.5' },
    versions: { '0.1.5': { dsh: { bundle: { patch: './cordis.patch.yml' } } } },
  }).ok,
  false,
)

const catalog = {
  version: 1,
  title: 'StarPivot',
  plugins: [
    { name: '@starpivot/dsh-plugin-marketplace', version: '0.1.4', title: 'Plugin marketplace', description: '', homepage: '', kind: 'bundle' },
    { name: 'dsh-find-plugin', version: '0.3.6', title: 'Find plugins', description: '', homepage: '', kind: 'bundle', updatedAt: '2026-08-14T13:18:06.053Z' },
  ],
}
const pinned = pinCatalogVersions(catalog, new Map([
  ['@starpivot/dsh-plugin-marketplace', { version: '0.1.5', updatedAt: '2026-08-16T17:52:31.074Z' }],
  ['dsh-find-plugin', { version: '0.3.6', updatedAt: '2026-08-14T13:18:06.053Z' }],
]))
assert.deepEqual(pinned.changed, ['@starpivot/dsh-plugin-marketplace 0.1.4 -> 0.1.5'])
assert.equal(pinned.catalog.plugins[0].version, '0.1.5')
assert.equal(pinned.catalog.plugins[0].updatedAt, '2026-08-16T17:52:31.074Z')
assert.equal(pinned.catalog.plugins[0].title, 'Plugin marketplace')
assert.equal(pinned.catalog.plugins[1].version, '0.3.6')

const timeOnly = pinCatalogVersions(catalog, new Map([
  ['@starpivot/dsh-plugin-marketplace', { version: '0.1.4', updatedAt: '2026-08-10T00:00:00.000Z' }],
  ['dsh-find-plugin', { version: '0.3.6', updatedAt: '2026-08-14T13:18:06.053Z' }],
]))
assert.deepEqual(timeOnly.changed, ['@starpivot/dsh-plugin-marketplace updatedAt (none) -> 2026-08-10T00:00:00.000Z'])
assert.equal(timeOnly.catalog.plugins[0].version, '0.1.4')
assert.equal(timeOnly.catalog.plugins[0].updatedAt, '2026-08-10T00:00:00.000Z')

const fetched = await refreshCatalog(catalog, async (url) => {
  assert.match(String(url), /registry\.npmjs\.org/)
  return {
    ok: true,
    async json() {
      return String(url).includes('dsh-find-plugin')
        ? {
            'dist-tags': { latest: '0.3.6' },
            versions: { '0.3.6': { dsh: { bundle: { patch: './cordis.patch.yml' } } } },
            time: { '0.3.6': '2026-08-14T13:18:06.053Z' },
          }
        : packument
    },
  }
})
assert.deepEqual(fetched.changed, ['@starpivot/dsh-plugin-marketplace 0.1.4 -> 0.1.5'])
assert.equal(fetched.catalog.plugins[0].updatedAt, '2026-08-16T17:52:31.074Z')

await assert.rejects(
  () => refreshCatalog(catalog, async () => ({ ok: false, status: 404 })),
  /failed to refresh 2 listing/,
)

console.log('refresh-catalog-versions checks passed')
