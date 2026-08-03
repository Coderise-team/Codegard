"""
Scoring logic for contests.

Formula:
  base_points = 100 per solved problem
  penalty     = 10 minutes per wrong attempt on each solved problem
                + minutes from contest start to AC time

  score       = sum of base_points across all solved problems
  leaderboard = sorted by score DESC, penalty ASC, last_ac_at ASC
"""

from django.db import transaction
from django.db.models import (
    Count,
    F,
    FilteredRelation,
    IntegerField,
    OuterRef,
    Q,
    Subquery,
    Value,
    Window,
)
from django.db.models.functions import Coalesce, DenseRank
from django.utils import timezone

from .cache import bust_leaderboard_cache
from .models import Contest, ContestScore

BASE_POINTS = 100
WRONG_ATTEMPT_PENALTY_MINUTES = 10


def calculate_score(user, contest: Contest) -> ContestScore:
    """
    Recalculate ContestScore for a user in a contest.
    Called after every new AC submission.

    Returns the updated ContestScore instance.
    """
    from apps.submissions.models import Submission

    submissions = Submission.objects.filter(user=user, contest=contest).order_by(
        "created_at"
    )

    total_score = 0
    total_penalty = 0
    solved_count = 0
    last_ac_at = None

    # Group by problem (remove ordering to keep DISTINCT stable)
    problem_ids = submissions.order_by().values_list("problem_id", flat=True).distinct()

    for problem_id in problem_ids:
        problem_subs = submissions.filter(problem_id=problem_id)

        # Check if this problem was solved (has AC)
        ac_submission = problem_subs.filter(verdict=Submission.Verdict.AC).first()
        if not ac_submission:
            continue  # Not solved — no points, no penalty

        # Count wrong attempts BEFORE the first AC
        wrong_attempts = problem_subs.filter(
            verdict__in=[
                Submission.Verdict.WA,
                Submission.Verdict.TLE,
                Submission.Verdict.MLE,
                Submission.Verdict.RE,
                Submission.Verdict.CE,
            ],
            created_at__lt=ac_submission.created_at,
        ).count()

        # Time penalty: minutes from contest start to AC
        time_penalty = int(
            (ac_submission.created_at - contest.start_time).total_seconds() / 60
        )

        # Penalty from wrong attempts
        attempt_penalty = wrong_attempts * WRONG_ATTEMPT_PENALTY_MINUTES

        total_score += BASE_POINTS
        total_penalty += time_penalty + attempt_penalty
        solved_count += 1

        if last_ac_at is None or ac_submission.created_at > last_ac_at:
            last_ac_at = ac_submission.created_at

    with transaction.atomic():
        contest_score, _ = ContestScore.objects.update_or_create(
            user=user,
            contest=contest,
            defaults={
                "score": total_score,
                "penalty": total_penalty,
                "solved_count": solved_count,
                "last_ac_at": last_ac_at,
            },
        )

    return contest_score


def get_scored_rows(contest: Contest):
    """ContestScore rows for a contest, in leaderboard order.

    This is the RATED set: a row only exists once a user has submitted, so
    registered-but-never-submitted no-shows are absent by construction — which
    is exactly who ELO must skip. Used by ``apply_contest_ratings``.
    """
    return (
        ContestScore.objects.filter(contest=contest)
        .select_related("user")
        .order_by("-score", "penalty", "last_ac_at", "id")
    )


# Leaderboard ranking key, shared by the dense-rank window and the single-user
# rank count. Deliberately WITHOUT `id`: ties must share a place.
_RANKING_KEY = [
    F("score").desc(),
    F("penalty").asc(),
    F("last_ac_at").asc(nulls_last=True),
]


def _participant_rows(contest: Contest):
    """Participants of a contest with their result annotations, unranked.

    Shared base for the leaderboard page and the single-user rank lookup. The
    score is pulled in via a filtered join and coalesced to 0 when the user has
    no ContestScore row yet (registered but never submitted).
    """
    return contest.participants.annotate(
        cs=FilteredRelation(
            "contest_scores",
            condition=Q(contest_scores__contest=contest),
        ),
    ).annotate(
        score=Coalesce("cs__score", Value(0)),
        penalty=Coalesce("cs__penalty", Value(0)),
        solved_count=Coalesce("cs__solved_count", Value(0)),
        last_ac_at=F("cs__last_ac_at"),
        rating_delta=F("cs__rating_delta"),
    )


