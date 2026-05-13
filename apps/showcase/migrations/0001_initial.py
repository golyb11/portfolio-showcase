import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="TaskLog",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(db_index=True, max_length=255)),
                ("description", models.TextField(blank=True, default="")),
                ("status", models.CharField(
                    choices=[("pending","Pending"),("in_progress","In Progress"),("completed","Completed"),("failed","Failed")],
                    db_index=True, default="pending", max_length=20,
                )),
                ("priority", models.CharField(
                    choices=[("low","Low"),("medium","Medium"),("high","High"),("critical","Critical")],
                    db_index=True, default="medium", max_length=20,
                )),
                ("sort_order", models.PositiveIntegerField(db_index=True, default=0)),
                ("tags", models.JSONField(blank=True, default=list)),
                ("due_date", models.DateField(blank=True, null=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("assigned_to", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="assigned_tasks",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "db_table": "showcase_task_log",
                "ordering": ["sort_order", "-created_at"],
                "indexes": [
                    models.Index(fields=["status", "priority"], name="showcase_task_status_priority_idx"),
                    models.Index(fields=["sort_order"], name="showcase_task_sort_order_idx"),
                    models.Index(fields=["due_date"], name="showcase_task_due_date_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="UploadedMedia",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("original_filename", models.CharField(max_length=255)),
                ("file", models.FileField(upload_to="uploads/%Y/%m/%d/")),
                ("thumbnail", models.ImageField(blank=True, null=True, upload_to="thumbnails/%Y/%m/%d/")),
                ("file_size", models.PositiveBigIntegerField()),
                ("mime_type", models.CharField(db_index=True, max_length=100)),
                ("width", models.PositiveIntegerField(blank=True, null=True)),
                ("height", models.PositiveIntegerField(blank=True, null=True)),
                ("is_processed", models.BooleanField(db_index=True, default=False)),
                ("uploaded_by", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="uploaded_media",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "db_table": "showcase_uploaded_media",
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["mime_type"], name="showcase_media_mime_idx"),
                    models.Index(fields=["is_processed"], name="showcase_media_processed_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="ChatMessage",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("room", models.CharField(db_index=True, default="general", max_length=100)),
                ("author", models.CharField(default="System", max_length=100)),
                ("content", models.TextField()),
                ("message_type", models.CharField(
                    choices=[("user","User"),("system","System"),("server","Server")],
                    db_index=True, default="user", max_length=20,
                )),
            ],
            options={
                "db_table": "showcase_chat_message",
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["room", "created_at"], name="showcase_chat_room_created_idx"),
                ],
            },
        ),
    ]
