import uuid
from django.db import models
from django.conf import settings
from apps.core.models import TimeStampedModel


class TaskLog(TimeStampedModel):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]
    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("critical", "Critical"),
    ]

    title = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default="medium", db_index=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_tasks",
    )
    sort_order = models.PositiveIntegerField(default=0, db_index=True)
    tags = models.JSONField(default=list, blank=True)
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "showcase_task_log"
        ordering = ["sort_order", "-created_at"]
        indexes = [
            models.Index(fields=["status", "priority"]),
            models.Index(fields=["sort_order"]),
            models.Index(fields=["due_date"]),
        ]

    def __str__(self):
        return f"{self.title} [{self.status}]"


class UploadedMedia(TimeStampedModel):
    original_filename = models.CharField(max_length=255)
    file = models.FileField(upload_to="uploads/%Y/%m/%d/")
    thumbnail = models.ImageField(upload_to="thumbnails/%Y/%m/%d/", null=True, blank=True)
    file_size = models.PositiveBigIntegerField()
    mime_type = models.CharField(max_length=100, db_index=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_media",
    )
    is_processed = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = "showcase_uploaded_media"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["mime_type"]),
            models.Index(fields=["is_processed"]),
        ]

    def __str__(self):
        return self.original_filename


class ChatMessage(TimeStampedModel):
    room = models.CharField(max_length=100, default="general", db_index=True)
    author = models.CharField(max_length=100, default="System")
    content = models.TextField()
    message_type = models.CharField(
        max_length=20,
        choices=[("user", "User"), ("system", "System"), ("server", "Server")],
        default="user",
        db_index=True,
    )

    class Meta:
        db_table = "showcase_chat_message"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["room", "created_at"]),
        ]

    def __str__(self):
        return f"[{self.room}] {self.author}: {self.content[:50]}"
