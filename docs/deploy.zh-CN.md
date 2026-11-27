# 部署教程

[English](deploy.md) · **简体中文** · [日本語](deploy.ja.md) · [Deutsch](deploy.de.md) · [Bahasa Indonesia](deploy.id.md)

这篇教程带你从一台空白的 Linux 服务器开始，把 Open Social Listening 部署到你自己的域名上，配好 HTTPS、访问密码、升级和备份。全程大约 15 分钟，只需要复制粘贴命令，不需要写代码。

部署完成后，接着看[使用教程](getting-started.zh-CN.md)，创建你的第一个项目。

**只想先看看效果？** [在线演示](https://socqapi.github.io/open-social-listening/)直接在浏览器里运行，带有示例数据。想在自己电脑上试，先安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)，再执行下面的第 3、4 步，访问地址是 http://localhost:3000 。

## 目录

1. [准备一台服务器](#1-准备一台服务器)
2. [安装 Docker](#2-安装-docker)
3. [启动 Open Social Listening](#3-启动-open-social-listening)
4. [在浏览器里打开](#4-在浏览器里打开)
5. [绑定域名并开启 HTTPS](#5-绑定域名并开启-https)
6. [升级到新版本](#6-升级到新版本)
7. [备份和迁移数据](#7-备份和迁移数据)
8. [常见问题](#8-常见问题)

## 1. 准备一台服务器

任何 Linux 云服务器都可以。Open Social Listening 很轻量，应用加上 SQLite 数据库只占用几百 MB 内存。

| | 最低配置 | 推荐配置 |
| --- | --- | --- |
| CPU | 1 核，x86-64 或 ARM64 | 1–2 核 |
| 内存 | 512 MB | 1 GB |
| 硬盘 | 2 GB 可用空间 | 10 GB |
| 系统 | 能运行 Docker 的 Linux | Ubuntu 24.04 或 Debian 12 |

Hetzner、DigitalOcean、Vultr、Linode、AWS Lightsail、阿里云、腾讯云的入门套餐都够用。服务器需要一直开着，因为应用会按计划定时采集新的提及。

> **服务器在中国大陆时请注意：** 下面用到的 get.docker.com 和镜像仓库 ghcr.io 在大陆访问可能很慢甚至失败；域名解析到大陆服务器并开放 80/443 端口还需要 ICP 备案。如果没有特别要求，建议直接选香港或海外地域的服务器。

用 root 账号，或者有 `sudo` 权限的账号登录服务器：

```bash
ssh root@YOUR_SERVER_IP
```

## 2. 安装 Docker

Docker 官方的安装脚本会一次装好 Docker 和 Compose 插件：

```bash
curl -fsSL https://get.docker.com | sh
```

确认两者都能用：

```bash
docker --version
docker compose version
```

`docker compose version` 应该显示 v2.24 或更高版本。如果服务器上原本就装了 Docker 但版本更旧，请用系统的包管理器升级。

## 3. 启动 Open Social Listening

为应用新建一个文件夹，并下载它的 compose 文件：

```bash
mkdir -p /opt/open-social-listening
cd /opt/open-social-listening
curl -fsSLO https://raw.githubusercontent.com/SocQAPI/open-social-listening/main/docker-compose.yml
```

设置一个访问密码，否则任何能访问这台服务器的人都能看到你的提及、修改你的设置。下面的命令会生成一个随机密码，保存到名为 `.env` 的文件里：

```bash
echo "OSL_PASSWORD=$(openssl rand -base64 18)" > .env
cat .env
```

把密码记下来，然后启动应用：

```bash
docker compose up -d
```

Docker 会下载镜像（约 150 MB）并在后台启动。程序崩溃或服务器重启后，它会自动重新运行。确认它在运行：

```bash
docker compose ps
```

`STATUS` 一栏应该显示 `Up`。你的数据保存在 `/opt/open-social-listening/data`。

**其他设置**也写在同一个 `.env` 文件里，每行一项，全部可选：

| 设置 | 作用 |
| --- | --- |
| `OSL_PASSWORD` | 所有页面和 API 的访问密码。浏览器还会要求输入用户名，随便填即可。 |
| `SOCQ_API_KEY` | 你的 SocQ API Key。通常直接在应用里粘贴就行（见[使用教程](getting-started.zh-CN.md)）。 |
| `SMTP_URL`、`ALERT_FROM` | 只有邮件告警才需要，例如 `SMTP_URL=smtp://user:password@smtp.example.com:587` 和 `ALERT_FROM=Alerts <alerts@example.com>`。Slack、Discord 和 Webhook 告警不需要在这里配置。 |

修改 `.env` 之后，执行 `docker compose up -d` 让它生效。

## 4. 在浏览器里打开

访问 `http://YOUR_SERVER_IP:3000`。浏览器会弹出登录框：用户名随便填，密码填 `.env` 里的那个。

看到一个带示例提及的演示项目，就说明一切正常。接下来看[使用教程](getting-started.zh-CN.md)，连接 SocQ 并创建你自己的项目。

如果页面打不开，多半是服务器的防火墙没放行。在云服务商的防火墙或安全组里放行 TCP 3000 端口（如果用了 `ufw`，也要在里面放行）。做完第 5 步后可以再关掉。

## 5. 绑定域名并开启 HTTPS

没有 HTTPS 时，你的密码会以明文在网络上传输，所以强烈建议做这一步。你需要一个域名或子域名，例如 `listening.example.com`。[Caddy](https://caddyserver.com) 会自动申请和续期证书。

1. **把域名解析到服务器。** 在域名的 DNS 服务商那里，为 `listening.example.com` 添加一条 `A` 记录，值填服务器的 IP 地址（服务器有 IPv6 的话再加一条 `AAAA` 记录）。等到 `ping listening.example.com` 显示的是你服务器的 IP。

2. **放行 80 和 443 端口。** 在云服务商的防火墙或安全组里放行这两个端口，Caddy 申请证书时两个都要用到。

3. **告诉 Caddy 你的域名。** 在 `/opt/open-social-listening` 里新建一个名为 `Caddyfile` 的文件（把域名换成你自己的）：

   ```bash
   cat > Caddyfile <<'EOF'
   listening.example.com {
   	reverse_proxy open-social-listening:3000
   }
   EOF
   ```

4. **把 Caddy 加到应用旁边。** 新建 `docker-compose.override.yml`。Docker Compose 会把它和 `docker-compose.yml` 合在一起读取，这样下载来的那个文件保持原样，以后升级也简单：

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

5. **同时启动两者：**

   ```bash
   docker compose up -d
   ```

打开 `https://listening.example.com`。第一次访问时 Caddy 要先申请证书，可能需要等几秒。如果失败了，`docker compose logs caddy` 会写明原因，几乎都是 DNS 记录还没生效，或者 80、443 端口没放行。

现在可以在防火墙里关掉 3000 端口了。

## 6. 升级到新版本

```bash
cd /opt/open-social-listening
docker compose pull
docker compose up -d
```

你的项目、提及和设置都保存在 `data/` 里，不会丢失。应用启动时会自动完成数据库结构的升级。升级后想清理旧镜像，执行 `docker image prune -f`。

**固定在某个版本。** `latest` 始终是最新发布的版本。想自己决定什么时候升级，就把 `docker-compose.yml` 里的 `latest` 换成[发布页](https://github.com/SocQAPI/open-social-listening/releases)上的版本号，例如 `ghcr.io/socqapi/open-social-listening:0.1`。

## 7. 备份和迁移数据

所有数据都在 `data` 文件夹里：一个 SQLite 数据库，包含你的项目、提及、告警渠道和 API Key。先短暂停止应用，保证复制出来的数据完整，然后再启动：

```bash
cd /opt/open-social-listening
mkdir -p backups
docker compose stop open-social-listening
tar czf "backups/osl-$(date +%F).tgz" data
docker compose start open-social-listening
```

把 `backups/` 里的文件复制到服务器以外的地方保存，例如用 `scp` 下载到自己电脑。想每天凌晨 3 点自动备份，执行 `crontab -e` 并加入这一行：

```cron
0 3 * * * cd /opt/open-social-listening && docker compose stop open-social-listening && tar czf "backups/osl-$(date +\%F).tgz" data && docker compose start open-social-listening
```

**恢复数据或迁移到新服务器：** 先安装 Docker（第 2 步），再把整个 `/opt/open-social-listening` 文件夹复制过去（`docker-compose.yml`、`.env`、`data/`，用了 HTTPS 的话还有 `Caddyfile` 和 `docker-compose.override.yml`），然后在里面执行 `docker compose up -d`。域名也要迁移的话，记得修改 DNS 记录。

## 8. 常见问题

**先看日志。** 大部分问题的原因都写在这里：

```bash
cd /opt/open-social-listening
docker compose logs --tail 100 open-social-listening
```

| 问题 | 处理办法 |
| --- | --- |
| `:3000` 打不开 | 在云防火墙或安全组里放行 TCP 3000。确认 `docker compose ps` 显示 `Up`。 |
| 报错 `port is already allocated` | 3000 端口被别的程序占用了。把 `docker-compose.yml` 里冒号左边的数字改掉，例如 `"8080:3000"`，并改为放行这个端口。 |
| HTTPS 不生效 | `A` 记录必须指向这台服务器，且 80、443 端口已放行。`docker compose logs caddy` 会显示具体错误。 |
| 不认识 `!override` | Docker Compose 版本低于 v2.24。升级 Docker，或者重新执行第 2 步的安装脚本。 |
| 浏览器反复要求输入密码 | 密码是 `.env` 里 `OSL_PASSWORD=` 后面的内容，不含空格。用户名随便填。 |
| 收不到邮件告警 | 检查 `.env` 里的 `SMTP_URL` 和 `ALERT_FROM`，执行 `docker compose up -d`，再在应用的设置页点 **发送测试**。 |
| 项目不再采集 | 项目暂停时，每个页面顶部都会写明原因：预算用完、积分不足或 API Key 被拒绝。见[使用教程](getting-started.zh-CN.md#控制费用)。 |

**不用 Docker 运行。** 在服务器上长期运行，推荐的方式是 Docker。本地开发请看 [README](../README.zh-CN.md#开发)。

还是解决不了？[提交 Issue](https://github.com/SocQAPI/open-social-listening/issues)，附上 `docker compose logs --tail 100` 的输出（记得删掉密码和 API Key）。
