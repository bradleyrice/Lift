# LIFT operations

These checks are read-only and apply to the hardened VPS. Run them through an approved administrative path; they are documentation for operators, not permission to access or modify the VPS.

## Health check

Check service state and listener addresses:

```bash
systemctl is-active lift-push.service
systemctl is-active lift-api.service

ss -lntp | grep -E ':3000|:8765'
```

Expected listeners:

- `lift-push`: `127.0.0.1:3000`
- `lift-api`: `127.0.0.1:8765`

Check local health:

```bash
curl -fsS http://127.0.0.1:3000/health
curl -fsS http://127.0.0.1:8765/health
```

Expected responses:

```json
{"ok":true,"users":0}
{"ok":true}
```

Check Tailscale routes:

```bash
curl -k -fsS https://ubuntu-4gb-nbg1-3.tail6bd62e.ts.net/lift-push/health
curl -k -fsS https://ubuntu-4gb-nbg1-3.tail6bd62e.ts.net:8443/lift-api/health
curl -k -i --connect-timeout 10 https://ubuntu-4gb-nbg1-3.tail6bd62e.ts.net/lift-api/health
```

The push check should return `{"ok":true,"users":0}`. The API check should return `{"ok":true}`.

The authoritative client API base is `https://ubuntu-4gb-nbg1-3.tail6bd62e.ts.net:8443/lift-api`. It should return `{"ok":true}` for health.

The default-origin URL `https://ubuntu-4gb-nbg1-3.tail6bd62e.ts.net/lift-api/health` currently returns `401` with `WWW-Authenticate: Basic realm="Radicale - Password Required"` and a WSGI server response. This is a proxy misroute to Radicale, not expected LIFT API authentication behavior. Do not use that route as the client API base until the proxy is deliberately corrected.

The client has a deployment mapping for the known Tailscale hostname, and `lift_api_base_url` in localStorage takes precedence. To override it in a browser console:

```js
localStorage.setItem(
  'lift_api_base_url',
  'https://ubuntu-4gb-nbg1-3.tail6bd62e.ts.net:8443/lift-api'
);
location.reload();
```

To reset the override:

```js
localStorage.removeItem('lift_api_base_url');
location.reload();
```

The API’s explicit `:8443` origin is permitted in `netlify.toml` via a narrow `connect-src` entry. If the API host or port changes, update that CSP entry in the same approved application change.

Before relying on API-backed production workflows, test the configured API base with a read-only identity/table request in addition to the health endpoint. The client sends API requests without credentials, so confirm the API’s intended Tailscale/authentication behavior before changing the deployment route.

Confirm that public port 3000 is not exposed:

```bash
curl -fsS --connect-timeout 5 http://178.104.110.52:3000/health
```

This should fail or be unreachable. Do not make it pass by running `ufw allow 3000/tcp`; public exposure requires explicit approval and documentation as a deliberate security exception.

## Troubleshooting

### Tailscale push health fails, local push health works

Check the Tailscale Serve mapping to `127.0.0.1:3000`. The application is healthy locally, so focus on the proxy route, tailnet connectivity, and the exact `/lift-push/health` path.

### Local health fails

Check, in this order:

```bash
systemctl status lift-push.service lift-api.service --no-pager
journalctl -u lift-push.service -u lift-api.service -n 100 --no-pager
```

Then verify the service’s bind address, its environment file ownership/mode, and whether systemd sandbox restrictions are blocking a required read or write. Do not print secret values while checking environment configuration.

### Database writes fail

Verify that `/var/lib/lift` is owned by `liftapi:liftapi` and that the API unit includes `ReadWritePaths=/var/lib/lift`. Confirm the process runs as `User=liftapi` and `Group=liftapi`. Add a narrow writable path for any new data directory; do not relax the entire sandbox.

### Push service cannot read secrets

Verify that `/etc/lift-push.env` exists, is owned by `root:liftpush`, has mode `0640`, and is referenced by the unit as:

```ini
EnvironmentFile=/etc/lift-push.env
```

Check metadata and unit configuration without exposing contents. Never replace this with inline secrets in a unit or repository file.

### API or push service cannot create a new file

This is expected outside an explicitly writable path because of `ProtectSystem=strict`. Create a dedicated directory with the correct service ownership and add it to `ReadWritePaths=` through an approved unit change. Do not revert to root, remove `NoNewPrivileges`, or set `ProtectSystem=off`.

## Safe change boundaries

Root SSH is disabled. The repository does not define a LIFT deployment/admin wrapper, so LIFT service changes may require the VPS provider console or another separately approved admin path. The non-root `deploy` workflow described for the trading bot must not be assumed to grant LIFT access.

Never edit `/etc/lift-push.env`, `/etc/lift-api.env`, systemd units, nginx, UFW, SSH configuration, or live application files during a documentation-only task. Obtain explicit approval before any restart, deployment, firewall change, privilege change, or package change.
