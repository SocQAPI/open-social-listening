# Deployment guide

**English** · [简体中文](deploy.zh-CN.md) · [日本語](deploy.ja.md) · [Deutsch](deploy.de.md) · [Bahasa Indonesia](deploy.id.md)

This guide takes you from an empty Linux server to Open Social Listening running on your own domain with HTTPS,
a password, updates and backups. It takes about 15 minutes. You copy commands; no programming is needed.

When the app is running, continue with [Getting started](getting-started.md) to set up your first project.

**Just want to look around first?** The [live demo](https://socqapi.github.io/open-social-listening/) runs in your
browser with sample data. To try it on your own computer, install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
and run steps 3 and 4 below; the address is then http://localhost:3000.

## Contents

1. [Get a server](#1-get-a-server)
2. [Install Docker](#2-install-docker)
3. [Start Open Social Listening](#3-start-open-social-listening)
4. [Open it in your browser](#4-open-it-in-your-browser)
5. [Add a domain and HTTPS](#5-add-a-domain-and-https)
6. [Update to a new version](#6-update-to-a-new-version)
7. [Back up and move your data](#7-back-up-and-move-your-data)
8. [Troubleshooting](#8-troubleshooting)

## 1. Get a server

Any Linux virtual server works. Open Social Listening is light: the app and its SQLite database use a few hundred
MB of memory.

| | Minimum | Comfortable |
| --- | --- | --- |
| CPU | 1 vCPU, x86-64 or ARM64 | 1–2 vCPU |
| Memory | 512 MB | 1 GB |
| Disk | 2 GB free | 10 GB |
| System | Any Linux that runs Docker | Ubuntu 24.04 or Debian 12 |

A small plan at Hetzner, DigitalOcean, Vultr, Linode, AWS Lightsail, Alibaba Cloud or Tencent Cloud is enough. The
server needs to run around the clock, because the app collects new mentions on a schedule.

Log in as root, or as a user with `sudo`:

```bash
ssh root@YOUR_SERVER_IP
```

## 2. Install Docker

Docker's official install script sets up Docker and the Compose plugin in one step:

```bash
curl -fsSL https://get.docker.com | sh
```

Check that both work:

```bash
docker --version
docker compose version
```

`docker compose version` should print v2.24 or newer. If Docker is already installed and prints something older,
update it with your system's package manager.

## 3. Start Open Social Listening

Create a folder for the app and download its compose file:

```bash
mkdir -p /opt/open-social-listening
cd /opt/open-social-listening
curl -fsSLO https://raw.githubusercontent.com/SocQAPI/open-social-listening/main/docker-compose.yml
```

Choose a password. Anyone who can reach the server could otherwise read your mentions and change your settings.
This command makes a random one and stores it in a file called `.env`:

```bash
echo "OSL_PASSWORD=$(openssl rand -base64 18)" > .env
cat .env
```

Write the password down. Then start the app:

```bash
docker compose up -d
```

Docker downloads the image (about 150 MB) and starts it in the background. It restarts on its own after a crash
or a server reboot. Check that it is running:

```bash
docker compose ps
```

The `STATUS` column should say `Up`. Your data is stored in `/opt/open-social-listening/data`.

**Other settings** go in the same `.env` file, one per line. All are optional:

| Setting | What it does |
| --- | --- |
| `OSL_PASSWORD` | Password for every page and the API. The browser asks for a user name too; type anything. |
| `SOCQ_API_KEY` | Your SocQ API key. Usually you paste it in the app instead (see [Getting started](getting-started.md)). |
| `SMTP_URL`, `ALERT_FROM` | Only for email alerts, e.g. `SMTP_URL=smtp://user:password@smtp.example.com:587` and `ALERT_FROM=Alerts <alerts@example.com>`. Slack, Discord and webhook alerts need nothing here. |

After editing `.env`, apply it with `docker compose up -d`.

## 4. Open it in your browser

Go to `http://YOUR_SERVER_IP:3000`. The browser asks for a user name and password: type any user name and the
password from `.env`.

You should see a demo project with sample mentions. That means everything works. Head to
[Getting started](getting-started.md) to connect SocQ and create your own project.

If the page does not load, the server's firewall is probably closed. Allow TCP port 3000 in your cloud provider's
firewall or security group (and in `ufw`, if you use it). You can close it again after step 5.

## 5. Add a domain and HTTPS

Without HTTPS your password travels over the internet unencrypted, so this step is strongly recommended. You need
a domain or subdomain, for example `listening.example.com`. [Caddy](https://caddyserver.com) will get and renew the
certificate for you.

1. **Point the domain at the server.** At your DNS provider, add an `A` record for `listening.example.com` with your
   server's IP address (and an `AAAA` record if the server has IPv6). Wait until `ping listening.example.com` shows
   your server's IP.

2. **Open ports 80 and 443** in your cloud firewall or security group. Caddy needs both to get the certificate.

3. **Tell Caddy your domain.** In `/opt/open-social-listening`, create a file called `Caddyfile` (replace the
   domain with yours):

   ```bash
   cat > Caddyfile <<'EOF'
   listening.example.com {
   	reverse_proxy open-social-listening:3000
   }
   EOF
   ```

4. **Add Caddy next to the app.** Create `docker-compose.override.yml`. Docker Compose reads it together with
   `docker-compose.yml`, so the downloaded file stays untouched and updates stay simple:

   ```bash
   cat > docker-compose.override.yml <<'EOF'
   services:
     open-social-listening:
       # Only Caddy talks to the app now; port 3000 is no longer reachable from outside.
       ports: !override
         - "127.0.0.1:3000:3000"
     caddy:
       image: caddy:2
       restart: unless-stopped
       ports:
         - "80:80"
         - "443:443"
         - "443:443/udp"
       volumes:
         - ./Caddyfile:/etc/caddy/Caddyfile:ro
         - caddy-data:/data
         - caddy-config:/config
   volumes:
     caddy-data:
     caddy-config:
   EOF
   ```

5. **Start both:**

   ```bash
   docker compose up -d
   ```

Open `https://listening.example.com`. The first visit can take a few seconds while Caddy gets the certificate. If it
fails, `docker compose logs caddy` says why; almost always the DNS record or ports 80 and 443 are not ready yet.

You can now close port 3000 in your firewall.

## 6. Update to a new version

```bash
cd /opt/open-social-listening
docker compose pull
docker compose up -d
```

Your projects, mentions and settings stay in `data/`. Updates apply database changes on their own when the app
starts. To clean up old image downloads afterwards, run `docker image prune -f`.

**Staying on one version.** `latest` follows the newest release. To choose when you update, replace `latest` in
`docker-compose.yml` with a version number from the [releases page](https://github.com/SocQAPI/open-social-listening/releases),
e.g. `ghcr.io/socqapi/open-social-listening:0.1`.

## 7. Back up and move your data

Everything lives in the `data` folder: one SQLite database with your projects, mentions, alert channels and API key.
Stop the app for a moment so the copy is consistent, then start it again:

```bash
cd /opt/open-social-listening
mkdir -p backups
docker compose stop open-social-listening
tar czf "backups/osl-$(date +%F).tgz" data
docker compose start open-social-listening
```

Copy the file in `backups/` somewhere off the server, for example with `scp` to your computer. To back up every night
at 03:00, run `crontab -e` and add this line:

```cron
0 3 * * * cd /opt/open-social-listening && docker compose stop open-social-listening && tar czf "backups/osl-$(date +\%F).tgz" data && docker compose start open-social-listening
```

**Restore or move to a new server:** install Docker (step 2), copy the whole `/opt/open-social-listening` folder
(`docker-compose.yml`, `.env`, `data/` and, if you use them, `Caddyfile` and `docker-compose.override.yml`), then run
`docker compose up -d` in it. If the domain moves too, update its DNS record.

## 8. Troubleshooting

**Show the logs.** Most problems explain themselves here:

```bash
cd /opt/open-social-listening
docker compose logs --tail 100 open-social-listening
```

| Problem | What to do |
| --- | --- |
| The page does not load at `:3000` | Open TCP 3000 in the cloud firewall or security group. Check `docker compose ps` says `Up`. |
| `port is already allocated` | Something else uses port 3000. Change the left number in `docker-compose.yml`, e.g. `"8080:3000"`, and open that port instead. |
| HTTPS does not work | The `A` record must point at this server and ports 80 and 443 must be open. `docker compose logs caddy` shows the exact error. |
| `!override` is not understood | Docker Compose is older than v2.24. Update Docker, or re-run the install script from step 2. |
| The browser keeps asking for the password | The password is the text after `OSL_PASSWORD=` in `.env`, without spaces. Any user name works. |
| Email alerts are not sent | Check `SMTP_URL` and `ALERT_FROM` in `.env`, run `docker compose up -d`, then use **Send test** in the app's settings. |
| Projects stopped collecting | A paused project says why at the top of its pages: budget used, credits ran out or the API key was rejected. See [Getting started](getting-started.md#keep-costs-under-control). |

**Running without Docker.** Docker is the supported way to run the app on a server. For development, see the
[README](../README.md#development).

Still stuck? [Open an issue](https://github.com/SocQAPI/open-social-listening/issues) with the output of
`docker compose logs --tail 100`, with your password and API key removed.
