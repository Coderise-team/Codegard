from unittest.mock import MagicMock

import docker.errors

from app.core.sandbox import SANDBOX_IMAGE
from app.sandbox_image import ensure_sandbox_image


def make_client(present: bool) -> MagicMock:
    client = MagicMock()
    if not present:
        client.images.get.side_effect = docker.errors.ImageNotFound(SANDBOX_IMAGE)
    return client


def test_present_image_is_not_pulled():
    """A restart while Docker Hub is unreachable must not stop the judge."""
    client = make_client(present=True)

    ensure_sandbox_image(client)

    client.images.pull.assert_not_called()


def test_missing_image_is_pulled():
    client = make_client(present=False)

    ensure_sandbox_image(client)

    client.images.pull.assert_called_once_with(SANDBOX_IMAGE)
