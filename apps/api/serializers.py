import bleach
from rest_framework import serializers
from apps.showcase.models import TaskLog, UploadedMedia, ChatMessage
from apps.core.models import User


class UserMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email"]
        read_only_fields = fields


class TaskLogSerializer(serializers.ModelSerializer):
    assigned_to_detail = UserMinimalSerializer(source="assigned_to", read_only=True)

    class Meta:
        model = TaskLog
        fields = [
            "id", "title", "description", "status", "priority",
            "assigned_to", "assigned_to_detail", "sort_order",
            "tags", "due_date", "completed_at", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_title(self, value):
        return bleach.clean(value.strip(), tags=[], strip=True)

    def validate_description(self, value):
        return bleach.clean(value.strip(), tags=[], strip=True)

    def validate_tags(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Tags must be a list.")
        return [bleach.clean(str(t), tags=[], strip=True) for t in value[:10]]


class TaskLogReorderSerializer(serializers.Serializer):
    ordered_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        max_length=500,
    )


class UploadedMediaSerializer(serializers.ModelSerializer):
    uploaded_by_detail = UserMinimalSerializer(source="uploaded_by", read_only=True)
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = UploadedMedia
        fields = [
            "id", "original_filename", "file_url", "thumbnail_url",
            "file_size", "mime_type", "width", "height",
            "uploaded_by_detail", "is_processed", "created_at",
        ]
        read_only_fields = fields

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None

    def get_thumbnail_url(self, obj):
        request = self.context.get("request")
        if obj.thumbnail and request:
            return request.build_absolute_uri(obj.thumbnail.url)
        return None


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ["id", "room", "author", "content", "message_type", "created_at"]
        read_only_fields = fields


class DashboardStatsSerializer(serializers.Serializer):
    total_tasks = serializers.IntegerField()
    completed_tasks = serializers.IntegerField()
    pending_tasks = serializers.IntegerField()
    total_uploads = serializers.IntegerField()
    total_users = serializers.IntegerField()
    tasks_by_priority = serializers.DictField()
    recent_activity = serializers.ListField()
