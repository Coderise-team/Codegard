DEV := docker compose -f docker-compose.dev.yml
PROD := docker compose -f docker-compose.prod.yml
DEV_TEST := $(DEV) --profile test

.PHONY: help dev dev-build build down restart logs ps shell migrate makemigrations superuser \
        test-backend test-judge test-schemas test-frontend build-test-backend build-test-judge build-test-frontend \
        prod-up prod-up-build prod-down prod-restart prod-logs prod-ps

help:
	@echo "Dev:"
	@echo "  make dev                  Start dev containers"
	@echo "  make dev-build            Start dev containers with image build"
	@echo "  make build                Build dev images"
	@echo "  make down                 Stop and remove dev containers"
	@echo "  make restart              Restart dev containers"
	@echo "  make logs                 Show dev logs (follow)"
	@echo "  make ps                   Show running dev services"
	@echo "  make shell                Open shell in backend container"
	@echo ""
	@echo "Prod:"
	@echo "  make prod-up              Start prod containers"
	@echo "  make prod-up-build        Start prod containers with image build"
	@echo "  make prod-down            Stop and remove prod containers"
	@echo "  make prod-restart         Restart prod containers"
	@echo "  make prod-logs            Show prod logs (follow)"
	@echo "  make prod-ps              Show running prod services"
	@echo ""
	@echo "Django:"
	@echo "  make migrate              Apply migrations"
	@echo "  make makemigrations       Create migrations"
	@echo "  make superuser            Create Django superuser"
	@echo ""
	@echo "Tests:"
	@echo "  make test-backend         Run backend tests"
	@echo "  make test-judge           Run judge tests"
	@echo "  make test-schemas         Run shared schema tests"
	@echo "  make test-frontend        Run frontend tests"
	@echo "  make build-test-backend   Rebuild backend test image"
	@echo "  make build-test-judge     Rebuild judge test image"
	@echo "  make build-test-frontend  Rebuild frontend test image"

dev:
	$(DEV) up

dev-build:
	$(DEV) up --build

build:
	$(DEV) build

down:
	$(DEV) down

restart: down dev

logs:
	$(DEV) logs -f

ps:
	$(DEV) ps

shell:
	$(DEV) exec backend sh

migrate:
	$(DEV) run --rm backend python django_app/manage.py migrate

makemigrations:
	$(DEV) run --rm backend python django_app/manage.py makemigrations

superuser:
	$(DEV) run --rm backend python django_app/manage.py createsuperuser

test-backend:
	$(DEV_TEST) run --rm backend-test

test-judge:
	$(DEV_TEST) run --rm judge-test

test-schemas:
	$(DEV_TEST) run --rm judge-test pytest /shared/tests/ -v

test-frontend:
	$(DEV_TEST) run --rm frontend-test

build-test-backend:
	$(DEV_TEST) build backend-test

build-test-judge:
	$(DEV_TEST) build judge-test

build-test-frontend:
	$(DEV_TEST) build frontend-test

prod-up:
	$(PROD) up

prod-up-build:
	$(PROD) up --build

prod-down:
	$(PROD) down

prod-restart: prod-down prod-up

prod-logs:
	$(PROD) logs -f

prod-ps:
	$(PROD) ps
