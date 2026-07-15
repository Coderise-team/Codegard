import io

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_avatar_upload_stores_image_and_generates_thumbnails(settings, tmp_path):
    settings.STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
            "OPTIONS": {"location": tmp_path / "media"},
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    }
    settings.THUMBNAIL_PREFIX = "thumbnails/"

    User = get_user_model()
    user = User.objects.create_user(username="u1", email="u1@test.com", password="pass")

    image_bytes = io.BytesIO()
    Image.new("RGB", (400, 400), color=(255, 0, 0)).save(image_bytes, format="PNG")
    image_bytes.seek(0)

    client = APIClient()
    client.force_authenticate(user=user)

    response = client.post(
        "/api/users/avatar/",
        data={
            "avatar": SimpleUploadedFile(
                "avatar.png", image_bytes.read(), content_type="image/png"
            )
        },
        format="multipart",
    )

    assert response.status_code == 200
    assert response.data["avatar"]
    assert response.data["thumbnails"]["128"]
    assert response.data["thumbnails"]["256"]
