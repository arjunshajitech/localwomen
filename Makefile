.DEFAULT_GOAL := help
.PHONY: help build up down restart logs ps clean dev

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  make %-8s %s\n", $$1, $$2}'

build: ## Build the Docker image
	docker compose build

up: ## Build and start (http://localhost:3366)
	docker compose up -d --build
	@echo "Localwomen running at http://localhost:3366"

down: ## Stop and remove the container
	docker compose down

restart: ## Rebuild and restart
	docker compose up -d --build --force-recreate

logs: ## Follow container logs
	docker compose logs -f

ps: ## Show container status
	docker compose ps

clean: ## Stop the container and remove the image
	docker compose down --rmi local

dev: ## Run locally without Docker (http://localhost:3000)
	node server.js
