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
}

assert.equal(
  registryPackumentUrl('@starpivot/dsh-plugin-marketplace'),
  'https://registry.npmjs.org/%40starpivot%2Fdsh-plugin-marketplace',
)
assert.deepEqual(latestBundleVersion(packument), { ok: true, version: '0.1.5' })
assert.equal(
  latestBundleVersion({
    'dist-tags': { latest: '0.2.0' },
    versions: { '0.2.0': { dsh: {} } },
  }).ok,
  false,
)

const catalog = {
  version: 1,
  title: 'StarPivot',
  plugins: [
    { name: '@starpivot/dsh-plugin-marketplace', version: '0.1.4', title: 'Plugin marketplace', description: '', homepage: '', kind: 'bundle' },
    { name: 'dsh-find-plugin', version: '0.3.6', title: 'Find plugins', description: '', homepage: '', kind: 'bundle' },
  ],
}
const pinned = pinCatalogVersions(catalog, new Map([
  ['@starpivot/dsh-plugin-marketplace', '0.1.5'],
  ['dsh-find-plugin', '0.3.6'],
]))
assert.deepEqual(pinned.changed, ['@starpivot/dsh-plugin-marketplace 0.1.4 -> 0.1.5'])
assert.equal(pinned.catalog.plugins[0].version, '0.1.5')
assert.equal(pinned.catalog.plugins[0].title, 'Plugin marketplace')
assert.equal(pinned.catalog.plugins[1].version, '0.3.6')

const fetched = await refreshCatalog(catalog, async (url) => {
  assert.match(String(url), /registry\.npmjs\.org/)
  return {
    ok: true,
    async json() {
      return String(url).includes('dsh-find-plugin')
        ? {
            'dist-tags': { latest: '0.3.6' },
            versions: { '0.3.6': { dsh: { bundle: { patch: './cordis.patch.yml' } } } },
          }
        : packument
    },
  }
})
assert.deepEqual(fetched.changed, ['@starpivot/dsh-plugin-marketplace 0.1.4 -> 0.1.5'])

await assert.rejects(
  () => refreshCatalog(catalog, async () => ({ ok: false, status: 404 })),
  /failed to refresh 2 listing/,
)

console.log('refresh-catalog-versions checks passed')
