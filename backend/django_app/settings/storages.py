"""
Cloudflare R2 storage configuration via django-storages (S3-compatible).

This module is imported from settings/base.py to optionally override STORAGES.
"""

import environ
from django.core.exceptions import ImproperlyConfigured

env = environ.Env()

R2_ACCOUNT_ID = env("R2_ACCOUNT_ID", default="")
R2_ACCESS_KEY_ID = env("R2_ACCESS_KEY_ID", default="")
R2_SECRET_ACCESS_KEY = env("R2_SECRET_ACCESS_KEY", default="")
R2_BUCKET_NAME = env("R2_BUCKET_NAME", default="")
R2_CUSTOM_DOMAIN = env("R2_CUSTOM_DOMAIN", default="")

R2_ENABLED = all(
    [R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME]
)

if R2_ENABLED:
    # Avatars are public content served straight from R2. We never sign URLs,
    # so a public domain is mandatory — without it the unsigned links 404.
    # Fail loudly at startup rather than quietly serving broken images.
    if not R2_CUSTOM_DOMAIN:
        raise ImproperlyConfigured(
            "R2 is enabled but R2_CUSTOM_DOMAIN is not set. Public (unsigned) "
            "URLs need a public bucket domain — configure R2 public access and "
            "set R2_CUSTOM_DOMAIN."
        )

    storage_options = {
        "access_key": R2_ACCESS_KEY_ID,
        "secret_key": R2_SECRET_ACCESS_KEY,
        "bucket_name": R2_BUCKET_NAME,
        "endpoint_url": f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        "region_name": "auto",
        "signature_version": "s3v4",
        "default_acl": None,
        "file_overwrite": False,
        "location": "media",
        # Public content — never sign, so browsers and the CDN can cache it.
        "querystring_auth": False,
        "custom_domain": R2_CUSTOM_DOMAIN,
    }

    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": storage_options,
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }
else:
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    }
