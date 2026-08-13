"""Makes sure the sandbox image is on the host before the judge starts.

Runs from the container entrypoint. Pulling on every start used to mean that a
restart without Docker Hub — no network, an outage, a pull rate limit — left the
judge crash-looping even though the image had been sitting on the host all
along. So: pull only what is missing, and only then insist on it.
"""

import logging
import sys

import docker
import docker.errors

from app.core.sandbox import SANDBOX_IMAGE

logger = logging.getLogger(__name__)


def ensure_sandbox_image(client: docker.DockerClient) -> None:
    try:
        client.images.get(SANDBOX_IMAGE)
    except docker.errors.ImageNotFound:
        logger.info("Pulling %s, this happens once per host", SANDBOX_IMAGE)
        client.images.pull(SANDBOX_IMAGE)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    try:
        ensure_sandbox_image(docker.from_env())
    except docker.errors.DockerException:
        logger.exception("Cannot get %s — nothing can be judged", SANDBOX_IMAGE)
        return 1
    logger.info("%s is ready", SANDBOX_IMAGE)
    return 0


if __name__ == "__main__":
    sys.exit(main())
