from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"tasks", views.TaskLogViewSet, basename="tasks")
router.register(r"media", views.UploadedMediaViewSet, basename="media")

urlpatterns = [
    path("", include(router.urls)),
    path("dashboard/stats/", views.dashboard_stats, name="dashboard-stats"),
    path("security/headers/", views.security_headers, name="security-headers"),
    path("security/rate-limit-test/", views.rate_limit_test, name="rate-limit-test"),
    path("security/xss-test/", views.xss_test, name="xss-test"),
    path("system/metrics/", views.system_metrics, name="system-metrics"),
    path("auth/", include("rest_framework.urls")),
]
