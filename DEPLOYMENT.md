# Ubuntu Docker Deployment

This deployment runs only the Flask web container. MySQL stays on the Ubuntu
server or another database server and is never created, restarted, or joined to
the existing project's Docker network.

## Server Setup

1. Clone the repository into `/opt/qiuzhao/app`.
2. Copy `.env.example` to `.env` and fill in every blank value.
3. Set `MYSQL_HOST` to the existing MySQL server's private IP or DNS name.
4. If MySQL runs directly on the Ubuntu host, use `host.docker.internal` only
   after allowing the Docker bridge network in MySQL's bind-address and grants.
5. Do not use `localhost` for `MYSQL_HOST`: from the web container it points
   back to that container, not to Ubuntu.

## Build And Migrate

```bash
cd /opt/qiuzhao/app
docker compose -p qiuzhao build web
docker compose -p qiuzhao run --rm web flask --app app db upgrade
docker compose -p qiuzhao up -d web
docker compose -p qiuzhao ps
```

The migration command creates a temporary web container. The only long-running
container created by this project is `qiuzhao-web`.

## Nginx Entry

Configure host Nginx to listen on public port `8081` and proxy requests to
`http://127.0.0.1:5001`. Keep the proxy location at `/` so Flask continues to
serve Jinja pages and `/static/...` resources at their original paths.

## Safe Updates

```bash
cd /opt/qiuzhao/app
git pull --ff-only
docker compose -p qiuzhao build web
docker compose -p qiuzhao run --rm web flask --app app db upgrade
docker compose -p qiuzhao up -d web
```

Never run Docker Compose commands from the old project's directory. Do not use
`docker system prune` or `docker compose down -v` for this deployment.
