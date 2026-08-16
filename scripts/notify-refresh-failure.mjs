#!/usr/bin/env node
/**
 * Open or reuse a GitHub Issue that @-mentions every StarPivotNet member.
 * GitHub then emails watchers through their notification settings.
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
  const result = await notifyFailureIssue({
    token: process.env.GITHUB_TOKEN,
    repository: process.env.GITHUB_REPOSITORY,
    runUrl: `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    workflow: process.env.GITHUB_WORKFLOW ?? 'Refresh catalog versions',
    refName: process.env.GITHUB_REF_NAME ?? '',
    sha: process.env.GITHUB_SHA ?? '',
    eventName: process.env.GITHUB_EVENT_NAME ?? '',
    actor: process.env.GITHUB_ACTOR ?? '',
    log: process.env.REFRESH_FAILURE_LOG ?? '',
    fetchImpl: fetch,
  })
  console.log(`${result.action} ${result.url}`)
}
