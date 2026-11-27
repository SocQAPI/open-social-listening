# Panduan deployment

[English](deploy.md) · [简体中文](deploy.zh-CN.md) · [日本語](deploy.ja.md) · [Deutsch](deploy.de.md) · **Bahasa Indonesia**

Panduan ini membawa Anda dari server Linux yang masih kosong hingga Open Social Listening berjalan di domain Anda
sendiri dengan HTTPS, kata sandi, pembaruan, dan backup. Waktunya sekitar 15 menit. Anda cukup menyalin perintah;
tidak perlu bisa memprogram.

Setelah aplikasi berjalan, lanjutkan ke [Memulai](getting-started.id.md) untuk menyiapkan proyek pertama Anda.

**Ingin melihat-lihat dulu?** [Demo langsung](https://socqapi.github.io/open-social-listening/) berjalan di browser
Anda dengan data contoh. Untuk mencobanya di komputer Anda sendiri, pasang [Docker Desktop](https://www.docker.com/products/docker-desktop/)
lalu jalankan langkah 3 dan 4 di bawah; alamatnya menjadi http://localhost:3000.

## Daftar isi

1. [Siapkan server](#1-siapkan-server)
2. [Pasang Docker](#2-pasang-docker)
3. [Jalankan Open Social Listening](#3-jalankan-open-social-listening)
4. [Buka di browser](#4-buka-di-browser)
5. [Tambahkan domain dan HTTPS](#5-tambahkan-domain-dan-https)
6. [Perbarui ke versi baru](#6-perbarui-ke-versi-baru)
7. [Backup dan pindahkan data Anda](#7-backup-dan-pindahkan-data-anda)
8. [Pemecahan masalah](#8-pemecahan-masalah)

## 1. Siapkan server

Server virtual Linux apa pun bisa dipakai. Open Social Listening ringan: aplikasi beserta database SQLite-nya hanya
memakai beberapa ratus MB memori.

| | Minimum | Nyaman |
| --- | --- | --- |
| CPU | 1 vCPU, x86-64 atau ARM64 | 1–2 vCPU |
| Memori | 512 MB | 1 GB |
| Disk | 2 GB kosong | 10 GB |
| Sistem | Linux apa pun yang bisa menjalankan Docker | Ubuntu 24.04 atau Debian 12 |

Paket kecil di Hetzner, DigitalOcean, Vultr, Linode, AWS Lightsail, Alibaba Cloud, atau Tencent Cloud sudah cukup.
Server harus menyala sepanjang waktu, karena aplikasi mengumpulkan mention baru sesuai jadwal.

Login sebagai root, atau sebagai pengguna yang punya akses `sudo`:

```bash
ssh root@YOUR_SERVER_IP
```

## 2. Pasang Docker

Skrip instalasi resmi Docker memasang Docker beserta plugin Compose dalam satu langkah:

```bash
curl -fsSL https://get.docker.com | sh
```

Periksa apakah keduanya berfungsi:

```bash
docker --version
docker compose version
```

`docker compose version` seharusnya menampilkan v2.24 atau yang lebih baru. Jika Docker sudah terpasang dan
versinya lebih lama, perbarui lewat package manager sistem Anda.

## 3. Jalankan Open Social Listening

Buat folder untuk aplikasi, lalu unduh file compose-nya:

```bash
mkdir -p /opt/open-social-listening
cd /opt/open-social-listening
curl -fsSLO https://raw.githubusercontent.com/SocQAPI/open-social-listening/main/docker-compose.yml
```

Tentukan kata sandi. Tanpa kata sandi, siapa pun yang bisa mengakses server dapat membaca mention Anda dan mengubah
pengaturan Anda. Perintah ini membuat kata sandi acak dan menyimpannya di file bernama `.env`:

```bash
echo "OSL_PASSWORD=$(openssl rand -base64 18)" > .env
cat .env
```

Catat kata sandinya. Lalu jalankan aplikasi:

```bash
docker compose up -d
```

Docker mengunduh image (sekitar 150 MB) dan menjalankannya di latar belakang. Aplikasi akan menyala lagi dengan
sendirinya setelah crash atau setelah server di-reboot. Periksa apakah aplikasi sudah berjalan:

```bash
docker compose ps
```

Kolom `STATUS` seharusnya menunjukkan `Up`. Data Anda disimpan di `/opt/open-social-listening/data`.

**Pengaturan lain** dimasukkan ke file `.env` yang sama, satu per baris. Semuanya opsional:

| Pengaturan | Fungsi |
| --- | --- |
| `OSL_PASSWORD` | Kata sandi untuk setiap halaman dan API. Browser juga meminta nama pengguna; ketik apa saja. |
| `SOCQ_API_KEY` | API key SocQ Anda. Biasanya Anda cukup menempelkannya di aplikasi (lihat [Memulai](getting-started.id.md)). |
| `SMTP_URL`, `ALERT_FROM` | Hanya untuk peringatan lewat email, misalnya `SMTP_URL=smtp://user:password@smtp.example.com:587` dan `ALERT_FROM=Alerts <alerts@example.com>`. Peringatan Slack, Discord, dan webhook tidak memerlukan apa pun di sini. |

Setelah mengedit `.env`, terapkan perubahannya dengan `docker compose up -d`.

## 4. Buka di browser

Buka `http://YOUR_SERVER_IP:3000`. Browser akan meminta nama pengguna dan kata sandi: ketik nama pengguna apa saja
dan kata sandi dari `.env`.

Anda akan melihat proyek demo berisi contoh mention. Artinya semuanya berfungsi. Lanjutkan ke
[Memulai](getting-started.id.md) untuk menghubungkan SocQ dan membuat proyek Anda sendiri.

Jika halaman tidak terbuka, kemungkinan besar firewall server masih tertutup. Izinkan port TCP 3000 di firewall atau
security group penyedia cloud Anda (dan di `ufw`, jika Anda memakainya). Anda bisa menutupnya lagi setelah langkah 5.

## 5. Tambahkan domain dan HTTPS

Tanpa HTTPS, kata sandi Anda dikirim lewat internet tanpa enkripsi, jadi langkah ini sangat disarankan. Anda
memerlukan domain atau subdomain, misalnya `listening.example.com`. [Caddy](https://caddyserver.com) akan
mengambil dan memperbarui sertifikatnya untuk Anda.

1. **Arahkan domain ke server.** Di penyedia DNS Anda, tambahkan record `A` untuk `listening.example.com` dengan
   alamat IP server Anda (dan record `AAAA` jika server punya IPv6). Tunggu hingga `ping listening.example.com`
   menampilkan IP server Anda.

2. **Buka port 80 dan 443** di firewall cloud atau security group Anda. Caddy membutuhkan keduanya untuk
   mendapatkan sertifikat.

3. **Beri tahu Caddy domain Anda.** Di `/opt/open-social-listening`, buat file bernama `Caddyfile` (ganti domainnya
   dengan domain Anda):

   ```bash
   cat > Caddyfile <<'EOF'
   listening.example.com {
   	reverse_proxy open-social-listening:3000
   }
   EOF
   ```

4. **Tambahkan Caddy di samping aplikasi.** Buat `docker-compose.override.yml`. Docker Compose membacanya bersama
   `docker-compose.yml`, sehingga file yang Anda unduh tetap utuh dan pembaruan tetap sederhana:

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

5. **Jalankan keduanya:**

   ```bash
   docker compose up -d
   ```

Buka `https://listening.example.com`. Kunjungan pertama bisa memakan waktu beberapa detik selagi Caddy mengambil
sertifikat. Jika gagal, `docker compose logs caddy` akan menunjukkan penyebabnya; hampir selalu karena record DNS
atau port 80 dan 443 belum siap.

Sekarang Anda bisa menutup port 3000 di firewall.

## 6. Perbarui ke versi baru

```bash
cd /opt/open-social-listening
docker compose pull
docker compose up -d
```

Proyek, mention, dan pengaturan Anda tetap tersimpan di `data/`. Pembaruan menerapkan perubahan database secara
otomatis saat aplikasi dijalankan. Untuk membersihkan unduhan image lama setelahnya, jalankan `docker image prune -f`.

**Tetap di satu versi.** `latest` selalu mengikuti rilis terbaru. Agar Anda sendiri yang menentukan kapan
memperbarui, ganti `latest` di `docker-compose.yml` dengan nomor versi dari [halaman rilis](https://github.com/SocQAPI/open-social-listening/releases),
misalnya `ghcr.io/socqapi/open-social-listening:0.1`.

## 7. Backup dan pindahkan data Anda

Semuanya ada di folder `data`: satu database SQLite yang berisi proyek, mention, saluran peringatan, dan API key
Anda. Hentikan aplikasi sebentar agar salinannya konsisten, lalu jalankan lagi:

```bash
cd /opt/open-social-listening
mkdir -p backups
docker compose stop open-social-listening
tar czf "backups/osl-$(date +%F).tgz" data
docker compose start open-social-listening
```

Salin file di `backups/` ke tempat lain di luar server, misalnya dengan `scp` ke komputer Anda. Untuk backup setiap
malam pukul 03:00, jalankan `crontab -e` lalu tambahkan baris ini:

```cron
0 3 * * * cd /opt/open-social-listening && docker compose stop open-social-listening && tar czf "backups/osl-$(date +\%F).tgz" data && docker compose start open-social-listening
```

**Memulihkan data atau pindah ke server baru:** pasang Docker (langkah 2), salin seluruh folder
`/opt/open-social-listening` (`docker-compose.yml`, `.env`, `data/`, serta `Caddyfile` dan
`docker-compose.override.yml` jika Anda memakainya), lalu jalankan `docker compose up -d` di dalamnya. Jika domain
ikut pindah, perbarui juga record DNS-nya.

## 8. Pemecahan masalah

**Tampilkan log.** Sebagian besar masalah sudah terjelaskan di sini:

```bash
cd /opt/open-social-listening
docker compose logs --tail 100 open-social-listening
```

| Masalah | Yang perlu dilakukan |
| --- | --- |
| Halaman tidak terbuka di `:3000` | Buka TCP 3000 di firewall cloud atau security group. Pastikan `docker compose ps` menunjukkan `Up`. |
| `port is already allocated` | Ada program lain yang memakai port 3000. Ubah angka di sebelah kiri di `docker-compose.yml`, misalnya `"8080:3000"`, lalu buka port tersebut sebagai gantinya. |
| HTTPS tidak berfungsi | Record `A` harus mengarah ke server ini, dan port 80 serta 443 harus terbuka. `docker compose logs caddy` menampilkan pesan error yang persis. |
| `!override` tidak dikenali | Versi Docker Compose lebih lama dari v2.24. Perbarui Docker, atau jalankan ulang skrip instalasi dari langkah 2. |
| Browser terus meminta kata sandi | Kata sandinya adalah teks setelah `OSL_PASSWORD=` di `.env`, tanpa spasi. Nama pengguna apa pun bisa dipakai. |
| Peringatan email tidak terkirim | Periksa `SMTP_URL` dan `ALERT_FROM` di `.env`, jalankan `docker compose up -d`, lalu gunakan **Kirim uji** di pengaturan aplikasi. |
| Proyek berhenti mengumpulkan mention | Proyek yang dijeda menampilkan alasannya di bagian atas halamannya: anggaran sudah terpakai, kredit habis, atau API key ditolak. Lihat [Memulai](getting-started.id.md#kendalikan-biaya). |

**Menjalankan tanpa Docker.** Docker adalah cara yang didukung untuk menjalankan aplikasi di server. Untuk
pengembangan, lihat [README](../README.id.md#pengembangan).

Masih buntu? [Buka issue](https://github.com/SocQAPI/open-social-listening/issues) dengan menyertakan output
`docker compose logs --tail 100`, setelah kata sandi dan API key Anda dihapus.