def get_leaderboard(contest: Contest):
    """Every registered participant, with their result attached if they have one.

    Built from ``participants`` rather than ContestScore: a row in the latter
    only appears on the first AC, so someone who joined and solved nothing used
    to be missing from the table entirely. No rows are created here — the score
    is pulled in through a filtered join and coalesced to 0 when absent.

    Ordered by score DESC → penalty ASC → last_ac_at ASC (nulls last, so people
    with nothing solved sink to the bottom) → id, the last key only there to
    keep row order stable across paginated requests.

    ``rank`` is a DENSE rank over the same key WITHOUT ``id``: equal results
    share a place and the next one is +1 (1, 2, 2, 3). It is a window over the
    whole table, so the number is global rather than per-page.
    """
    return (
        _participant_rows(contest)
        .annotate(rank=Window(expression=DenseRank(), order_by=_RANKING_KEY))
        .order_by(
            "-score",
            "penalty",
            F("last_ac_at").asc(nulls_last=True),
            "id",
        )
    )


def get_participant_rank(contest: Contest, user_id: int) -> int | None:
    """Dense rank of one participant, or None if they aren't in the contest.

    The window from ``get_leaderboard`` can't be reused here: a ``WHERE`` on the
    user is applied BEFORE the window, so the rank would be computed over that
    single row and always come out 1. Instead we count, in the DB, how many
    DISTINCT better results exist — same dense semantics, constant query count.
    """
    rows = _participant_rows(contest)
    me = rows.filter(pk=user_id).values("score", "penalty", "last_ac_at").first()
    if me is None:
        return None

    better = Q(score__gt=me["score"]) | Q(score=me["score"], penalty__lt=me["penalty"])
    same_score_and_penalty = Q(score=me["score"], penalty=me["penalty"])
    if me["last_ac_at"] is not None:
        # Earlier last AC wins the tie (NULLs compare false, i.e. rank below me).
        better |= same_score_and_penalty & Q(last_ac_at__lt=me["last_ac_at"])
    else:
        # I have no AC at all: anyone who does is ahead of me on this key.
        better |= same_score_and_penalty & Q(last_ac_at__isnull=False)

    ahead = (
        rows.filter(better).values("score", "penalty", "last_ac_at").distinct().count()
    )
    return ahead + 1


def get_contest_history(user):
    """
    Annotated queryset of `user`'s finished contests, newest first, with `rank`.

    "Finished" is by time (`contest__end_time < now`), not the cached `status`.
    `rank` is computed in a single correlated subquery (no per-contest leaderboard
    query / no N+1): rank = 1 + how many ContestScores in the same contest rank
    strictly higher, using the exact leaderboard tie-break
    (score DESC, penalty ASC, last_ac_at ASC).

    Serialization is the view's job; this only prepares the queryset.
    """
    # Rows in the same contest that finish ABOVE this one (same tie-break as
    # get_leaderboard). NULL last_ac_at compares as "not less than" (NULL __lt x
    # is NULL → excluded), so a no-solve row never counts as higher on time.
    higher = (
        ContestScore.objects.filter(contest_id=OuterRef("contest_id"))
        .filter(
            Q(score__gt=OuterRef("score"))
            | Q(score=OuterRef("score"), penalty__lt=OuterRef("penalty"))
            | Q(
                score=OuterRef("score"),
                penalty=OuterRef("penalty"),
                last_ac_at__lt=OuterRef("last_ac_at"),
            )
        )
        .order_by()
        .values("contest_id")
        .annotate(c=Count("*"))
        .values("c")
    )

    # Total problems in the row's contest — a scalar Subquery mirroring `rank`
    # (NOT Count("contest__problems"), which is an aggregate and would force a
    # GROUP BY over the select_related columns and collide with the rank
    # subquery). .order_by() resets Contest's Meta ordering so start_time doesn't
    # leak into the subquery's GROUP BY.
    problems_count = (
        Contest.objects.filter(pk=OuterRef("contest_id"))
        .order_by()
        .annotate(c=Count("problems"))
        .values("c")
    )

    return (
        ContestScore.objects.filter(user=user, contest__end_time__lt=timezone.now())
        .select_related("contest")
        .annotate(
            rank=Coalesce(Subquery(higher, output_field=IntegerField()), Value(0)) + 1,
            problems_count=Coalesce(
                Subquery(problems_count, output_field=IntegerField()), Value(0)
            ),
        )
        # `-id` tiebreak: contests can share an end_time, and the DB doesn't
        # guarantee row order for equal sort keys — without it, pagination
        # pages would reshuffle (duplicates / gaps at page boundaries).
        .order_by("-contest__end_time", "-id")
    )


