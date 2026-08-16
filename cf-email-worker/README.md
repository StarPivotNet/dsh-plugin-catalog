# Cloudflare failure mail

Optional Worker that accepts the catalog refresh failure payload and sends the Chinese HTML mail through Cloudflare Email Sending.

GitHub still cannot send arbitrary mail. This Worker is the Cloudflare hop.

## One-time Cloudflare setup

This Worker is bound to `fastaicode.top`. The Action POSTs to `https://catalog-notify.fastaicode.top`. The mail From address is `catalog@fastaicode.top`. Destination inboxes must be verified destination addresses in the Cloudflare account (`523528830@qq.com` is verified; `445714414@qq.com` still needs the confirmation mail).

1. Enable **Email Routing** on `fastaicode.top` and add destination inboxes (`523528830@qq.com`, `445714414@qq.com`).
2. Allow Workers Email Sending from `catalog@fastaicode.top`.
3. Deploy from a machine that can run `npx wrangler login` (needs the Cloudflare account that owns the zone):

```sh
cd cf-email-worker
npx wrangler login
npx wrangler secret put AUTH_TOKEN
npx wrangler secret put MAIL_TO
# paste: 523528830@qq.com,445714414@qq.com
npx wrangler deploy
```

The GitHub repository secrets are already set:

- `CF_NOTIFY_URL` = `https://catalog-notify.fastaicode.top`
- `CF_NOTIFY_TOKEN` = the Worker `AUTH_TOKEN`

If those secrets are absent, the Action only opens the GitHub Issue.
