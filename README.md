# LIFT workout tracker

LIFT is a static workout-tracking client. In production it uses the LIFT services on the shared VPS for push notifications and API-backed data, while the client remains usable with its local/offline behavior.

## Production service endpoints

Use the Tailscale hostname for operator and device access:

- Push service: `https://ubuntu-4gb-nbg1-3.tail6bd62e.ts.net/lift-push`
- LIFT API base: `https://ubuntu-4gb-nbg1-3.tail6bd62e.ts.net:8443/lift-api`

The client selects that API base for the known LIFT Tailscale deployment. It also supports a per-device override in browser localStorage:

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

The explicit `:8443` origin is allowed by the site Content Security Policy because it is a different origin from the app’s default HTTPS port.

The push service is intentionally no longer exposed on the VPS public port `3000`. Do not configure clients to use `http://178.104.110.52:3000`.

Operational and deployment notes are in [OPERATIONS.md](OPERATIONS.md) and [DEPLOYMENT.md](DEPLOYMENT.md).

## Repository scope

This repository contains the static client and its assets. It does not contain the live VPS systemd unit files, environment files, nginx/Tailscale configuration, or a LIFT deployment wrapper. Changes to those systems require an approved administrative workflow.
