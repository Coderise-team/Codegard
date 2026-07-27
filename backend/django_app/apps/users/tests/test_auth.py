import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


# api_client comes from conftest.


@pytest.fixture
def user_data():
    """Default payload for user registration tests."""

    return {
        "username": "testuser",
        "email": "test@mail.com",
        "password": "testpass123",
    }


@pytest.mark.django_db
def test_register_success(api_client, user_data):
    response = api_client.post("/api/users/register/", user_data, format="json")
    assert response.status_code == 201
    assert "access" in response.data
    assert "refresh" in response.data


@pytest.mark.django_db
def test_register_weak_password(api_client, user_data):
    user_data["password"] = "123"

    response = api_client.post(
        "/api/users/register/",
        user_data,
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_register_duplicate_email(api_client, user_data):
    api_client.post("/api/users/register/", user_data, format="json")
    response = api_client.post("/api/users/register/", user_data, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_login_success(api_client, user_data):
    api_client.post("/api/users/register/", user_data, format="json")
    response = api_client.post(
        "/api/users/login/",
        {"username": "testuser", "password": "testpass123"},
        format="json",
    )
    assert response.status_code == 200
    assert "access" in response.data


@pytest.mark.django_db
def test_register_duplicate_username(api_client, user_data):
    api_client.post("/api/users/register/", user_data, format="json")
    user_data["email"] = "other@mail.com"
    response = api_client.post("/api/users/register/", user_data, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_register_invalid_email(api_client, user_data):
    user_data["email"] = "notanemail"
    response = api_client.post("/api/users/register/", user_data, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_login_wrong_password(api_client, user_data):
    api_client.post("/api/users/register/", user_data, format="json")
    response = api_client.post(
        "/api/users/login/",
        {"username": "testuser", "password": "wrongpassword"},
        format="json",
    )
    assert response.status_code == 401


@pytest.mark.django_db
def test_login_nonexistent_user(api_client):
    response = api_client.post(
        "/api/users/login/",
        {"username": "nobody", "password": "testpass123"},
        format="json",
    )
    assert response.status_code == 401


@pytest.mark.django_db
def test_login_error_is_generic_and_identical(api_client, user_data):
    """A wrong password and an unknown user return the same generic message.

    Distinct wording would reveal whether an account exists, letting an
    attacker enumerate valid usernames/emails.
    """
    api_client.post("/api/users/register/", user_data, format="json")

    wrong_password = api_client.post(
        "/api/users/login/",
        {"username": "testuser", "password": "wrongpassword"},
        format="json",
    )
    unknown_user = api_client.post(
        "/api/users/login/",
        {"username": "nobody", "password": "wrongpassword"},
        format="json",
    )

    assert wrong_password.data["detail"] == "Incorrect username or password."
    assert wrong_password.data["detail"] == unknown_user.data["detail"]


@pytest.mark.django_db
def test_register_missing_fields(api_client):
    response = api_client.post("/api/users/register/", {}, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_token_refresh(api_client, user_data):
    api_client.post("/api/users/register/", user_data, format="json")
    login = api_client.post(
        "/api/users/login/",
        {"username": "testuser", "password": "testpass123"},
        format="json",
    )
    refresh = login.data["refresh"]
    response = api_client.post(
        "/api/users/token/refresh/",
        {"refresh": refresh},
        format="json",
    )
    assert response.status_code == 200
    assert "access" in response.data


@pytest.mark.django_db
def test_token_refresh_invalid(api_client):
    response = api_client.post(
        "/api/users/token/refresh/",
        {"refresh": "wrong_refresh"},
        format="json",
    )
    assert response.status_code == 401


@pytest.mark.django_db
def test_logout_success(api_client, user_data):
    api_client.post("/api/users/register/", user_data, format="json")

    login = api_client.post(
        "/api/users/login/",
        {"username": "testuser", "password": "testpass123"},
        format="json",
    )

    refresh = login.data["refresh"]
    access = login.data["access"]

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = api_client.post(
        "/api/users/logout/",
        {"refresh": refresh},
        format="json",
    )

    assert response.status_code == 205


@pytest.mark.django_db
def test_logout_invalid_token(api_client, user_data):
    api_client.post("/api/users/register/", user_data, format="json")
    login = api_client.post(
        "/api/users/login/",
        {"username": "testuser", "password": "testpass123"},
        format="json",
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    response = api_client.post(
        "/api/users/logout/",
        {"refresh": "wrong_refresh"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_logout_without_token(api_client, user_data):
    api_client.post("/api/users/register/", user_data, format="json")
    login = api_client.post(
        "/api/users/login/",
        {"username": "testuser", "password": "testpass123"},
        format="json",
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    response = api_client.post(
        "/api/users/logout/",
        {},
        format="json",
    )
    assert response.status_code == 400
