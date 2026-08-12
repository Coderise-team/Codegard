from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.app_factory import create_app


def _client(*finished):
    """A judge whose background tasks have finished exactly as told."""
    app = create_app()
    app.router.lifespan_context = None
    tasks = []
    for done in finished:
        task = MagicMock()
        task.done.return_value = done
        tasks.append(task)
    app.state.tasks = tuple(tasks)
    return TestClient(app, raise_server_exceptions=False)


def test_health_ok_while_both_tasks_run():
    response = _client(False, False).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_down_when_judging_stopped():
    assert _client(True, False).get("/health").status_code == 503


def test_health_down_when_upkeep_stopped():
    """Without upkeep this worker stops saying it is alive, and the others
    start taking submissions out from under it."""
    assert _client(False, True).get("/health").status_code == 503


def test_health_down_before_anything_started():
    app = create_app()
    app.router.lifespan_context = None
    client = TestClient(app, raise_server_exceptions=False)

    assert client.get("/health").status_code == 503
