/**
 * Accept a Chinese HTML failure payload from GitHub Actions and send it
 * through Cloudflare Email Routing / Workers Email Sending.
 *
 * Bindings:
 *   MAIL_FROM  verified sender on the zone
 *   MAIL_TO    comma-separated inboxes
 *   AUTH_TOKEN shared secret from the Action (CF_NOTIFY_TOKEN)
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * @param {string} raw
 * @returns {string[]}
 */
function parseRecipients(raw) {
  return raw.split(',').map(item => item.trim()).filter(item => item.length > 0)
}

export default {
  /**
   * @param {Request} request
   * @param {{ MAIL_FROM?: string, MAIL_TO?: string, AUTH_TOKEN?: string, SEB?: { send: (message: unknown) => Promise<void> } }} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('method not allowed', { status: 405 })
    }
    const expected = env.AUTH_TOKEN ?? ''
    const got = request.headers.get('authorization') ?? ''
    if (expected.length === 0 || got !== `Bearer ${expected}`) {
      return new Response('unauthorized', { status: 401 })
    }
    const payload = await request.json()
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return new Response('payload must be an object', { status: 400 })
    }
    const subject = payload.subject
    const html = payload.html
    const text = payload.text
    if (typeof subject !== 'string' || typeof html !== 'string' || typeof text !== 'string') {
      return new Response('payload needs subject, html, and text', { status: 400 })
    }
    const from = env.MAIL_FROM ?? ''
    const to = parseRecipients(env.MAIL_TO ?? '')
    if (!EMAIL.test(from) || to.length === 0 || to.some(address => !EMAIL.test(address))) {
      return new Response('MAIL_FROM / MAIL_TO are not configured', { status: 500 })
    }
    const { EmailMessage } = await import('cloudflare:email')
    const rfc822 = [
      `From: ${from}`,
      `To: ${to.join(', ')}`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="dsh-catalog"',
      '',
      '--dsh-catalog',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      text,
      '--dsh-catalog',
      'Content-Type: text/html; charset=UTF-8',
      '',
      html,
      '--dsh-catalog--',
      '',
    ].join('\r\n')
    await env.SEB.send(new EmailMessage(from, to[0], rfc822))
    return new Response('sent', { status: 200 })
  },
}
