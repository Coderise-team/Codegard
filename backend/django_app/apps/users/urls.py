from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    AvatarUploadView,
    LoginView,
    LogoutView,
    MeView,
    RegisterView,
    UserActivityView,
    UserContestHistoryView,
    UserDetailView,
    UserDifficultyView,
    UserEloHistoryView,
    UserStatsView,
    UserStreakView,
    UserSubmissionsView,
    OAuthRedeemView,
    OAuthStartView,
    OAuthCallbackView,
)

app_name = "users"

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("avatar/", AvatarUploadView.as_view(), name="avatar-upload"),
    path("me/", MeView.as_view(), name="me"),
    path("<str:username>/activity/", UserActivityView.as_view(), name="user-activity"),
    path("<str:username>/stats/", UserStatsView.as_view(), name="user-stats"),
    path(
        "<str:username>/submissions/",
        UserSubmissionsView.as_view(),
        name="user-submissions",
    ),
    path(
        "<str:username>/elo-history/",
        UserEloHistoryView.as_view(),
        name="user-elo-history",
    ),
    path("<str:username>/streak/", UserStreakView.as_view(), name="user-streak"),
    path(
        "<str:username>/contest-history/",
        UserContestHistoryView.as_view(),
        name="user-contest-history",
    ),
    path(
        "<str:username>/difficulty/",
        UserDifficultyView.as_view(),
        name="user-difficulty",
    ),
    path("oauth/redeem/", OAuthRedeemView.as_view(), name="oauth-redeem"),
    path("oauth/<str:provider>/start/", OAuthStartView.as_view(), name="oauth-start"),
    path(
        "oauth/<str:provider>/callback/",
        OAuthCallbackView.as_view(),
        name="oauth-callback",
    ),
    # Keep the bare detail route LAST so it doesn't shadow the more specific ones.
    path("<str:username>/", UserDetailView.as_view(), name="user-detail"),
]
