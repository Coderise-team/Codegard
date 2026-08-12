import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.config import worker_identity
from app.redis_client import create_redis
from app.worker import (
    announce,
    maintenance_loop,
    recover_orphans,
    withdraw,
    worker_loop,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    redis = create_redis()
    # Announced before anything else: until this worker has said it is alive,
    # a sibling sweeping at the same moment would count it among the dead.
    await announce(redis)
    await recover_orphans(redis)
    tasks = (
        asyncio.create_task(worker_loop(redis)),
        asyncio.create_task(maintenance_loop(redis)),
    )
    app.state.tasks = tasks
    logger.info("Judge worker %s started", worker_identity())
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        for task in tasks:
            try:
                await task
            except asyncio.CancelledError:
                pass
        await withdraw(redis)
        await redis.aclose()
        logger.info("Judge worker %s stopped", worker_identity())


def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan)

    @app.get("/health")
    def health():
        # The upkeep task counts as much as the judging one: without it this
        # worker stops saying it is alive and the others start taking its work.
        tasks = getattr(app.state, "tasks", ())
        if not tasks or any(task.done() for task in tasks):
            return JSONResponse(status_code=503, content={"status": "down"})
        return {"status": "ok"}

    return app
