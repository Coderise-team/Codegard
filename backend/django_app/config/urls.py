from apps.problems.views import ProblemReportViewSet, ReportReasonsView
from apps.realtime.views import WSTicketView
from apps.submissions.views import LanguagesView
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

# Staff-only report queue. Separate router/prefix — NOT nested under
# /api/problems/, whose router uses an empty prefix and would swallow
# /api/problems/reports/ as "problem id=reports".
reports_router = DefaultRouter()
reports_router.register("", ProblemReportViewSet, basename="reports")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/users/", include("apps.users.urls")),
    path("api/problems/", include("apps.problems.urls")),
    path("api/contests/", include("apps.contests.urls")),
    path("api/submissions/", include("apps.submissions.urls")),
    path("api/languages/", LanguagesView.as_view(), name="languages"),
    path("api/report-reasons/", ReportReasonsView.as_view(), name="report-reasons"),
    path("api/reports/", include(reports_router.urls)),
    path("api/ws-ticket/", WSTicketView.as_view(), name="ws-ticket"),
]

# Serve user-uploaded media locally in DEBUG. In prod R2 is mandatory and its
# URLs point straight at the bucket, so Django never serves /media/ there.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Register the Django Debug Toolbar URLs only when it's actually enabled (dev),
# so the `djdt` namespace resolves and HTML pages don't 500 with NoReverseMatch.
if settings.DEBUG and "debug_toolbar" in settings.INSTALLED_APPS:
    urlpatterns += [path("__debug__/", include("debug_toolbar.urls"))]
