import csv
import io
from celery import shared_task
from django.core.cache import cache


@shared_task(bind=True, max_retries=3)
def export_tasks_to_csv(self, task_ids=None):
    try:
        from apps.showcase.models import TaskLog
        qs = TaskLog.objects.select_related("assigned_to")
        if task_ids:
            qs = qs.filter(id__in=task_ids)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Title", "Status", "Priority", "Assigned To", "Due Date", "Created At"])

        for task in qs.iterator(chunk_size=500):
            writer.writerow([
                str(task.id),
                task.title,
                task.status,
                task.priority,
                task.assigned_to.email if task.assigned_to else "",
                str(task.due_date) if task.due_date else "",
                task.created_at.isoformat(),
            ])

        csv_data = output.getvalue()
        cache_key = f"csv_export_{self.request.id}"
        cache.set(cache_key, csv_data, timeout=300)
        return {"status": "success", "cache_key": cache_key, "row_count": qs.count()}

    except Exception as exc:
        raise self.retry(exc=exc, countdown=5)


@shared_task
def process_uploaded_image(media_id):
    from apps.showcase.models import UploadedMedia
    from PIL import Image
    import os

    try:
        media = UploadedMedia.objects.get(id=media_id)
        img_path = media.file.path

        with Image.open(img_path) as img:
            media.width = img.width
            media.height = img.height

            thumb_size = (300, 300)
            img.thumbnail(thumb_size, Image.LANCZOS)

            webp_io = io.BytesIO()
            img.save(webp_io, format="WEBP", quality=85)
            webp_io.seek(0)

            from django.core.files.base import ContentFile
            thumb_name = f"thumb_{os.path.splitext(os.path.basename(img_path))[0]}.webp"
            media.thumbnail.save(thumb_name, ContentFile(webp_io.read()), save=False)
            media.is_processed = True
            media.save(update_fields=["thumbnail", "width", "height", "is_processed"])

    except UploadedMedia.DoesNotExist:
        pass
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error(f"Image processing failed for {media_id}: {exc}")
