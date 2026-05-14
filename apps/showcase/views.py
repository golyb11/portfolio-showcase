import json
from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect


from django.views.decorators.cache import never_cache


@never_cache
@ensure_csrf_cookie
def login_view(request):
    if request.user.is_authenticated:
        return redirect("showcase:dashboard")
    return render(request, "showcase/login.html")


@csrf_protect
@require_POST
def api_login(request):
    try:
        data = json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return JsonResponse(
            {"status": "error", "message": "Invalid JSON body"}, status=400
        )

    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    if not email or not password:
        return JsonResponse(
            {"status": "error", "message": "Email and password are required"},
            status=400,
        )

    from apps.core.models import User

    if not User.objects.filter(email__iexact=email).exists():
        return JsonResponse(
            {"status": "error", "message": "Invalid credentials"}, status=401
        )

    user = authenticate(request, username=email, password=password)
    if user is None:
        return JsonResponse(
            {"status": "error", "message": "Invalid credentials"}, status=401
        )

    login(request, user)
    return JsonResponse(
        {
            "status": "success",
            "message": "Login successful",
            "data": {"username": user.username, "email": user.email},
        }
    )


@csrf_protect
@require_POST
def api_logout(request):
    logout(request)
    return JsonResponse({"status": "success", "message": "Logged out"})


def current_user(request):
    if request.user.is_authenticated:
        return JsonResponse(
            {
                "status": "success",
                "data": {
                    "username": request.user.username,
                    "email": request.user.email,
                    "first_name": request.user.first_name,
                    "last_name": request.user.last_name,
                },
            }
        )
    return JsonResponse(
        {"status": "error", "message": "Not authenticated"}, status=401
    )


def _render_if_authenticated(request, template):
    if not request.user.is_authenticated:
        return redirect("showcase:login")
    return render(request, template)


def index(request):
    return _render_if_authenticated(request, "showcase/index.html")


def dashboard(request):
    return _render_if_authenticated(request, "showcase/index.html")


def data_grid(request):
    return _render_if_authenticated(request, "showcase/data_grid.html")


def realtime(request):
    return _render_if_authenticated(request, "showcase/realtime.html")


def media_upload(request):
    return _render_if_authenticated(request, "showcase/media_upload.html")


def security(request):
    return _render_if_authenticated(request, "showcase/security.html")
