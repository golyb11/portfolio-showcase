import io
import os
import magic
import bleach
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import Count, Q
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from django_filters.rest_framework import DjangoFilterBackend

from apps.showcase.models import TaskLog, UploadedMedia, ChatMessage
from apps.core.models import User
from .serializers import (
    TaskLogSerializer,
    TaskLogReorderSerializer,
    UploadedMediaSerializer,
    ChatMessageSerializer,
    DashboardStatsSerializer,
)
from .permissions import IsOwnerOrReadOnly
from .pagination import StandardResultsPagination


class TaskLogViewSet(viewsets.ModelViewSet):
    queryset = TaskLog.objects.select_related("assigned_to").all()
    serializer_class = TaskLogSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "priority", "assigned_to"]
    search_fields = ["title", "description", "tags"]
    ordering_fields = ["sort_order", "created_at", "due_date", "priority", "status"]
    ordering = ["sort_order"]

    def get_queryset(self):
        return TaskLog.objects.select_related("assigned_to").all()

    @action(detail=False, methods=["post"], url_path="reorder")
    def reorder(self, request):
        serializer = TaskLogReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ordered_ids = serializer.validated_data["ordered_ids"]

        with transaction.atomic():
            for index, task_id in enumerate(ordered_ids):
                TaskLog.objects.filter(id=task_id).update(sort_order=index)

        return Response({"status": "success", "message": "Order updated.", "data": None})

    @action(detail=False, methods=["post"], url_path="export-csv")
    def export_csv(self, request):
        from apps.showcase.tasks import export_tasks_to_csv
        task = export_tasks_to_csv.delay()
        return Response(
            {
                "status": "success",
                "message": "CSV export started.",
                "data": {"task_id": task.id},
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=False, methods=["get"], url_path="export-csv-download")
    def export_csv_download(self, request):
        task_id = request.query_params.get("task_id")
        if not task_id:
            return Response({"status": "error", "message": "task_id required.", "data": None}, status=400)

        cache_key = f"csv_export_{task_id}"
        csv_data = cache.get(cache_key)
        if not csv_data:
            return Response({"status": "error", "message": "Export not ready or expired.", "data": None}, status=404)

        response = HttpResponse(csv_data, content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="tasks_export.csv"'
        return response


class UploadedMediaViewSet(viewsets.ModelViewSet):
    queryset = UploadedMedia.objects.select_related("uploaded_by").all()
    serializer_class = UploadedMediaSerializer
    permission_classes = [AllowAny]
    http_method_names = ["get", "post", "delete", "head", "options"]

    ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    MAX_FILE_SIZE = 5 * 1024 * 1024

    def create(self, request, *args, **kwargs):
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response(
                {"status": "error", "message": "No file provided.", "data": None},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if uploaded_file.size > self.MAX_FILE_SIZE:
            return Response(
                {"status": "error", "message": "File exceeds 5MB limit.", "data": None},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file_header = uploaded_file.read(2048)
        uploaded_file.seek(0)
        detected_mime = magic.from_buffer(file_header, mime=True)

        if detected_mime not in self.ALLOWED_MIME_TYPES:
            return Response(
                {
                    "status": "error",
                    "message": f"File type '{detected_mime}' not allowed. Only images are accepted.",
                    "data": None,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        media = UploadedMedia.objects.create(
            original_filename=bleach.clean(uploaded_file.name, tags=[], strip=True)[:255],
            file=uploaded_file,
            file_size=uploaded_file.size,
            mime_type=detected_mime,
            uploaded_by=request.user if request.user.is_authenticated else None,
        )

        from apps.showcase.tasks import process_uploaded_image
        process_uploaded_image.delay(str(media.id))

        serializer = self.get_serializer(media)
        return Response(
            {"status": "success", "data": serializer.data, "message": "Upload successful."},
            status=status.HTTP_201_CREATED,
        )


@api_view(["GET"])
@permission_classes([AllowAny])
def dashboard_stats(request):
    cache_key = "dashboard_stats"
    cached = cache.get(cache_key)
    if cached:
        return Response({"status": "success", "data": cached, "message": None})

    tasks_qs = TaskLog.objects.all()
    total_tasks = tasks_qs.count()
    completed_tasks = tasks_qs.filter(status="completed").count()
    pending_tasks = tasks_qs.filter(status="pending").count()

    tasks_by_priority = dict(
        tasks_qs.values("priority").annotate(count=Count("id")).values_list("priority", "count")
    )

    recent_activity = list(
        TaskLog.objects.select_related("assigned_to")
        .order_by("-updated_at")[:5]
        .values("id", "title", "status", "updated_at")
    )
    for item in recent_activity:
        item["id"] = str(item["id"])
        item["updated_at"] = item["updated_at"].isoformat()

    data = {
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "pending_tasks": pending_tasks,
        "total_uploads": UploadedMedia.objects.count(),
        "total_users": User.objects.count(),
        "tasks_by_priority": tasks_by_priority,
        "recent_activity": recent_activity,
    }

    cache.set(cache_key, data, timeout=30)
    return Response({"status": "success", "data": data, "message": None})


@api_view(["GET"])
@permission_classes([AllowAny])
def security_headers(request):
    headers_to_expose = [
        "X-Frame-Options",
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Content-Security-Policy",
        "Strict-Transport-Security",
        "X-XSS-Protection",
    ]
    response_headers = {}
    for header in headers_to_expose:
        val = request.META.get(f"HTTP_{header.upper().replace('-', '_')}")
        response_headers[header] = val or "Not set (check response headers)"

    data = {
        "headers": response_headers,
        "debug_mode": settings.DEBUG,
        "secure_ssl_redirect": getattr(settings, "SECURE_SSL_REDIRECT", False),
        "session_cookie_secure": settings.SESSION_COOKIE_SECURE if not settings.DEBUG else False,
        "csrf_cookie_secure": settings.CSRF_COOKIE_SECURE if not settings.DEBUG else False,
        "x_frame_options": settings.X_FRAME_OPTIONS,
        "secure_content_type_nosniff": settings.SECURE_CONTENT_TYPE_NOSNIFF,
        "secure_browser_xss_filter": settings.SECURE_BROWSER_XSS_FILTER,
    }
    return Response({"status": "success", "data": data, "message": None})


class RateLimitTestThrottle(ScopedRateThrottle):
    scope = "rate_limit_test"


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([RateLimitTestThrottle])
def rate_limit_test(request):
    return Response(
        {
            "status": "success",
            "data": {"message": "Request allowed.", "timestamp": timezone.now().isoformat()},
            "message": None,
        }
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def xss_test(request):
    raw_input = request.data.get("input", "")
    safe_output = bleach.clean(str(raw_input), tags=[], strip=True)
    return Response(
        {
            "status": "success",
            "data": {
                "raw_input_length": len(raw_input),
                "sanitized_output": safe_output,
                "was_sanitized": raw_input != safe_output,
            },
            "message": None,
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def system_metrics(request):
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=0.1)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        data = {
            "cpu_percent": cpu,
            "memory_percent": mem.percent,
            "memory_used_mb": round(mem.used / 1024 / 1024, 1),
            "memory_total_mb": round(mem.total / 1024 / 1024, 1),
            "disk_percent": disk.percent,
            "disk_used_gb": round(disk.used / 1024 / 1024 / 1024, 2),
            "disk_total_gb": round(disk.total / 1024 / 1024 / 1024, 2),
        }
    except ImportError:
        data = {"error": "psutil not available"}

    return Response({"status": "success", "data": data, "message": None})
