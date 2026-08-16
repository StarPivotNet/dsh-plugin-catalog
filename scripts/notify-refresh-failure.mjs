#!/usr/bin/env node
/**
 * Notify StarPivotNet members when catalog refresh fails: open or reuse a
 * GitHub Issue, and optionally POST a Chinese HTML mail to a Cloudflare
 * Email Worker.
 */
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const GITHUB_API = 'https://api.github.com'
const ORG = 'StarPivotNet'
const ISSUE_LABEL = 'catalog-refresh-failure'

/**
 * @param {unknown} payload
 * @returns {Array<{ login: string }>}
 */
export function parseOrgMembers(payload) {
  if (!Array.isArray(payload)) throw new Error('organization members response must be an array')
  return payload.map((item, index) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`organization members[${String(index)}] must be an object`)
    }
    const login = /** @type {Record<string, unknown>} */ (item).login
    if (typeof login !== 'string' || login.length === 0) {
      throw new Error(`organization members[${String(index)}] needs a login`)
    }
    return { login }
  })
}

/**
 * @param {unknown} payload
 * @returns {number | undefined}
 */
export function openFailureIssueNumber(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('search issues response must be an object')
  }
  const items = /** @type {Record<string, unknown>} */ (payload).items
  if (!Array.isArray(items)) throw new Error('search issues items must be an array')
  const first = items[0]
  if (first === undefined) return undefined
  if (first === null || typeof first !== 'object' || Array.isArray(first)) {
    throw new Error('search issues items[0] must be an object')
  }
  const number = /** @type {Record<string, unknown>} */ (first).number
  if (typeof number !== 'number') throw new Error('search issues items[0] needs a number')
  return number
}

/**
 * @param {object} input
 * @param {string} input.repository
 * @param {string} input.runUrl
 * @param {string} input.workflow
 * @param {string} input.refName
 * @param {string} input.sha
 * @param {string} input.eventName
 * @param {string} input.actor
 * @param {string} input.log
 * @param {readonly string[]} input.logins
 * @returns {{ title: string, body: string }}
 */
export function buildFailureIssue(input) {
  const title = `插件目录刷新失败：${input.repository}`
  const log = input.log.trim().length > 0 ? input.log.trim() : '（工作流没有留下失败日志）'
  const mentions = input.logins.map(login => `@${login}`).join(' ')
  const body = [
    'StarPivot 组织仓库的半小时刷新没有写完 `catalog.json`。发现页上的版本钉可能已经落后于 npm `latest`。',
    '',
    mentions.length > 0 ? mentions : '_（未能列出组织成员）_',
    '',
    `- 运行：${input.runUrl}`,
    `- 工作流：${input.workflow}`,
    `- 分支：${input.refName}`,
    `- 提交：${input.sha}`,
    `- 触发方式：${input.eventName}`,
    `- 触发者：${input.actor}`,
    '',
    '## 失败日志',
    '',
    '```',
    log,
    '```',
  ].join('\n')
  return { title, body }
}

/**
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * @param {object} input
 * @param {string} input.repository
 * @param {string} input.runUrl
 * @param {string} input.workflow
 * @param {string} input.refName
 * @param {string} input.sha
 * @param {string} input.eventName
 * @param {string} input.actor
 * @param {string} input.log
 * @returns {{ subject: string, html: string, text: string }}
 */
export function buildFailureMail(input) {
  const subject = `【StarPivot】插件目录刷新失败：${input.repository}`
  const log = input.log.trim().length > 0 ? input.log.trim() : '（工作流没有留下失败日志）'
  const rows = [
    ['仓库', input.repository],
    ['工作流', input.workflow],
    ['分支', input.refName],
    ['提交', input.sha],
    ['触发方式', input.eventName],
    ['触发者', input.actor],
  ]
  const htmlRows = rows.map(([label, value]) => (
    `<tr><th align="left" style="padding:8px 12px;background:#f4f2ee;color:#5c564d;font-weight:600;width:96px;">${escapeHtml(label)}</th>`
    + `<td style="padding:8px 12px;color:#1f1b16;">${escapeHtml(value)}</td></tr>`
  )).join('')
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px;background:#f6f3ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Noto Sans SC',sans-serif;color:#1f1b16;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e6e0d6;border-radius:12px;">
    <tr>
      <td style="padding:20px 24px;border-bottom:1px solid #e6e0d6;">
        <p style="margin:0 0 6px;font-size:13px;letter-spacing:0.08em;color:#8a8174;">STARPIVOT / DSH 插件目录</p>
        <h1 style="margin:0;font-size:22px;line-height:1.3;">定时刷新 catalog.json 失败</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 24px;">
        <p style="margin:0 0 16px;line-height:1.6;">StarPivot 组织仓库的半小时刷新没有写完 <code>catalog.json</code>。发现页上的版本钉可能已经落后于 npm <code>latest</code>，请打开这次运行并处理失败原因。</p>
        <p style="margin:0 0 20px;"><a href="${escapeHtml(input.runUrl)}" style="display:inline-block;padding:10px 16px;background:#1f1b16;color:#fff7ea;text-decoration:none;border-radius:8px;">打开这次 GitHub Actions 运行</a></p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e0d6;border-radius:8px;border-collapse:collapse;">
          ${htmlRows}
        </table>
        <h2 style="margin:24px 0 8px;font-size:16px;">失败日志</h2>
        <pre style="margin:0;padding:12px;background:#1f1b16;color:#f4efe6;border-radius:8px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.5;">${escapeHtml(log)}</pre>
      </td>
    </tr>
  </table>
</body>
</html>
`
  const text = [
    subject,
    '',
    'StarPivot 组织仓库的半小时刷新没有写完 catalog.json。',
    `运行地址：${input.runUrl}`,
    ...rows.map(([label, value]) => `${label}：${value}`),
    '',
    '失败日志：',
    log,
  ].join('\n')
  return { subject, html, text }
}

/**
 * @param {object} input
 * @param {string} input.url
 * @param {string} input.token
 * @param {{ subject: string, html: string, text: string }} input.mail
 * @param {typeof fetch} input.fetchImpl
 * @returns {Promise<void>}
 */
export async function postCloudflareMail(input) {
  const response = await input.fetchImpl(input.url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(input.mail),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Cloudflare notify returned ${String(response.status)}${detail.length > 0 ? `: ${detail}` : ''}`)
  }
}