def apply_contest_ratings(contest: Contest) -> int:
    """
    Award ELO for one finished contest. Returns the number of participants updated.

    Idempotent: locks the Contest row and re-checks `rating_applied`, so two
    overlapping beat runs never double-count. Everything is one transaction, so
    a mid-flight crash rolls back and the contest is retried next run.

    Rating set = everyone who made >=1 submission. Those who solved nothing get
    score=0 / last place and a freshly created ContestScore. Pure no-shows
    (joined but never submitted) are not rated.
    """
    from apps.submissions.models import Submission
    from apps.users.models import EloHistory, User
    from apps.users.services import EloParticipant, compute_elo_deltas

    with transaction.atomic():
        # 1. Lock the contest and re-check the flag (the task's filter is not enough).
        contest = Contest.objects.select_for_update().get(pk=contest.pk)
        if contest.rating_applied:
            return 0

        # 2. Build the set: everyone who submitted at least once.
        submitter_ids = set(
            Submission.objects.filter(contest=contest)
            .values_list("user_id", flat=True)
            .distinct()
        )
        # get_scored_rows, NOT get_leaderboard: the latter now includes every
        # registered participant, and pure no-shows must stay unrated.
        scored = list(get_scored_rows(contest))  # ContestScore rows, in place order
        scored_uids = {cs.user_id for cs in scored}
        # Submitted but solved nothing → last place, no ContestScore yet.
        zero_ids = [uid for uid in submitter_ids if uid not in scored_uids]
        ordered_uids = [cs.user_id for cs in scored] + zero_ids

        # 3. Degenerate field (0 or 1 rated) — no opponents, just mark done.
        if len(ordered_uids) < 2:
            contest.rating_applied = True
            contest.save(update_fields=["rating_applied"])
            transaction.on_commit(lambda: bust_leaderboard_cache(contest.pk))
            return 0

        # 4. Lock users (stable order, anti-deadlock) and snapshot ratings BEFORE.
        users = {
            u.id: u
            for u in User.objects.select_for_update()
            .filter(id__in=ordered_uids)
            .order_by("id")
        }
        snapshot = {uid: users[uid].elo_rating for uid in ordered_uids}

        # 5. Ordered-by-place participants → pure ELO (deltas off the snapshot).
        participants = [
            EloParticipant(
                user_id=cs.user_id,
                rating=snapshot[cs.user_id],
                place_key=(cs.score, cs.penalty, cs.last_ac_at),
            )
            for cs in scored
        ] + [
            EloParticipant(user_id=uid, rating=snapshot[uid], place_key=(0, 0, None))
            for uid in zero_ids
        ]
        deltas = compute_elo_deltas(participants)

        # 6. Apply (one save per row — fields chosen so the avatar signal skips).
        scored_by_uid = {cs.user_id: cs for cs in scored}
        for uid in ordered_uids:
            user = users[uid]
            new_rating = snapshot[uid] + deltas[uid]
            user.elo_rating = new_rating
            user.max_rating = max(user.max_rating, new_rating)
            user.save(update_fields=["elo_rating", "max_rating"])

            cs = scored_by_uid.get(uid)
            if cs is not None:
                cs.rating_delta = deltas[uid]
                cs.rating_after = new_rating
                cs.save(update_fields=["rating_delta", "rating_after"])
            else:
                ContestScore.objects.create(
                    user=user,
                    contest=contest,
                    score=0,
                    penalty=0,
                    solved_count=0,
                    last_ac_at=None,
                    rating_delta=deltas[uid],
                    rating_after=new_rating,
                )
            EloHistory.objects.create(user=user, rating=new_rating)

        # 7. Mark done in the same transaction.
        contest.rating_applied = True
        contest.save(update_fields=["rating_applied"])
        # Every row just grew a rating_delta — the cached pages are all wrong.
        transaction.on_commit(lambda: bust_leaderboard_cache(contest.pk))

    return len(ordered_uids)
