"""Caching for the contest leaderboard page.

The leaderboard is the hottest read on the platform: every participant polls it
after every ``leaderboard_update`` signal, and each request runs a window
function over all participants. So the whole paginated response envelope is
cached — not the queryset, the finished JSON — and thrown away the moment the
standings actually change.

Invalidation uses a *generation key* rather than deleting entries. Our cache
backend is ``RedisCache``, which has no ``delete_pattern``: with a page size of
10 and a page_size query param there is no bounded set of keys to delete. So the
key embeds a per-contest counter, and bumping the counter orphans every page at
once; the old entries expire on their own TTL.

The TTL itself is insurance, not the invalidation strategy. Correctness comes
from :func:`bust_leaderboard_cache`, and every writer of contest standings must
call it *before* signalling the socket — otherwise a client refetches on the
signal and gets served the stale page it was told to replace.
"""

from django.core.cache import cache

# Short enough that a missed bust self-heals in seconds, long enough to absorb
# the thundering herd of one signal fanning out to every open contest page.
LEADERBOARD_TTL = 10


def _generation_key(contest_id: int) -> str:
    return f"contest:{contest_id}:lb:gen"


def get_generation(contest_id: int) -> int:
    """Current generation counter for a contest, seeding it at 0 if unset."""
    key = _generation_key(contest_id)
    generation = cache.get(key)
    if generation is None:
        generation = 0
        cache.set(key, generation, None)
    return generation


def leaderboard_page_key(contest_id: int, page: str, page_size: str) -> str:
    """Cache key for one rendered leaderboard page.

    The only place leaderboard keys are built. Page and page_size come straight
    from the query string, so they are stringly typed on purpose: "2" and 2 must
    not produce two different cache entries for the same page.
    """
    generation = get_generation(contest_id)
    return f"contest:{contest_id}:lb:g{generation}:p{page}:s{page_size}"


def bust_leaderboard_cache(contest_id: int) -> None:
    """Orphan every cached page for this contest by bumping its generation.

    ``cache.incr`` raises ValueError when the key is missing (evicted, or a
    fresh Redis), which is not an error condition here — it just means there is
    nothing cached to invalidate yet, so we seed the counter instead.
    """
    key = _generation_key(contest_id)
    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, 1, None)
