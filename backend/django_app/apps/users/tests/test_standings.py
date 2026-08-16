"""Tests for the global ELO standings endpoint (GET /api/users/standings/)."""

import pytest
from apps.contests.models import ContestScore
from django.contrib.auth import get_user_model
from django.urls import reverse
from factories import make_contest
from rest_framework.test import APIClient

from .helpers import _auth, _user

User = get_user_model()

URL = "users:standings"


def _finished_contest(title, hours_ago):
    return make_contest(title, starts_in=-(hours_ago + 2), ends_in=-hours_ago)


# --- dense rank ------------------------------------------------------------


@pytest.mark.django_db
def test_dense_rank_no_gap():
    users = [_user("a", 1500), _user("b", 1400), _user("c", 1400), _user("d", 1300)]
    rows = _auth(users[0]).get(reverse(URL)).json()["results"]
    by_elo = {r["elo_rating"]: r["globalRank"] for r in rows}
    assert by_elo == {1500: 1, 1400: 2, 1300: 3}  # dense: 1,2,2,3 — not 1,2,2,4


@pytest.mark.django_db
def test_rank_is_global_under_tier_filter():
    top = _user("top", 2000)  # Grandmaster
    _user("e1", 1700)  # Expert
    _user("e2", 1650)  # Expert
    resp = _auth(top).get(reverse(URL), {"tier": "Expert"}).json()
    # only experts shown, but the strongest expert keeps his GLOBAL rank (2),
    # not 1 — the 2000 above him still counts.
    assert [r["elo_rating"] for r in resp["results"]] == [1700, 1650]
    assert resp["results"][0]["globalRank"] == 2


@pytest.mark.django_db
def test_rank_is_global_across_pages():
    viewer = _user("v", 5000)
    for i in range(24):
        _user(f"u{i:02d}", 1000 + i)  # 24 distinct ratings below the viewer
    page2 = _auth(viewer).get(reverse(URL), {"page": 2}).json()["results"]
    # 25 distinct ratings total; page 1 holds 20, so the first row of page 2
    # is rank 21 by the formula — not "1".
    assert page2[0]["globalRank"] == 21


@pytest.mark.django_db
def test_user_count_is_not_last_place():
    # 6 users, only 4 distinct ratings -> weakest place is 4, not 6.
    ratings = [1500, 1400, 1400, 1300, 1300, 1200]
    users = [_user(f"u{i}", r) for i, r in enumerate(ratings)]
    rows = _auth(users[0]).get(reverse(URL)).json()["results"]
    assert min(r["globalRank"] for r in rows) == 1
    assert max(r["globalRank"] for r in rows) == 4


@pytest.mark.django_db
def test_id_does_not_affect_rank():
    _user("top", 1500)
    later = _user("later", 1400)
    _user("earlier", 1400)  # created after `later`, same rating
    rows = _auth(later).get(reverse(URL)).json()["results"]
    ranks = {r["username"]: r["globalRank"] for r in rows}
    assert ranks["later"] == ranks["earlier"] == 2


# --- sorting ---------------------------------------------------------------


@pytest.mark.django_db
def test_default_sort_elo_desc():
    users = [_user("a", 1300), _user("b", 1500), _user("c", 1400)]
    rows = _auth(users[0]).get(reverse(URL)).json()["results"]
    assert [r["elo_rating"] for r in rows] == [1500, 1400, 1300]


@pytest.mark.django_db
def test_sort_by_max_rating_reranks():
    m = _user("m", 1500, max_rating=1500)
    _user("n", 1400, max_rating=1600)  # lower ELO, higher peak
    resp = _auth(m).get(reverse(URL), {"ordering": "-max_rating"}).json()
    assert resp["results"][0]["username"] == "n"
    assert resp["results"][0]["globalRank"] == 1  # ranked by max_rating now
    assert resp["results"][1]["globalRank"] == 2


@pytest.mark.django_db
def test_ascending_keeps_rank_numbers():
    users = [_user("a", 1500), _user("b", 1400), _user("c", 1300)]
    rows = (
        _auth(users[0]).get(reverse(URL), {"ordering": "elo_rating"}).json()["results"]
    )
    # rows reversed (weakest first) but rank 1 still belongs to the strongest.
    assert rows[0]["elo_rating"] == 1300 and rows[0]["globalRank"] == 3
    assert rows[-1]["elo_rating"] == 1500 and rows[-1]["globalRank"] == 1


@pytest.mark.django_db
def test_garbage_ordering_falls_back():
    users = [_user("a", 1300), _user("b", 1500)]
    rows = _auth(users[0]).get(reverse(URL), {"ordering": "lol"}).json()["results"]
    assert [r["elo_rating"] for r in rows] == [1500, 1300]  # default -elo_rating


@pytest.mark.django_db
def test_tier_ordering_not_supported_falls_back():
    users = [_user("a", 1300), _user("b", 1500)]
    rows = _auth(users[0]).get(reverse(URL), {"ordering": "tier"}).json()["results"]
    assert [r["elo_rating"] for r in rows] == [1500, 1300]


@pytest.mark.django_db
def test_pagination_stable_with_equal_ratings():
    users = [_user(f"u{i:02d}", 1400) for i in range(25)]
    api = _auth(users[0])
    p1 = api.get(reverse(URL)).json()["results"]
    p2 = api.get(reverse(URL), {"page": 2}).json()["results"]
    names = [r["username"] for r in p1] + [r["username"] for r in p2]
    assert len(names) == 25 and len(set(names)) == 25  # no dupes / gaps


# --- tier filter -----------------------------------------------------------


