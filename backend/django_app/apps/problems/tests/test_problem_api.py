from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework import status

from django_app.factories import make_problem, make_submission


@pytest.mark.django_db
class TestSubmissionCreate:
    def test_acceptance_rate(self, api_client, user):
        problem = make_problem()

        make_submission(user, problem, verdict="AC")
        make_submission(user, problem, verdict="WA")
        make_submission(user, problem, verdict=None)

        response = api_client.get(reverse("problems-list"))

        problem_data = None
        for item in response.data["results"]:
            if item["id"] == problem.id:
                problem_data = item

        assert problem_data is not None
        assert problem_data["acceptance"] == 50

    @patch("apps.submissions.views.push_to_judge_queue", return_value=True)
    def test_duplicate_submission(self, mock_queue, user_client, problem):
        url = reverse("submissions-list")
        code = 12345

        data = {"problem": problem.pk, "code": code, "language": "python"}
        first_response = user_client.post(url, data, format="json")
        second_response = user_client.post(url, data, format="json")

        assert first_response.status_code == status.HTTP_201_CREATED
        assert second_response.status_code == status.HTTP_400_BAD_REQUEST
