#!/usr/bin/env node
/**
 * Resolve StarPivotNet members plus notify-recipients.txt, then write the
 * Chinese HTML failure mail. The workflow sends that file through SMTP.
 */
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const GITHUB_API = 'https://api.github.com'
const ORG = 'StarPivotNet'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
 * @param {string} raw
 * @returns {string[]}
 */
export function parseRecipientFile(raw) {
  const emails = []
  const seen = new Set()
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue
    if (!EMAIL.test(trimmed)) {
      throw new Error(`notify-recipients.txt has an invalid email: ${trimmed}`)
    }
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    emails.push(trimmed)
  }
  return emails
}

/**
 * @param {unknown} user
 * @returns {string | undefined}
 */
export function publicEmailFromUser(user) {
  if (user === null || typeof user !== 'object' || Array.isArray(user)) return undefined
  const email = /** @type {Record<string, unknown>} */ (user).email
  if (typeof email !== 'string') return undefined
  const trimmed = email.trim()
  return EMAIL.test(trimmed) ? trimmed : undefined
}

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
 * @param {string} input.token
 * @param {string} input.extraRaw
 * @param {typeof fetch} input.fetchImpl
 * @returns {Promise<string[]>}
 */
export async function resolveRecipients(input) {
  const extra = parseRecipientFile(input.extraRaw)
  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${input.token}`,
    'user-agent': 'dsh-plugin-catalog-refresh-notifier',
    'x-github-api-version': '2022-11-28',
  }
  const membersResponse = await input.fetchImpl(`${GITHUB_API}/orgs/${ORG}/members?per_page=100`, { headers })
  if (!membersResponse.ok) {
    throw new Error(`GET /orgs/${ORG}/members returned ${String(membersResponse.status)}`)
  }
  const members = parseOrgMembers(await membersResponse.json())
  const emails = [...extra]
  const seen = new Set(extra.map(email => email.toLowerCase()))
  const missing = []
  for (const member of members) {
    const userResponse = await input.fetchImpl(`${GITHUB_API}/users/${encodeURIComponent(member.login)}`, { headers })
    if (!userResponse.ok) {
      throw new Error(`GET /users/${member.login} returned ${String(userResponse.status)}`)
    }
    const email = publicEmailFromUser(await userResponse.json())
    if (email === undefined) {
      missing.push(member.login)
      continue
    }
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    emails.push(email)
  }
  if (emails.length === 0) {
    throw new Error(
      `no deliverable email for StarPivotNet members (${missing.join(', ') || 'none listed'}). `
      + 'Add addresses to notify-recipients.txt or publish a GitHub profile email.',
    )
  }
  if (missing.length > 0) {
    console.log(`no public GitHub email for: ${missing.join(', ')}`)
  }
  return emails
}

/**
 * @param {string} name
 * @param {string} value
 * @returns {string}
 */
export function githubOutputLine(name, value) {
  if (value.includes('\n')) {
    throw new Error(`${name} cannot contain a newline`)
  }
  return `${name}=${value}\n`
}

const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const required = ['GITHUB_TOKEN', 'GITHUB_REPOSITORY', 'GITHUB_RUN_ID']
  const missing = required.filter(name => (process.env[name] ?? '').length === 0)
  if (missing.length > 0) throw new Error(`missing environment: ${missing.join(', ')}`)
  const root = dirname(fileURLToPath(import.meta.url))
  const extraRaw = await readFile(resolve(root, '../notify-recipients.txt'), 'utf8')
  const recipients = await resolveRecipients({
    token: process.env.GITHUB_TOKEN,
    extraRaw,
    fetchImpl: fetch,
  })
  const runUrl = `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  const mail = buildFailureMail({
    repository: process.env.GITHUB_REPOSITORY,
    runUrl,
    workflow: process.env.GITHUB_WORKFLOW ?? 'Refresh catalog versions',
    refName: process.env.GITHUB_REF_NAME ?? '',
    sha: process.env.GITHUB_SHA ?? '',
    eventName: process.env.GITHUB_EVENT_NAME ?? '',
    actor: process.env.GITHUB_ACTOR ?? '',
    log: process.env.REFRESH_FAILURE_LOG ?? '',
  })
  await writeFile(resolve(root, '../failure-mail.html'), mail.html)
  const outputPath = process.env.GITHUB_OUTPUT
  if (outputPath !== undefined && outputPath.length > 0) {
    await appendFile(outputPath, githubOutputLine('to', recipients.join(',')))
    await appendFile(outputPath, githubOutputLine('subject', mail.subject))
  }
  console.log(`prepared failure mail for ${String(recipients.length)} recipient(s)`)
}