@pytest.mark.django_db
def test_tier_range_boundaries():
    _user("below", 1599)  # Specialist
    _user("floor", 1600)  # Expert (floor inclusive)
    _user("top", 1799)  # Expert
    _user("nextfloor", 1800)  # Master (next floor exclusive)
    resp = (
        _auth(User.objects.get(username="floor"))
        .get(reverse(URL), {"tier": "Expert"})
        .json()
    )
    assert {r["elo_rating"] for r in resp["results"]} == {1600, 1799}


@pytest.mark.django_db
def test_top_tier_has_no_ceiling():
    _user("k1", 2400)
    _user("k2", 3000)
    resp = (
        _auth(User.objects.get(username="k1"))
        .get(reverse(URL), {"tier": "Kernel"})
        .json()
    )
    assert {r["elo_rating"] for r in resp["results"]} == {2400, 3000}


@pytest.mark.django_db
def test_unknown_tier_ignored():
    users = [_user("a", 1500), _user("b", 1300)]
    resp = _auth(users[0]).get(reverse(URL), {"tier": "Blah"}).json()
    assert len(resp["results"]) == 2  # filter ignored, full list


@pytest.mark.django_db
def test_count_filtered_total_not():
    _user("e", 1700)  # Expert
    _user("j", 1200)  # Junior
    viewer = _user("v", 1500)
    resp = _auth(viewer).get(reverse(URL), {"tier": "Expert"}).json()
    assert resp["count"] == 1  # only the expert
    assert resp["total"] == 3  # all active users, filter ignored


# --- delta -----------------------------------------------------------------


@pytest.mark.django_db
def test_delta_null_without_contests():
    u = _user("a", 1500)
    rows = _auth(u).get(reverse(URL)).json()["results"]
    assert rows[0]["delta"] is None


@pytest.mark.django_db
def test_delta_is_latest_rated_contest():
    u = _user("a", 1500)
    old = _finished_contest("Old", hours_ago=10)
    new = _finished_contest("New", hours_ago=1)
    ContestScore.objects.create(user=u, contest=old, rating_delta=+10)
    ContestScore.objects.create(user=u, contest=new, rating_delta=-7)
    rows = _auth(u).get(reverse(URL)).json()["results"]
    assert rows[0]["delta"] == -7  # newest end_time


@pytest.mark.django_db
def test_delta_skips_unrated_live_contest():
    u = _user("a", 1500)
    rated = _finished_contest("Rated", hours_ago=10)
    ContestScore.objects.create(user=u, contest=rated, rating_delta=+15)
    live = make_contest("Live")
    ContestScore.objects.create(user=u, contest=live, rating_delta=None)
    rows = _auth(u).get(reverse(URL)).json()["results"]
    assert rows[0]["delta"] == 15  # live NULL skipped, old rated one used


@pytest.mark.django_db
def test_standings_no_n_plus_one(django_assert_max_num_queries):
    viewer = _user("v", 3000)
    for i in range(10):
        u = _user(f"u{i}", 1000 + i * 10)
        c = _finished_contest(f"C{i}", hours_ago=i + 1)
        ContestScore.objects.create(user=u, contest=c, rating_delta=i)
    # Constant query count regardless of row count (no per-row rank/delta query).
    with django_assert_max_num_queries(8):
        _auth(viewer).get(reverse(URL))


# --- you + total -----------------------------------------------------------


@pytest.mark.django_db
def test_you_present_even_when_filtered_out():
    viewer = _user("gm", 2000)  # Grandmaster
    _user("j", 1200)  # Junior
    resp = _auth(viewer).get(reverse(URL), {"tier": "Junior"}).json()
    assert all(r["username"] != "gm" for r in resp["results"])  # filtered out
    assert resp["you"]["username"] == "gm"  # still present


@pytest.mark.django_db
def test_you_rank_matches_results():
    viewer = _user("v", 1400)
    _user("top", 1500)
    resp = _auth(viewer).get(reverse(URL)).json()
    in_results = next(r for r in resp["results"] if r["username"] == "v")
    assert resp["you"]["globalRank"] == in_results["globalRank"] == 2


@pytest.mark.django_db
def test_you_rank_by_max_rating():
    viewer = _user("v", 1400, max_rating=1600)
    _user("other", 1500, max_rating=1500)
    resp = _auth(viewer).get(reverse(URL), {"ordering": "-max_rating"}).json()
    assert resp["you"]["globalRank"] == 1  # highest peak


@pytest.mark.django_db
def test_total_excludes_inactive_and_ignores_page():
    active = [_user(f"a{i}", 1200 + i) for i in range(3)]
    _user("banned", 1500, is_active=False)
    resp = _auth(active[0]).get(reverse(URL)).json()
    assert resp["total"] == 3  # banned not counted


# --- avatar + misc ---------------------------------------------------------


@pytest.mark.django_db
def test_avatar_absolute_or_null():
    with_av = _user("withav", 1500)
    # The API serves the thumbnail, so that's the field a row's avatar reads.
    with_av.avatar_thumb = "avatars/thumbs/abc.webp"
    with_av.save()
    _user("noav", 1400)
    rows = _auth(with_av).get(reverse(URL)).json()["results"]
    by_name = {r["username"]: r["avatar"] for r in rows}
    assert by_name["withav"].startswith("http")  # absolute URL
    assert "thumbs" in by_name["withav"]  # thumbnail, not the master
    assert by_name["noav"] is None


@pytest.mark.django_db
def test_inactive_user_absent():
    active = _user("a", 1500)
    _user("banned", 1600, is_active=False)
    rows = _auth(active).get(reverse(URL)).json()["results"]
    assert [r["username"] for r in rows] == ["a"]


@pytest.mark.django_db
def test_anonymous_rejected():
    assert APIClient().get(reverse(URL)).status_code in (401, 403)
