# Cloudflare failure mail

Optional Worker that accepts the catalog refresh failure payload and sends the Chinese HTML mail through Cloudflare Email Sending.

GitHub still cannot send arbitrary mail. This Worker is the Cloudflare hop.

## One-time Cloudflare setup

1. Put a zone on Cloudflare and enable **Email Routing**.
2. Verify a sender such as `catalog@your-domain`.
3. Enable **Workers Email Sending** (`SEB`) for this Worker.
4. Deploy:

```sh
cd cf-email-worker
npx wrangler login
npx wrangler secret put AUTH_TOKEN
npx wrangler secret put MAIL_TO
# paste: member@example.com,other@example.com
npx wrangler deploy
```

Set `MAIL_FROM` in `wrangler.toml` to the verified sender, then put these repository secrets on `dsh-plugin-catalog`:

- `CF_NOTIFY_URL` — the Worker URL, for example `https://dsh-plugin-catalog-notify.<subdomain>.workers.dev`
- `CF_NOTIFY_TOKEN` — the same value as `AUTH_TOKEN`

If those secrets are absent, the Action only opens the GitHub Issue.
