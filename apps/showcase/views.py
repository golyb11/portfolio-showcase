import os
import io
import magic
from pathlib import Path
from django.shortcuts import render
from django.conf import settings
from django.http import HttpResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from PIL import Image


def index(request):
    return render(request, "showcase/index.html")


def dashboard(request):
    return render(request, "showcase/index.html")


def data_grid(request):
    return render(request, "showcase/data_grid.html")


def realtime(request):
    return render(request, "showcase/realtime.html")


def media_upload(request):
    return render(request, "showcase/media_upload.html")


def security(request):
    return render(request, "showcase/security.html")
