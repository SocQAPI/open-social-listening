# Installationsanleitung

[English](deploy.md) · [简体中文](deploy.zh-CN.md) · [日本語](deploy.ja.md) · **Deutsch** · [Bahasa Indonesia](deploy.id.md)

Diese Anleitung führt Sie von einem leeren Linux-Server bis zu Open Social Listening auf Ihrer eigenen Domain, mit
HTTPS, Passwort, Updates und Backups. Das dauert etwa 15 Minuten. Sie kopieren nur Befehle; Programmierkenntnisse
brauchen Sie nicht.

Sobald die App läuft, richten Sie mit [Erste Schritte](getting-started.de.md) Ihr erstes Projekt ein.

**Möchten Sie sich erst einmal umsehen?** Die [Live-Demo](https://socqapi.github.io/open-social-listening/) läuft mit
Beispieldaten direkt in Ihrem Browser. Um die App auf Ihrem eigenen Computer auszuprobieren, installieren Sie
[Docker Desktop](https://www.docker.com/products/docker-desktop/) und führen die Schritte 3 und 4 unten aus; die
Adresse lautet dann http://localhost:3000.

## Inhalt

1. [Server besorgen](#1-server-besorgen)
2. [Docker installieren](#2-docker-installieren)
3. [Open Social Listening starten](#3-open-social-listening-starten)
4. [Im Browser öffnen](#4-im-browser-öffnen)
5. [Domain und HTTPS einrichten](#5-domain-und-https-einrichten)
6. [Auf eine neue Version aktualisieren](#6-auf-eine-neue-version-aktualisieren)
7. [Daten sichern und umziehen](#7-daten-sichern-und-umziehen)
8. [Fehlerbehebung](#8-fehlerbehebung)

## 1. Server besorgen

Jeder virtuelle Linux-Server ist geeignet. Open Social Listening ist genügsam: Die App und ihre SQLite-Datenbank
belegen einige hundert MB Arbeitsspeicher.

| | Minimum | Komfortabel |
| --- | --- | --- |
| CPU | 1 vCPU, x86-64 oder ARM64 | 1–2 vCPU |
| Arbeitsspeicher | 512 MB | 1 GB |
| Festplatte | 2 GB frei | 10 GB |
| System | Jedes Linux, auf dem Docker läuft | Ubuntu 24.04 oder Debian 12 |

Ein kleiner Tarif bei Hetzner, DigitalOcean, Vultr, Linode, AWS Lightsail, Alibaba Cloud oder Tencent Cloud reicht aus.
Der Server muss rund um die Uhr laufen, weil die App neue Erwähnungen nach einem Zeitplan sammelt.

Melden Sie sich als root an oder als Benutzer mit `sudo`:

```bash
ssh root@YOUR_SERVER_IP
```

## 2. Docker installieren

Das offizielle Installationsskript von Docker richtet Docker und das Compose-Plugin in einem Schritt ein:

```bash
curl -fsSL https://get.docker.com | sh
```

Prüfen Sie, ob beides funktioniert:

```bash
docker --version
docker compose version
```

`docker compose version` sollte v2.24 oder neuer ausgeben. Ist Docker bereits installiert und meldet eine ältere
Version, aktualisieren Sie es über den Paketmanager Ihres Systems.

## 3. Open Social Listening starten

Legen Sie einen Ordner für die App an und laden Sie ihre Compose-Datei herunter:

```bash
mkdir -p /opt/open-social-listening
cd /opt/open-social-listening
curl -fsSLO https://raw.githubusercontent.com/SocQAPI/open-social-listening/main/docker-compose.yml
```

Wählen Sie ein Passwort. Sonst könnte jeder, der den Server erreicht, Ihre Erwähnungen lesen und Ihre Einstellungen
ändern. Dieser Befehl erzeugt ein zufälliges Passwort und speichert es in einer Datei namens `.env`:

```bash
echo "OSL_PASSWORD=$(openssl rand -base64 18)" > .env
cat .env
```

Notieren Sie sich das Passwort. Starten Sie dann die App:

```bash
docker compose up -d
```

Docker lädt das Image herunter (etwa 150 MB) und startet die App im Hintergrund. Nach einem Absturz oder einem
Neustart des Servers startet sie von selbst wieder. Prüfen Sie, ob sie läuft:

```bash
docker compose ps
```

In der Spalte `STATUS` sollte `Up` stehen. Ihre Daten liegen in `/opt/open-social-listening/data`.

**Weitere Einstellungen** kommen in dieselbe `.env`-Datei, eine pro Zeile. Alle sind optional:

| Einstellung | Wirkung |
| --- | --- |
| `OSL_PASSWORD` | Passwort für alle Seiten und die API. Der Browser fragt zusätzlich nach einem Benutzernamen; geben Sie einen beliebigen ein. |
| `SOCQ_API_KEY` | Ihr SocQ-API-Schlüssel. Meist fügen Sie ihn stattdessen in der App ein (siehe [Erste Schritte](getting-started.de.md)). |
| `SMTP_URL`, `ALERT_FROM` | Nur für E-Mail-Benachrichtigungen, z. B. `SMTP_URL=smtp://user:password@smtp.example.com:587` und `ALERT_FROM=Alerts <alerts@example.com>`. Benachrichtigungen per Slack, Discord und Webhook brauchen hier nichts. |

Nachdem Sie `.env` bearbeitet haben, übernehmen Sie die Änderungen mit `docker compose up -d`.

## 4. Im Browser öffnen

Rufen Sie `http://YOUR_SERVER_IP:3000` auf. Der Browser fragt nach Benutzername und Passwort: Geben Sie einen
beliebigen Benutzernamen und das Passwort aus `.env` ein.

Sie sollten ein Demoprojekt mit Beispielerwähnungen sehen. Dann funktioniert alles. Weiter geht es mit
[Erste Schritte](getting-started.de.md): Dort verbinden Sie SocQ und legen Ihr eigenes Projekt an.

Lädt die Seite nicht, ist vermutlich die Firewall des Servers geschlossen. Geben Sie TCP-Port 3000 in der Firewall
oder Sicherheitsgruppe Ihres Cloud-Anbieters frei (und in `ufw`, falls Sie es verwenden). Nach Schritt 5 können Sie
den Port wieder schließen.

## 5. Domain und HTTPS einrichten

Ohne HTTPS geht Ihr Passwort unverschlüsselt über das Internet, daher wird dieser Schritt dringend empfohlen. Sie
benötigen eine Domain oder Subdomain, zum Beispiel `listening.example.com`. [Caddy](https://caddyserver.com) besorgt
das Zertifikat und erneuert es für Sie.

1. **Domain auf den Server zeigen lassen.** Legen Sie bei Ihrem DNS-Anbieter für `listening.example.com` einen
   `A`-Eintrag mit der IP-Adresse Ihres Servers an (und einen `AAAA`-Eintrag, falls der Server IPv6 hat). Warten Sie,
   bis `ping listening.example.com` die IP Ihres Servers anzeigt.

2. **Ports 80 und 443 öffnen**, und zwar in Ihrer Cloud-Firewall oder Sicherheitsgruppe. Caddy braucht beide, um das
   Zertifikat zu erhalten.

3. **Caddy Ihre Domain mitteilen.** Legen Sie in `/opt/open-social-listening` eine Datei namens `Caddyfile` an
   (ersetzen Sie die Domain durch Ihre eigene):

   ```bash
   cat > Caddyfile <<'EOF'
   listening.example.com {
   	reverse_proxy open-social-listening:3000
   }
   EOF
   ```

4. **Caddy neben der App einrichten.** Legen Sie `docker-compose.override.yml` an. Docker Compose liest diese Datei
   zusammen mit `docker-compose.yml` ein. So bleibt die heruntergeladene Datei unverändert, und Updates bleiben einfach:

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

5. **Beides starten:**

   ```bash
   docker compose up -d
   ```

Öffnen Sie `https://listening.example.com`. Der erste Aufruf kann einige Sekunden dauern, während Caddy das
Zertifikat abruft. Schlägt er fehl, verrät `docker compose logs caddy` den Grund; fast immer sind der DNS-Eintrag oder
die Ports 80 und 443 noch nicht bereit.

Jetzt können Sie Port 3000 in Ihrer Firewall schließen.

## 6. Auf eine neue Version aktualisieren

```bash
cd /opt/open-social-listening
docker compose pull
docker compose up -d
```

Ihre Projekte, Erwähnungen und Einstellungen bleiben in `data/` erhalten. Datenbankänderungen spielt ein Update beim
Start der App selbst ein. Um danach alte Image-Downloads aufzuräumen, führen Sie `docker image prune -f` aus.

**Bei einer Version bleiben.** `latest` folgt immer dem neuesten Release. Wenn Sie selbst bestimmen möchten, wann Sie
aktualisieren, ersetzen Sie `latest` in `docker-compose.yml` durch eine Versionsnummer von der
[Releases-Seite](https://github.com/SocQAPI/open-social-listening/releases), z. B.
`ghcr.io/socqapi/open-social-listening:0.1`.

## 7. Daten sichern und umziehen

Alles liegt im Ordner `data`: eine SQLite-Datenbank mit Ihren Projekten, Erwähnungen, Benachrichtigungskanälen und
dem API-Schlüssel. Halten Sie die App kurz an, damit die Kopie konsistent ist, und starten Sie sie danach wieder:

```bash
cd /opt/open-social-listening
mkdir -p backups
docker compose stop open-social-listening
tar czf "backups/osl-$(date +%F).tgz" data
docker compose start open-social-listening
```

Kopieren Sie die Datei aus `backups/` an einen Ort außerhalb des Servers, zum Beispiel mit `scp` auf Ihren Computer.
Für ein nächtliches Backup um 03:00 Uhr führen Sie `crontab -e` aus und fügen diese Zeile hinzu:

```cron
0 3 * * * cd /opt/open-social-listening && docker compose stop open-social-listening && tar czf "backups/osl-$(date +\%F).tgz" data && docker compose start open-social-listening
```

**Wiederherstellen oder auf einen neuen Server umziehen:** Installieren Sie Docker (Schritt 2), kopieren Sie den
gesamten Ordner `/opt/open-social-listening` (`docker-compose.yml`, `.env`, `data/` und, falls verwendet,
`Caddyfile` und `docker-compose.override.yml`) und führen Sie darin `docker compose up -d` aus. Zieht auch die Domain
um, aktualisieren Sie ihren DNS-Eintrag.

## 8. Fehlerbehebung

**Logs anzeigen.** Die meisten Probleme erklären sich hier von selbst:

```bash
cd /opt/open-social-listening
docker compose logs --tail 100 open-social-listening
```

| Problem | Lösung |
| --- | --- |
| Die Seite lädt unter `:3000` nicht | Öffnen Sie TCP 3000 in der Cloud-Firewall oder Sicherheitsgruppe. Prüfen Sie, ob `docker compose ps` `Up` anzeigt. |
| `port is already allocated` | Ein anderer Dienst belegt bereits Port 3000. Ändern Sie die linke Zahl in `docker-compose.yml`, z. B. `"8080:3000"`, und öffnen Sie stattdessen diesen Port. |
| HTTPS funktioniert nicht | Der `A`-Eintrag muss auf diesen Server zeigen, und die Ports 80 und 443 müssen offen sein. `docker compose logs caddy` zeigt den genauen Fehler. |
| `!override` wird nicht erkannt | Docker Compose ist älter als v2.24. Aktualisieren Sie Docker oder führen Sie das Installationsskript aus Schritt 2 erneut aus. |
| Der Browser fragt immer wieder nach dem Passwort | Das Passwort ist der Text nach `OSL_PASSWORD=` in `.env`, ohne Leerzeichen. Jeder Benutzername funktioniert. |
| E-Mail-Benachrichtigungen werden nicht versendet | Prüfen Sie `SMTP_URL` und `ALERT_FROM` in `.env`, führen Sie `docker compose up -d` aus und verwenden Sie dann **Test senden** in den Einstellungen der App. |
| Projekte sammeln nichts mehr | Ein pausiertes Projekt nennt den Grund oben auf seinen Seiten: Budget aufgebraucht, Credits erschöpft oder API-Schlüssel abgelehnt. Siehe [Erste Schritte](getting-started.de.md#kosten-im-griff-behalten). |

**Betrieb ohne Docker.** Docker ist der unterstützte Weg, die App auf einem Server zu betreiben. Für die Entwicklung
siehe das [README](../README.de.md#entwicklung).

Kommen Sie nicht weiter? [Eröffnen Sie ein Issue](https://github.com/SocQAPI/open-social-listening/issues) mit der
Ausgabe von `docker compose logs --tail 100`, aus der Sie Passwort und API-Schlüssel entfernt haben.
