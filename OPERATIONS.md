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
```

The push check should return `{"ok":true,"users":0}`. The API check should return `{"ok":true}`.

The observed response from `https://ubuntu-4gb-nbg1-3.tail6bd62e.ts.net/lift-api/health` is `401`; use the explicit `:8443` route above for API health. The `401` is treated as expected route/auth behavior from the default Tailscale Serve path, not as the API’s local health result. If the `:8443` check also fails, investigate the configured Tailscale route and authentication separately.

Client integration note: the current production client code derives its default API base from the Tailscale origin as `/lift-api`, so it may encounter that default-route `401`. This documentation records the verified service route but does not change the client. Before relying on API-backed production workflows, test the client’s configured API base and, in a separately approved application change, align it with the working `:8443` route or the intended authenticated proxy route.

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
