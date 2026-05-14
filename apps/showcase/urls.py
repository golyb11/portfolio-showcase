from django.urls import path
from . import views

app_name = "showcase"

urlpatterns = [
    path("login/", views.login_view, name="login"),
    path("", views.index, name="index"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("data-grid/", views.data_grid, name="data_grid"),
    path("realtime/", views.realtime, name="realtime"),
    path("media/", views.media_upload, name="media_upload"),
    path("security/", views.security, name="security"),
]
