from django.apps import AppConfig


class ProblemsConfig(AppConfig):
    name = "apps.problems"

    def ready(self) -> None:
        from . import signals  # noqa: F401  (announces problems entering the catalog)
