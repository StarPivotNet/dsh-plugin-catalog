import assert from 'node:assert/strict'
import {
  buildFailureIssue, listOrgLogins, notifyFailureIssue, openFailureIssueNumber,
  parseOrgMembers,
} from './notify-refresh-failure.mjs'

assert.deepEqual(parseOrgMembers([{ login: 'cat7street' }]), [{ login: 'cat7street' }])
assert.throws(() => parseOrgMembers({}), /must be an array/)
assert.equal(openFailureIssueNumber({ items: [] }), undefined)
assert.equal(openFailureIssueNumber({ items: [{ number: 12 }] }), 12)

const issue = buildFailureIssue({
  repository: 'StarPivotNet/dsh-plugin-catalog',
  runUrl: 'https://github.com/StarPivotNet/dsh-plugin-catalog/actions/runs/1',
  workflow: 'Refresh catalog versions',
  refName: 'main',
  sha: 'abc123',
  eventName: 'schedule',
  actor: 'github-actions[bot]',
  log: 'failed to refresh 1 listing(s):\n@scope/pkg: <boom>',
  logins: ['cat7street', 'Wuxie233'],
})
assert.match(issue.title, /插件目录刷新失败/)
assert.match(issue.body, /@cat7street @Wuxie233/)
assert.match(issue.body, /打开这次运行|运行：https:\/\/github.com\/StarPivotNet\/dsh-plugin-catalog\/actions\/runs\/1/)
assert.match(issue.body, /@scope\/pkg: <boom>/)

const logins = await listOrgLogins({
  token: 'token',
  fetchImpl: async (url) => {
    assert.match(String(url), /\/orgs\/StarPivotNet\/members/)
    return { ok: true, async json() { return [{ login: 'cat7street' }, { login: 'Wuxie233' }] } }
  },
})
assert.deepEqual(logins, ['cat7street', 'Wuxie233'])

const created = await notifyFailureIssue({
  token: 'token',
  repository: 'StarPivotNet/dsh-plugin-catalog',
  runUrl: 'https://example.test/run/1',
  workflow: 'Refresh catalog versions',
  refName: 'main',
  sha: 'abc',
  eventName: 'schedule',
  actor: 'bot',
  log: 'boom',
  fetchImpl: async (url, init) => {
    if (String(url).includes('/orgs/StarPivotNet/members')) {
      return { ok: true, async json() { return [{ login: 'cat7street' }] } }
    }
    if (String(url).includes('/search/issues')) {
      return { ok: true, async json() { return { items: [] } } }
    }
    if (String(url).endsWith('/issues') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body))
      assert.deepEqual(body.labels, ['catalog-refresh-failure'])
      assert.match(body.body, /@cat7street/)
      return { ok: true, async json() { return { number: 7, html_url: 'https://github.com/StarPivotNet/dsh-plugin-catalog/issues/7' } } }
    }
    throw new Error(`unexpected ${String(url)}`)
  },
})
assert.deepEqual(created, { action: 'created', number: 7, url: 'https://github.com/StarPivotNet/dsh-plugin-catalog/issues/7' })

const commented = await notifyFailureIssue({
  token: 'token',
  repository: 'StarPivotNet/dsh-plugin-catalog',
  runUrl: 'https://example.test/run/2',
  workflow: 'Refresh catalog versions',
  refName: 'main',
  sha: 'def',
  eventName: 'schedule',
  actor: 'bot',
  log: 'again',
  fetchImpl: async (url, init) => {
    if (String(url).includes('/orgs/StarPivotNet/members')) {
      return { ok: true, async json() { return [{ login: 'Wuxie233' }] } }
    }
    if (String(url).includes('/search/issues')) {
      return { ok: true, async json() { return { items: [{ number: 7 }] } } }
    }
    if (String(url).includes('/issues/7/comments') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body))
      assert.match(body.body, /@Wuxie233/)
      return { ok: true, async json() { return { id: 1 } } }
    }
    throw new Error(`unexpected ${String(url)}`)
  },
})
assert.deepEqual(commented, {
  action: 'commented',
  number: 7,
  url: 'https://github.com/StarPivotNet/dsh-plugin-catalog/issues/7',
})

console.log('notify-refresh-failure checks passed')
