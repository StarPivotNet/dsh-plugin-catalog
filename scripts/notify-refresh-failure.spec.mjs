import assert from 'node:assert/strict'
import {
  buildFailureMail, escapeHtml, githubOutputLine, parseOrgMembers,
  parseRecipientFile, publicEmailFromUser, resolveRecipients,
} from './notify-refresh-failure.mjs'

assert.equal(escapeHtml('<script>"&'), '&lt;script&gt;&quot;&amp;')
assert.deepEqual(
  parseRecipientFile('# comment\n\n523528830@qq.com\n523528830@qq.com\n445714414@qq.com\n'),
  ['523528830@qq.com', '445714414@qq.com'],
)
assert.throws(() => parseRecipientFile('not-an-email'), /invalid email/)
assert.equal(publicEmailFromUser({ email: '  a@b.com  ' }), 'a@b.com')
assert.equal(publicEmailFromUser({ email: null }), undefined)
assert.deepEqual(parseOrgMembers([{ login: 'cat7street' }]), [{ login: 'cat7street' }])
assert.throws(() => parseOrgMembers({}), /must be an array/)

const mail = buildFailureMail({
  repository: 'StarPivotNet/dsh-plugin-catalog',
  runUrl: 'https://github.com/StarPivotNet/dsh-plugin-catalog/actions/runs/1',
  workflow: 'Refresh catalog versions',
  refName: 'main',
  sha: 'abc123',
  eventName: 'schedule',
  actor: 'github-actions[bot]',
  log: 'failed to refresh 1 listing(s):\n@scope/pkg: <boom>',
})
assert.match(mail.subject, /插件目录刷新失败/)
assert.match(mail.html, /lang="zh-CN"/)
assert.match(mail.html, /定时刷新 catalog\.json 失败/)
assert.match(mail.html, /打开这次 GitHub Actions 运行/)
assert.match(mail.html, /&lt;boom&gt;/)
assert.doesNotMatch(mail.html, /<boom>/)
assert.match(mail.text, /运行地址：https:\/\/github.com\/StarPivotNet\/dsh-plugin-catalog\/actions\/runs\/1/)
assert.equal(githubOutputLine('to', 'a@b.com,c@d.com'), 'to=a@b.com,c@d.com\n')
assert.throws(() => githubOutputLine('subject', 'a\nb'), /newline/)

const urls = []
const recipients = await resolveRecipients({
  token: 'token',
  extraRaw: '523528830@qq.com\n',
  fetchImpl: async (url) => {
    urls.push(String(url))
    if (String(url).includes('/orgs/StarPivotNet/members')) {
      return { ok: true, async json() { return [{ login: 'cat7street' }, { login: 'Wuxie233' }] } }
    }
    if (String(url).includes('/users/cat7street')) {
      return { ok: true, async json() { return { email: '523528830@qq.com' } } }
    }
    if (String(url).includes('/users/Wuxie233')) {
      return { ok: true, async json() { return { email: '445714414@qq.com' } } }
    }
    throw new Error(`unexpected ${String(url)}`)
  },
})
assert.deepEqual(recipients, ['523528830@qq.com', '445714414@qq.com'])
assert.equal(urls.length, 3)

await assert.rejects(
  () => resolveRecipients({
    token: 'token',
    extraRaw: '',
    fetchImpl: async (url) => {
      if (String(url).includes('/orgs/StarPivotNet/members')) {
        return { ok: true, async json() { return [{ login: 'ghost' }] } }
      }
      if (String(url).includes('/users/ghost')) {
        return { ok: true, async json() { return { email: null } } }
      }
      throw new Error(`unexpected ${String(url)}`)
    },
  }),
  /no deliverable email/,
)

console.log('notify-refresh-failure checks passed')
