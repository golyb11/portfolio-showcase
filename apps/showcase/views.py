import os
import io
import json
import magic
from pathlib import Path
from django.shortcuts import render, redirect
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie, csrf_protect
from django.middleware.csrf import get_token
from PIL import Image


@ensure_csrf_cookie
def login_view(request):
    if request.user.is_authenticated:
        return redirect('showcase:dashboard')
    return render(request, 'showcase/login.html')


@require_http_methods(["GET"])
def get_csrf_token(request):
    """Get CSRF token for API requests"""
    token = get_token(request)
    return JsonResponse({'status': 'success', 'csrfToken': token})


import logging
logger = logging.getLogger(__name__)

@require_http_methods(["POST"])
@csrf_exempt
def api_login(request):
    try:
        try:
            data = json.loads(request.body)
            email = data.get('email')
            password = data.get('password')
        except:
            return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)

        if not email or not password:
            return JsonResponse({'status': 'error', 'message': 'Email and password required'}, status=401)

        from apps.core.models import User
        try:
            user = User.objects.get(email=email)
            user = authenticate(username=user.username, password=password)
            if user:
                login(request, user)
                return JsonResponse({'status': 'success', 'message': 'Login successful', 'data': {'username': user.username, 'email': user.email}})
        except User.DoesNotExist:
            pass

        return JsonResponse({'status': 'error', 'message': 'Invalid credentials'}, status=401)
    except Exception as e:
        logger.error("Login error: %s", str(e))
        return JsonResponse({'status': 'error', 'message': 'Internal server error'}, status=500)


@require_http_methods(["POST"])
def api_logout(request):
    logout(request)
    return JsonResponse({'status': 'success', 'message': 'Logged out'})


def current_user(request):
    if request.user.is_authenticated:
        return JsonResponse({
            'status': 'success',
            'data': {
                'username': request.user.username,
                'email': request.user.email,
                'first_name': request.user.first_name,
                'last_name': request.user.last_name,
            }
        })
    return JsonResponse({'status': 'error', 'message': 'Not authenticated'}, status=401)


def index(request):
    if not request.user.is_authenticated:
        return redirect('showcase:login')
    return render(request, "showcase/index.html")


def dashboard(request):
    if not request.user.is_authenticated:
        return redirect('showcase:login')
    return render(request, "showcase/index.html")


def data_grid(request):
    if not request.user.is_authenticated:
        return redirect('showcase:login')
    return render(request, "showcase/data_grid.html")


def realtime(request):
    if not request.user.is_authenticated:
        return redirect('showcase:login')
    return render(request, "showcase/realtime.html")


def media_upload(request):
    if not request.user.is_authenticated:
        return redirect('showcase:login')
    return render(request, "showcase/media_upload.html")


def security(request):
    if not request.user.is_authenticated:
        return redirect('showcase:login')
    return render(request, "showcase/security.html")
