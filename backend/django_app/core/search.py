"""Shared trigram-search constants.

The per-entity similarity thresholds live next to their filters (they differ:
titles 0.35, usernames 0.3), but the minimum query length is a universal
property of trigrams — three letters — so it lives here once.
"""

# Queries shorter than this fall back to prefix (istartswith) search: a one- or
# two-letter query has no full trigram, so similarity is meaningless.
MIN_TRIGRAM_LENGTH = 3
