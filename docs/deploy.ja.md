# デプロイガイド

[English](deploy.md) · [简体中文](deploy.zh-CN.md) · **日本語** · [Deutsch](deploy.de.md) · [Bahasa Indonesia](deploy.id.md)

このガイドでは、まっさらなLinuxサーバーから始めて、独自ドメインとHTTPS、パスワード、アップデート、バックアップを備えたOpen Social Listeningを動かすところまでを説明します。所要時間は15分ほどです。コマンドをコピーして実行するだけなので、プログラミングの知識は必要ありません。

アプリが動き始めたら、「[はじめに](getting-started.ja.md)」に進んで最初のプロジェクトを設定してください。

**まずは中身を見てみたい場合**は、[ライブデモ](https://socqapi.github.io/open-social-listening/)をお使いください。サンプルデータを使ってブラウザ上で動きます。自分のパソコンで試すには、[Docker Desktop](https://www.docker.com/products/docker-desktop/)をインストールし、下記の手順3と4を実行してください。アドレスは<http://localhost:3000>になります。

## 目次

1. [サーバーを用意する](#1-サーバーを用意する)
2. [Dockerをインストールする](#2-dockerをインストールする)
3. [Open Social Listeningを起動する](#3-open-social-listeningを起動する)
4. [ブラウザで開く](#4-ブラウザで開く)
5. [ドメインとHTTPSを設定する](#5-ドメインとhttpsを設定する)
6. [新しいバージョンに更新する](#6-新しいバージョンに更新する)
7. [データのバックアップと移行](#7-データのバックアップと移行)
8. [トラブルシューティング](#8-トラブルシューティング)

## 1. サーバーを用意する

Linuxの仮想サーバーであれば何でも使えます。Open Social Listeningは軽量で、アプリとSQLiteデータベースを合わせてもメモリ使用量は数百MB程度です。

| | 最小構成 | 余裕のある構成 |
| --- | --- | --- |
| CPU | 1 vCPU（x86-64またはARM64） | 1〜2 vCPU |
| メモリ | 512 MB | 1 GB |
| ディスク | 空き容量2 GB | 10 GB |
| OS | Dockerが動くLinuxなら何でも可 | Ubuntu 24.04またはDebian 12 |

Hetzner、DigitalOcean、Vultr、Linode、AWS Lightsail、Alibaba Cloud、Tencent Cloudなどの小さなプランで十分です。アプリは新しいメンションをスケジュールに沿って収集するため、サーバーは24時間稼働させておく必要があります。

rootで、または`sudo`を使えるユーザーでログインします。

```bash
ssh root@YOUR_SERVER_IP
```

## 2. Dockerをインストールする

Docker公式のインストールスクリプトを使うと、DockerとComposeプラグインを一度にセットアップできます。

```bash
curl -fsSL https://get.docker.com | sh
```

両方が動作することを確認します。

```bash
docker --version
docker compose version
```

`docker compose version`の出力がv2.24以降であれば問題ありません。Dockerがすでにインストールされていて、これより古いバージョンが表示された場合は、システムのパッケージマネージャーで更新してください。

## 3. Open Social Listeningを起動する

アプリ用のフォルダーを作成し、composeファイルをダウンロードします。

```bash
mkdir -p /opt/open-social-listening
cd /opt/open-social-listening
curl -fsSLO https://raw.githubusercontent.com/SocQAPI/open-social-listening/main/docker-compose.yml
```

パスワードを決めます。パスワードがないと、サーバーにアクセスできる人なら誰でもメンションを閲覧したり、設定を変更したりできてしまいます。次のコマンドはランダムなパスワードを生成し、`.env`というファイルに保存します。

```bash
echo "OSL_PASSWORD=$(openssl rand -base64 18)" > .env
cat .env
```

パスワードを控えておいてください。続いてアプリを起動します。

```bash
docker compose up -d
```

Dockerがイメージ（約150 MB）をダウンロードし、バックグラウンドで起動します。クラッシュしたときやサーバーを再起動したときも、アプリは自動で再起動します。動いていることを確認しましょう。

```bash
docker compose ps
```

`STATUS`列に`Up`と表示されていれば正常です。データは`/opt/open-social-listening/data`に保存されます。

**その他の設定**も同じ`.env`ファイルに1行に1つずつ書きます。いずれも省略できます。

| 設定 | 内容 |
| --- | --- |
| `OSL_PASSWORD` | すべてのページとAPIで使うパスワードです。ブラウザからはユーザー名も求められますが、何を入力してもかまいません。 |
| `SOCQ_API_KEY` | SocQのAPIキーです。通常はここではなく、アプリ上で貼り付けます（「[はじめに](getting-started.ja.md)」を参照）。 |
| `SMTP_URL`、`ALERT_FROM` | メールアラートを使う場合にのみ必要です。例：`SMTP_URL=smtp://user:password@smtp.example.com:587`、`ALERT_FROM=Alerts <alerts@example.com>`。Slack、Discord、Webhookのアラートでは、ここに何も設定する必要はありません。 |

`.env`を編集したら、`docker compose up -d`で反映します。

## 4. ブラウザで開く

`http://YOUR_SERVER_IP:3000`にアクセスします。ブラウザでユーザー名とパスワードを求められたら、ユーザー名には任意の文字列を、パスワードには`.env`に書かれたものを入力します。

サンプルのメンションが入ったデモプロジェクトが表示されれば、すべて正常に動いています。「[はじめに](getting-started.ja.md)」に進み、SocQを接続して自分のプロジェクトを作成しましょう。

ページが開かない場合は、おそらくサーバーのファイアウォールが閉じています。クラウドプロバイダーのファイアウォールまたはセキュリティグループで（`ufw`を使っている場合はそちらでも）TCPポート3000を許可してください。手順5を終えたら、再び閉じてかまいません。

## 5. ドメインとHTTPSを設定する

HTTPSを使わないと、パスワードが暗号化されないままインターネット上を流れます。そのため、この手順は強くおすすめします。`listening.example.com`のようなドメインまたはサブドメインが必要です。証明書の取得と更新は[Caddy](https://caddyserver.com)が自動で行います。

1. **ドメインをサーバーに向けます**。DNSプロバイダーで`listening.example.com`の`A`レコードを追加し、サーバーのIPアドレスを設定します（サーバーにIPv6がある場合は`AAAA`レコードも追加します）。`ping listening.example.com`でサーバーのIPが表示されるまで待ちます。

2. **ポート80と443を開放します**。クラウドのファイアウォールまたはセキュリティグループで設定してください。Caddyが証明書を取得するには、両方のポートが必要です。

3. **Caddyにドメインを指定します**。`/opt/open-social-listening`に`Caddyfile`というファイルを作成します（ドメインはご自身のものに置き換えてください）。

   ```bash
   cat > Caddyfile <<'EOF'
   listening.example.com {
   	reverse_proxy open-social-listening:3000
   }
   EOF
   ```

4. **アプリと並べてCaddyを追加します**。`docker-compose.override.yml`を作成します。Docker Composeはこのファイルを`docker-compose.yml`と合わせて読み込むので、ダウンロードしたファイルには手を加えずに済み、更新も簡単なままです。

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

5. **両方を起動します**。

   ```bash
   docker compose up -d
   ```

`https://listening.example.com`を開きます。初回のアクセスでは、Caddyが証明書を取得するあいだ数秒かかることがあります。うまくいかない場合は、`docker compose logs caddy`で原因を確認できます。ほとんどの場合、DNSレコードまたはポート80と443の準備がまだ整っていないことが原因です。

これで、ファイアウォールのポート3000は閉じてかまいません。

## 6. 新しいバージョンに更新する

```bash
cd /opt/open-social-listening
docker compose pull
docker compose up -d
```

プロジェクト、メンション、設定は`data/`にそのまま残ります。データベースの変更は、更新後にアプリが起動するときに自動で適用されます。古いイメージのダウンロード分を削除するには、更新後に`docker image prune -f`を実行してください。

**バージョンを固定する**。`latest`は常に最新のリリースを指します。更新するタイミングを自分で決めたい場合は、`docker-compose.yml`の`latest`を[リリースページ](https://github.com/SocQAPI/open-social-listening/releases)に載っているバージョン番号に置き換えてください（例：`ghcr.io/socqapi/open-social-listening:0.1`）。

## 7. データのバックアップと移行

データはすべて`data`フォルダーにあります。中身は、プロジェクト、メンション、アラートの送信先、APIキーを収めた1つのSQLiteデータベースです。整合性のとれたコピーを取るためにアプリを一時的に停止し、コピーが終わったら再び起動します。

```bash
cd /opt/open-social-listening
mkdir -p backups
docker compose stop open-social-listening
tar czf "backups/osl-$(date +%F).tgz" data
docker compose start open-social-listening
```

`backups/`内のファイルは、`scp`で自分のパソコンにコピーするなどして、サーバーの外に保管してください。毎晩03:00にバックアップするには、`crontab -e`を実行して次の行を追加します。

```cron
0 3 * * * cd /opt/open-social-listening && docker compose stop open-social-listening && tar czf "backups/osl-$(date +\%F).tgz" data && docker compose start open-social-listening
```

**復元または新しいサーバーへの移行**。Dockerをインストールし（手順2）、`/opt/open-social-listening`フォルダー全体（`docker-compose.yml`、`.env`、`data/`、使っている場合は`Caddyfile`と`docker-compose.override.yml`も）をコピーしてから、そのフォルダーで`docker compose up -d`を実行します。ドメインも移す場合は、DNSレコードを更新してください。

## 8. トラブルシューティング

**ログを確認する**。たいていの問題は、ログを見れば原因がわかります。

```bash
cd /opt/open-social-listening
docker compose logs --tail 100 open-social-listening
```

| 問題 | 対処 |
| --- | --- |
| `:3000`でページが開かない | クラウドのファイアウォールまたはセキュリティグループで、TCP 3000を開放します。`docker compose ps`に`Up`と表示されているかも確認してください。 |
| `port is already allocated` | ポート3000がほかのプログラムに使われています。`docker-compose.yml`の左側の番号を`"8080:3000"`のように変更し、代わりにそのポートを開放します。 |
| HTTPSが動かない | `A`レコードがこのサーバーを指していて、ポート80と443が開いている必要があります。正確なエラーは`docker compose logs caddy`で確認できます。 |
| `!override`が認識されない | Docker Composeがv2.24より古いバージョンです。Dockerを更新するか、手順2のインストールスクリプトをもう一度実行してください。 |
| ブラウザが何度もパスワードを求める | パスワードは`.env`の`OSL_PASSWORD=`に続く文字列で、スペースは含みません。ユーザー名は何でもかまいません。 |
| メールアラートが送信されない | `.env`の`SMTP_URL`と`ALERT_FROM`を確認して`docker compose up -d`を実行し、アプリの設定画面で**テスト送信**を使って確かめます。 |
| プロジェクトの収集が止まった | 一時停止中のプロジェクトでは、各ページの上部に理由が表示されます。予算の使い切り、クレジット切れ、APIキーの拒否のいずれかです。「[はじめに](getting-started.ja.md#費用を抑える)」を参照してください。 |

**Dockerを使わずに動かす**。サーバーでアプリを動かす方法として公式にサポートしているのはDockerです。開発については[README](../README.ja.md#開発)を参照してください。

それでも解決しない場合は、`docker compose logs --tail 100`の出力からパスワードとAPIキーを削除したうえで、[issueを作成](https://github.com/SocQAPI/open-social-listening/issues)してください。
