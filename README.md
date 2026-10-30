# Sample app

Exercises everything stackdeploy does, from one repo: a web app built by Railpack, a worker built from a Dockerfile, a cron job, Postgres, Redis, reference variables, private networking and a pre-deploy migration.

Push this folder's contents to a GitHub repo that the StackGen GitHub App is installed on, then create these services in one environment and deploy them all at once.

| Service | Kind | Source | Settings |
|---|---|---|---|
| `postgres` | Postgres | catalog default | |
| `redis` | Redis | catalog default | |
| `worker` | worker | GitHub, folder `worker` | port `8081` |
| `cleanup` | cron | GitHub, folder `worker` | start command `./worker --cleanup`, schedule `*/5 * * * *` |
| `web` | web | GitHub, folder `web` (no Dockerfile, so Railpack builds it) | port `3000`, health check `/healthz`, pre-deploy `node migrate.js` |

Variables:

| Service | Variable | Value |
|---|---|---|
| `web` | `DATABASE_URL` | `${{postgres.DATABASE_URL}}` |
| `web` | `REDIS_URL` | `${{redis.REDIS_URL}}` |
| `web` | `WORKER_URL` | `http://${{worker.PRIVATE_HOST}}:${{worker.PORT}}` |
| `worker`, `cleanup` | `DATABASE_URL` | `${{postgres.DATABASE_URL}}` |

Then click "Generate hostname" on `web`. The page shows a visit counter (Redis), an "Enqueue job" button and the job list (Postgres), and the worker's health (private networking). Enqueued jobs turn `done` within a few seconds; the cron job deletes done jobs older than an hour.
