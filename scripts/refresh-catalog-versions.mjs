#!/usr/bin/env node
/**
 * Pin each catalog.json listing to the npm `latest` version when that
 * published manifest still declares `dsh.bundle.patch`. Title, description,
 * homepage, and kind stay as curated listing fields. `updatedAt` is the
 * npm publish time of that pinned version.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REGISTRY = 'https://registry.npmjs.org'
const INSTALL_VERSION = /^(?:[0-9]+(?:\.[0-9A-Za-z-]+)*(?:[+.][0-9A-Za-z.-]+)*|[A-Za-z][0-9A-Za-z._-]*)$/

/** @typedef {{ name: string, version: string, title: string, description: string, homepage: string, kind: string, updatedAt?: string }} CatalogPlugin */
/** @typedef {{ version: string, updatedAt: string }} CatalogPin */
/** @typedef {{ version: number, title?: string, plugins: CatalogPlugin[] }} CatalogDocument */

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isInstallVersion(name) {
  return INSTALL_VERSION.test(name) && !name.includes('/') && !name.includes(':')
}

/**
 * @param {string} name
 * @returns {string}
 */
export function registryPackumentUrl(name) {
  return `${REGISTRY}/${encodeURIComponent(name)}`
}

/**
 * @param {unknown} packument
 * @returns {{ ok: true, version: string, updatedAt: string } | { ok: false, message: string }}
 */
export function latestBundleVersion(packument) {
  if (packument === null || typeof packument !== 'object' || Array.isArray(packument)) {
    return { ok: false, message: 'packument must be an object' }
  }
  const document = /** @type {Record<string, unknown>} */ (packument)
  const tags = document['dist-tags']
  if (tags === null || typeof tags !== 'object' || Array.isArray(tags)) {
    return { ok: false, message: 'packument dist-tags must be an object' }
  }
  const latest = /** @type {Record<string, unknown>} */ (tags).latest
  if (typeof latest !== 'string' || !isInstallVersion(latest)) {
    return { ok: false, message: 'packument latest tag is missing or not an install version' }
  }
  const versions = document.versions
  if (versions === null || typeof versions !== 'object' || Array.isArray(versions)) {
    return { ok: false, message: 'packument versions must be an object' }
  }
  const manifest = /** @type {Record<string, unknown>} */ (versions)[latest]
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, message: `packument is missing version ${latest}` }
  }
  const dsh = /** @type {Record<string, unknown>} */ (manifest).dsh
  if (dsh === null || typeof dsh !== 'object' || Array.isArray(dsh)) {
    return { ok: false, message: `${latest} does not declare dsh.bundle.patch` }
  }
  const bundle = /** @type {Record<string, unknown>} */ (dsh).bundle
  if (bundle === null || typeof bundle !== 'object' || Array.isArray(bundle)) {
    return { ok: false, message: `${latest} does not declare dsh.bundle.patch` }
  }
  const patch = /** @type {Record<string, unknown>} */ (bundle).patch
  if (typeof patch !== 'string' || patch.trim().length === 0) {
    return { ok: false, message: `${latest} does not declare dsh.bundle.patch` }
  }
  const times = document.time
  if (times === null || typeof times !== 'object' || Array.isArray(times)) {
    return { ok: false, message: `${latest} is missing a publish time` }
  }
  const stamp = /** @type {Record<string, unknown>} */ (times)[latest]
  if (typeof stamp !== 'string' || !Number.isFinite(Date.parse(stamp))) {
    return { ok: false, message: `${latest} is missing a publish time` }
  }
  return { ok: true, version: latest, updatedAt: new Date(stamp).toISOString() }
}

/**
 * @param {CatalogDocument} catalog
 * @param {ReadonlyMap<string, CatalogPin>} pins
 * @returns {{ catalog: CatalogDocument, changed: string[] }}
 */
export function pinCatalogVersions(catalog, pins) {
  const changed = []
  const plugins = catalog.plugins.map((plugin) => {
    const next = pins.get(plugin.name)
    if (next === undefined) return plugin
    const versionChanged = next.version !== plugin.version
    const updatedChanged = next.updatedAt !== plugin.updatedAt
    if (!versionChanged && !updatedChanged) return plugin
    if (versionChanged) changed.push(`${plugin.name} ${plugin.version} -> ${next.version}`)
    else changed.push(`${plugin.name} updatedAt ${plugin.updatedAt ?? '(none)'} -> ${next.updatedAt}`)
    return { ...plugin, version: next.version, updatedAt: next.updatedAt }
  })
  return { catalog: { ...catalog, plugins }, changed }
}

/**
 * @param {string} raw
 * @returns {CatalogDocument}
 */
export function parseCatalogFile(raw) {
  const document = JSON.parse(raw)
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('catalog root must be an object')
  }
  if (document.version !== 1) throw new Error('catalog version must be 1')
  if (!Array.isArray(document.plugins)) throw new Error('catalog plugins must be an array')
  for (const [index, plugin] of document.plugins.entries()) {
    if (plugin === null || typeof plugin !== 'object' || Array.isArray(plugin)) {
      throw new Error(`catalog plugins[${String(index)}] must be an object`)
    }
    if (typeof plugin.name !== 'string' || plugin.name.length === 0) {
      throw new Error(`catalog plugins[${String(index)}] needs a name`)
    }
  }
  return document
}

/**
 * @param {string} name
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<unknown>}
 */
export async function fetchPackument(name, fetchImpl = fetch) {
  const response = await fetchImpl(registryPackumentUrl(name), {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`GET ${name} returned ${String(response.status)}`)
  }
  return response.json()
}

/**
 * @param {CatalogDocument} catalog
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<{ catalog: CatalogDocument, changed: string[] }>}
 */
export async function refreshCatalog(catalog, fetchImpl = fetch) {
  /** @type {Map<string, CatalogPin>} */
  const pins = new Map()
  const errors = []
  for (const plugin of catalog.plugins) {
    try {
      const resolved = latestBundleVersion(await fetchPackument(plugin.name, fetchImpl))
      if (!resolved.ok) {
        errors.push(`${plugin.name}: ${resolved.message}`)
        continue
      }
      pins.set(plugin.name, { version: resolved.version, updatedAt: resolved.updatedAt })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${plugin.name}: ${message}`)
    }
  }
  if (errors.length > 0) {
    throw new Error(`failed to refresh ${String(errors.length)} listing(s):\n${errors.join('\n')}`)
  }
  return pinCatalogVersions(catalog, pins)
}

/**
 * @param {CatalogDocument} catalog
 * @returns {string}
 */
export function formatCatalog(catalog) {
  return `${JSON.stringify(catalog, null, 2)}\n`
}

const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const catalogPath = resolve(dirname(fileURLToPath(import.meta.url)), '../catalog.json')
  const before = await readFile(catalogPath, 'utf8')
  const refreshed = await refreshCatalog(parseCatalogFile(before))
  const after = formatCatalog(refreshed.catalog)
  if (after === before) {
    console.log('catalog.json already pins the published latest versions')
  } else {
    await writeFile(catalogPath, after)
    console.log(`updated catalog.json:\n${refreshed.changed.join('\n')}`)
  }
}
