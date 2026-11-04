# Localwomen

A lightweight web-based HTTP client, like a tiny Postman.

## Run

```bash
make up      # build and start → http://localhost:3366
make down    # stop
```

Without Docker: `make dev` (or `node server.js`) → http://localhost:3000

## Make commands

| Command        | Description                                      |
| -------------- | ------------------------------------------------ |
| `make help`    | Show available commands (default target)         |
| `make build`   | Build the Docker image                           |
| `make up`      | Build and start the container (http://localhost:3366) |
| `make down`    | Stop and remove the container                    |
| `make restart` | Rebuild and force-recreate the container         |
| `make logs`    | Follow container logs                            |
| `make ps`      | Show container status                            |
| `make clean`   | Stop the container and remove the local image    |
| `make dev`     | Run locally without Docker (http://localhost:3000) |

## Tip

The container uses host networking, so `http://localhost:<port>` reaches APIs running on your machine. This needs Linux, or Docker Desktop 4.34+ with host networking turned on.