/**
 * @param {string} token
 * @returns {Record<string, string>}
 */
export function githubHeaders(token) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'user-agent': 'dsh-plugin-catalog-refresh-notifier',
    'x-github-api-version': '2022-11-28',
  }
}

/**
 * @param {object} input
 * @param {string} input.token
 * @param {typeof fetch} input.fetchImpl
 * @returns {Promise<string[]>}
 */
export async function listOrgLogins(input) {
  const response = await input.fetchImpl(`${GITHUB_API}/orgs/${ORG}/members?per_page=100`, {
    headers: githubHeaders(input.token),
  })
  if (!response.ok) {
    throw new Error(`GET /orgs/${ORG}/members returned ${String(response.status)}`)
  }
  return parseOrgMembers(await response.json()).map(member => member.login)
}

/**
 * @param {object} input
 * @param {string} input.token
 * @param {string} input.repository
 * @param {string} input.runUrl
 * @param {string} input.workflow
 * @param {string} input.refName
 * @param {string} input.sha
 * @param {string} input.eventName
 * @param {string} input.actor
 * @param {string} input.log
 * @param {typeof fetch} input.fetchImpl
 * @returns {Promise<{ action: 'created' | 'commented', number: number, url: string }>}
 */
export async function notifyFailureIssue(input) {
  const headers = githubHeaders(input.token)
  const logins = await listOrgLogins(input)
  const issue = buildFailureIssue({ ...input, logins })
  const query = new URLSearchParams({
    q: `repo:${input.repository} is:issue is:open label:${ISSUE_LABEL}`,
    per_page: '1',
  })
  const search = await input.fetchImpl(`${GITHUB_API}/search/issues?${query.toString()}`, { headers })
  if (!search.ok) throw new Error(`GET /search/issues returned ${String(search.status)}`)
  const existing = openFailureIssueNumber(await search.json())
  if (existing !== undefined) {
    const comment = await input.fetchImpl(
      `${GITHUB_API}/repos/${input.repository}/issues/${String(existing)}/comments`,
      { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ body: issue.body }) },
    )
    if (!comment.ok) {
      throw new Error(`POST /issues/${String(existing)}/comments returned ${String(comment.status)}`)
    }
    return {
      action: 'commented',
      number: existing,
      url: `https://github.com/${input.repository}/issues/${String(existing)}`,
    }
  }
  const created = await input.fetchImpl(`${GITHUB_API}/repos/${input.repository}/issues`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ title: issue.title, body: issue.body, labels: [ISSUE_LABEL] }),
  })
  if (!created.ok) throw new Error(`POST /issues returned ${String(created.status)}`)
  const payload = await created.json()
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('create issue response must be an object')
  }
  const number = /** @type {Record<string, unknown>} */ (payload).number
  const htmlUrl = /** @type {Record<string, unknown>} */ (payload).html_url
  if (typeof number !== 'number' || typeof htmlUrl !== 'string') {
    throw new Error('create issue response needs number and html_url')
  }
  return { action: 'created', number, url: htmlUrl }
}

const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const required = ['GITHUB_TOKEN', 'GITHUB_REPOSITORY', 'GITHUB_RUN_ID']
  const missing = required.filter(name => (process.env[name] ?? '').length === 0)
  if (missing.length > 0) throw new Error(`missing environment: ${missing.join(', ')}`)
  const context = {
    repository: process.env.GITHUB_REPOSITORY,
    runUrl: `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    workflow: process.env.GITHUB_WORKFLOW ?? 'Refresh catalog versions',
    refName: process.env.GITHUB_REF_NAME ?? '',
    sha: process.env.GITHUB_SHA ?? '',
    eventName: process.env.GITHUB_EVENT_NAME ?? '',
    actor: process.env.GITHUB_ACTOR ?? '',
    log: process.env.REFRESH_FAILURE_LOG ?? '',
  }
  const result = await notifyFailureIssue({
    token: process.env.GITHUB_TOKEN,
    ...context,
    fetchImpl: fetch,
  })
  console.log(`${result.action} ${result.url}`)
  const cfUrl = process.env.CF_NOTIFY_URL ?? ''
  const cfToken = process.env.CF_NOTIFY_TOKEN ?? ''
  if (cfUrl.length > 0 && cfToken.length > 0) {
    await postCloudflareMail({
      url: cfUrl,
      token: cfToken,
      mail: buildFailureMail(context),
      fetchImpl: fetch,
    })
    console.log(`sent Cloudflare HTML mail to ${cfUrl}`)
  }
}
