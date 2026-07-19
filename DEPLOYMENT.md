# LIFT deployment and VPS security model

This document describes the current production arrangement for LIFT on the shared VPS at `178.104.110.52`. The trading bot shares that host, so LIFT changes must preserve the host-wide security controls.

## What changed and why

The VPS was hardened after a broader security audit:

- `lift-push` changed from a public `*:3000` listener to `127.0.0.1:3000`. This removes an unnecessary public attack surface.
- Tailscale Serve remains the supported access path for the push endpoint.
- `lift-api` listens locally on `127.0.0.1:8765`.
- Both services run as dedicated non-root users: `liftpush:liftpush` and `liftapi:liftapi`.
- Secrets and service environment moved out of systemd unit text into root-owned environment files.
- systemd sandboxing limits filesystem writes and capabilities.
- UFW is active with default-deny incoming and default-allow outgoing. Public HTTP on `80/tcp`, SSH on `22/tcp`, Tailscale UDP `41641`, and `tailscale0` traffic are allowed; public `3000/tcp` is not.
- nginx no longer discloses its version. Public HTTP on port 80 still works.
- A 2 GiB swapfile with `vm.swappiness=10` was added for VPS resilience; no LIFT application change is required.

## Service identities and files

The live services are expected to have these identities:

| Service | User/group | Bind | Environment file |
| --- | --- | --- | --- |
| `lift-push.service` | `liftpush:liftpush` | `127.0.0.1:3000` | `/etc/lift-push.env` |
| `lift-api.service` | `liftapi:liftapi` | `127.0.0.1:8765` | `/etc/lift-api.env` |

Environment file permissions are part of the security model:

- `/etc/lift-push.env`: `root:liftpush`, mode `0640`
- `/etc/lift-api.env`: `root:liftapi`, mode `0640`

Never print these files, paste their contents into tickets, commit them, or add real values to this repository. If an example is needed, use placeholder names and values only.

The LIFT database/data directory is `/var/lib/lift`, owned by `liftapi:liftapi`. `lift-api` must be able to write there.

## systemd sandbox requirements

The live units use dedicated users and a restricted filesystem. Both services use:

```ini
PrivateTmp=yes
ProtectHome=yes
ProtectSystem=strict
NoNewPrivileges=yes
CapabilityBoundingSet=
AmbientCapabilities=
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
```

`lift-api.service` additionally allows writes with:

```ini
ReadWritePaths=/var/lib/lift
```

Under `ProtectSystem=strict`, new application writes fail unless their directory is explicitly writable. If the application later needs a cache, log, or upload directory, create a dedicated directory owned by the service user and add only that directory to `ReadWritePaths=`. Do not solve this by reverting to root or disabling `ProtectSystem`.

This repository has no systemd unit templates; the list above documents the required live design. If unit templates are added later, keep them synchronized with this section and review them before installation.

## Access and administration

Users and devices should use Tailscale, not the VPS public IP and port 3000. The raw endpoint `http://178.104.110.52:3000` is intentionally removed.

Root SSH is disabled. The trading-bot deployment workflow uses a non-root `deploy` account with narrowly scoped sudo for that project’s deployment wrapper. This repository currently has no LIFT-specific deployment or admin wrapper, so do not assume that account can administer LIFT. Use the provider console or another separately approved administrative path for LIFT operations.

Do not deploy, restart services, change sudo/SSH/firewall rules, or edit live VPS files as part of a documentation change.
