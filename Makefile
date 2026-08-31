DEV := docker compose -f docker-compose.dev.yml
PROD := docker compose -f docker-compose.prod.yml
DEV_TEST := $(DEV) --profile test

.DEFAULT_GOAL := help

# Naming: <env>-<action>. A bare env starts it, -build only builds, -build-up
# does both. The help below is generated from the ## comments, so it cannot
# drift away from the targets themselves.
help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} \
		/^##@/ { printf "\n%s\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_-]+:.*?## / { printf "  %-22s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Dev
dev: ## Start the dev stack
	$(DEV) up

dev-build: ## Build the dev images
	$(DEV) build

dev-build-up: ## Build the dev images, then start
	$(DEV) up --build

dev-down: ## Stop and remove the dev containers
	$(DEV) down

dev-restart: ## Restart the running dev containers
	$(DEV) restart

dev-logs: ## Follow the dev logs
	$(DEV) logs -f

dev-ps: ## Show the dev services
	$(DEV) ps

dev-shell: ## Open a shell in the dev backend
	$(DEV) exec backend sh

dev-migrate: ## Apply migrations (they also run on every start)
	$(DEV) run --rm migrate

dev-makemigrations: ## Create new migrations
	$(DEV) run --rm backend python django_app/manage.py makemigrations

dev-superuser: ## Create a Django superuser in dev
	$(DEV) run --rm backend python django_app/manage.py createsuperuser

##@ Prod
prod: ## Start the prod stack in the background
	$(PROD) up -d

prod-build: ## Build the prod images without touching what is running
	$(PROD) build

prod-build-up: ## Build the prod images, then start in the background
	$(PROD) up -d --build

prod-down: ## Stop and remove the prod containers
	$(PROD) down

prod-restart: ## Restart the running prod containers
	$(PROD) restart

prod-logs: ## Follow the prod logs
	$(PROD) logs -f

prod-ps: ## Show the prod services
	$(PROD) ps

prod-superuser: ## Create a Django superuser in prod
	$(PROD) run --rm backend python django_app/manage.py createsuperuser

##@ Tests
# Each one rebuilds its image first: the frontend image carries the code inside
# it, so without a rebuild the suite passes against the previous build.
test: test-backend test-judge test-schemas test-frontend ## Run every suite

test-backend: build-test-backend ## Run the backend suite
	$(DEV_TEST) run --rm backend-test

check-migrations: ## Check the migration graph and that models match migrations
	$(DEV_TEST) run --rm backend-test python django_app/manage.py makemigrations --check --dry-run

test-judge: build-test-judge ## Run the judge suite
	$(DEV_TEST) run --rm judge-test

test-schemas: build-test-judge ## Run the shared schema suite
	$(DEV_TEST) run --rm judge-test pytest /shared/tests/ -v

test-frontend: build-test-frontend ## Run the frontend suite
	$(DEV_TEST) run --rm frontend-test

build-test-backend: ## Rebuild the backend test image
	$(DEV_TEST) build backend-test

build-test-judge: ## Rebuild the judge test image
	$(DEV_TEST) build judge-test

build-test-frontend: ## Rebuild the frontend test image
	$(DEV_TEST) build frontend-test

##@ Lint
# Host tools, not containers: linters need to see the same files the editor
# does, and rebuilding an image to check formatting is a waste.
lint: ## Run every linter and formatting check
	cd backend && ruff check . && ruff format --check .
	cd judge && ruff check . && ruff format --check .
	cd frontend && npm run lint && npx prettier --check .

format: ## Reformat everything in place
	cd backend && ruff format .
	cd judge && ruff format .
	cd frontend && npx prettier --write .

.PHONY: help \
        dev dev-build dev-build-up dev-down dev-restart dev-logs dev-ps dev-shell \
        dev-migrate dev-makemigrations dev-superuser \
        prod prod-build prod-build-up prod-down prod-restart prod-logs prod-ps prod-superuser \
        test test-backend test-judge test-schemas test-frontend check-migrations \
        build-test-backend build-test-judge build-test-frontend \
        lint format
