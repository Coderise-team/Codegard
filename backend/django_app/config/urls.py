from apps.submissions.views import LanguagesView
from django.conf import settings
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/users/", include("apps.users.urls")),
    path("api/problems/", include("apps.problems.urls")),
    path("api/contests/", include("apps.contests.urls")),
    path("api/submissions/", include("apps.submissions.urls")),
    path("api/languages/", LanguagesView.as_view(), name="languages"),
]

# Register the Django Debug Toolbar URLs only when it's actually enabled (dev),
# so the `djdt` namespace resolves and HTML pages don't 500 with NoReverseMatch.
if settings.DEBUG and "debug_toolbar" in settings.INSTALLED_APPS:
    urlpatterns += [path("__debug__/", include("debug_toolbar.urls"))]
