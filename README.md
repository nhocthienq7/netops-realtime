# NetOps Realtime — Multi-site, Ping + SNMP MVP

A runnable Docker Compose starter for authorized network monitoring across multiple customer sites.

## Included
- FastAPI backend, PostgreSQL, separate polling worker.
- Multi-tenant organizations: account registration creates an organization; data is scoped to that organization.
- Multiple users can log in to the same organization only after a user-management/invitation feature is added (not included in this MVP).
- Sites and device inventory for multiple vendors.
- ICMP ping + SNMPv2c read of `sysDescr.0` and `sysUpTime.0`.
- Worker writes state changes to an event log; web UI refreshes every 5 seconds.
- JWT login, password hashing, tenant-scoped CRUD, CSV export.

## Quick start on a local computer
Requirements: Docker Desktop / Docker Engine + Docker Compose.

```bash
cp .env.example .env
```
Edit `.env` and set strong random values for `POSTGRES_PASSWORD` and `JWT_SECRET`. Keep `.env` private. Then:
```bash
docker compose up --build -d
docker compose logs -f api worker
```
Open `http://localhost:8000`, register your organization and admin account, create a site, then add a device. For SNMP, tick SNMP and enter a **read-only** community string. The worker must have IP connectivity to the device and UDP/161 must be permitted.

## Deploy to a cloud VPS
Recommended MVP deployment: Ubuntu 24.04 VPS with Docker Compose, public DNS, HTTPS reverse proxy (Caddy or Nginx), and firewall. A cloud static hosting service alone cannot ping private LAN devices; the worker must run on a machine with routed access to each monitored network.

1. Provision an Ubuntu VPS with private/VPN connectivity to customer networks. Do not expose management VLANs to the public Internet.
2. Install Docker Engine and Compose plugin using Docker's official Ubuntu installation instructions.
3. Upload this project to the VPS; copy `.env.example` to `.env`, set long random secrets, and ensure `.env` is not committed or shared.
4. Start `docker compose up --build -d`.
5. Put Caddy/Nginx in front of `127.0.0.1:8000` and enable HTTPS. The API port is bound to localhost on purpose.
6. Use VPN/site-to-site WireGuard/IPsec or a customer-side monitoring agent to reach customer device subnets. Restrict ICMP and UDP/161 to the monitoring worker's source IP.
7. Back up PostgreSQL regularly and test restore.

## Important operational limits / hardening required before production
- This is an MVP, not a finished enterprise NMS. Test against your exact device models and SNMP settings.
- SNMPv2c community is stored in plaintext in this starter. Use a dedicated read-only community, restrict source IP by ACL, and never expose UDP/161 publicly. Before production, implement encrypted secrets and preferably SNMPv3 authPriv.
- Registration is open in this starter. Before exposing to the Internet, disable public registration after the first organization/admin is created and implement invite-only account creation, user management, MFA, rate limiting and audit logging.
- All users in an organization currently have the same admin-like inventory permissions. Fine-grained RBAC is not implemented.
- The worker currently polls all organizations from one worker. If the VPS cannot route to a customer's LAN, the device will appear offline. Use per-site agents/VPN for segmented networks.
- Polling is sequential. For hundreds/thousands of devices, add concurrency limits, queueing, retries/backoff, retention policies and metrics.
- SNMPv3 is not implemented in this MVP; only SNMPv2c is accepted.
- Device `status=warning` means Ping succeeded but SNMP did not respond when both checks are enabled. SNMP-only devices are online if SNMP responds.
- Do not use this to scan networks you do not own or have permission to monitor.

## Troubleshooting
- `docker compose ps` and `docker compose logs -f worker`
- Ping not working: check routing, firewall/ACL, host ping policy and whether the worker container can reach the IP.
- SNMP not working: enable SNMP agent, verify read-only community and UDP/161 ACL, check version and device support.
- Database change: for this starter, SQLAlchemy creates missing tables on startup. Use Alembic migrations before production.
