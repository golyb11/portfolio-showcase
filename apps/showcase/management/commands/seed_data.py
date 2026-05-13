import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.core.models import User
from apps.showcase.models import TaskLog, ChatMessage


TASK_TITLES = [
    "Implement OAuth2 authentication flow",
    "Optimize database query performance",
    "Write unit tests for payment module",
    "Deploy staging environment",
    "Fix memory leak in WebSocket handler",
    "Migrate legacy API to REST",
    "Set up CI/CD pipeline",
    "Implement rate limiting middleware",
    "Design system architecture diagram",
    "Code review for PR #142",
    "Update SSL certificates",
    "Refactor user model",
    "Add Redis caching layer",
    "Implement CSV export feature",
    "Fix XSS vulnerability in comments",
    "Add dark mode support",
    "Optimize image compression pipeline",
    "Write API documentation",
    "Set up monitoring with Prometheus",
    "Implement drag-and-drop file upload",
    "Add WebSocket reconnect logic",
    "Create admin dashboard widgets",
    "Implement full-text search",
    "Add two-factor authentication",
    "Migrate to PostgreSQL 16",
    "Implement content security policy",
    "Add pagination to all list endpoints",
    "Fix CORS configuration",
    "Implement JWT refresh token rotation",
    "Add Celery task monitoring",
]

TAGS_POOL = [
    "backend", "frontend", "security", "performance", "database",
    "api", "devops", "testing", "documentation", "urgent",
    "refactor", "bug", "feature", "enhancement", "infrastructure",
]

CHAT_MESSAGES = [
    ("System", "Server started successfully.", "system"),
    ("Alice", "Hey team, the new API endpoint is live!", "user"),
    ("Bob", "Great work! I tested it and it's working perfectly.", "user"),
    ("System", "Deployment to staging completed.", "system"),
    ("Charlie", "Can someone review my PR for the auth module?", "user"),
    ("Alice", "On it! Will check in 10 minutes.", "user"),
    ("System", "Database backup completed successfully.", "system"),
    ("Bob", "The WebSocket connection is stable now.", "user"),
    ("Charlie", "Redis cache hit rate is at 94%. Nice!", "user"),
    ("System", "SSL certificate renewed automatically.", "system"),
]


class Command(BaseCommand):
    help = "Seed the database with mock data for the portfolio showcase."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear existing data before seeding.",
        )

    def handle(self, *args, **options):
        if options["clear"]:
            self.stdout.write("Clearing existing data...")
            TaskLog.objects.all().delete()
            ChatMessage.objects.all().delete()
            User.objects.filter(is_superuser=False).delete()

        if User.objects.count() == 0:
            self.stdout.write("Creating demo users...")
            self._create_users()

        if TaskLog.objects.count() < 10:
            self.stdout.write("Creating task logs...")
            self._create_tasks()

        if ChatMessage.objects.count() < 5:
            self.stdout.write("Creating chat messages...")
            self._create_chat_messages()

        self.stdout.write(self.style.SUCCESS("Database seeded successfully."))

    def _create_users(self):
        demo_users = [
            {"username": "alice_dev", "email": "alice@portfolio.dev", "first_name": "Alice", "last_name": "Chen"},
            {"username": "bob_ops", "email": "bob@portfolio.dev", "first_name": "Bob", "last_name": "Martinez"},
            {"username": "charlie_qa", "email": "charlie@portfolio.dev", "first_name": "Charlie", "last_name": "Kim"},
        ]
        created_users = []
        for user_data in demo_users:
            user, created = User.objects.get_or_create(
                email=user_data["email"],
                defaults={
                    "username": user_data["username"],
                    "first_name": user_data["first_name"],
                    "last_name": user_data["last_name"],
                    "is_active": True,
                },
            )
            if created:
                user.set_password("Demo@Password123!")
                user.save()
            created_users.append(user)
        return created_users

    def _create_tasks(self):
        users = list(User.objects.filter(is_superuser=False))
        statuses = ["pending", "in_progress", "completed", "failed"]
        priorities = ["low", "medium", "high", "critical"]
        now = timezone.now()

        tasks = []
        for i, title in enumerate(TASK_TITLES):
            chosen_status = random.choice(statuses)
            tags = random.sample(TAGS_POOL, random.randint(1, 4))
            due_offset = random.randint(-10, 30)
            completed_at = now - timedelta(days=random.randint(1, 5)) if chosen_status == "completed" else None

            tasks.append(
                TaskLog(
                    title=title,
                    description=f"Detailed description for task: {title}. This task requires careful attention to security and performance considerations.",
                    status=chosen_status,
                    priority=random.choice(priorities),
                    assigned_to=random.choice(users) if users else None,
                    sort_order=i,
                    tags=tags,
                    due_date=(now + timedelta(days=due_offset)).date(),
                    completed_at=completed_at,
                )
            )

        TaskLog.objects.bulk_create(tasks, ignore_conflicts=True)

    def _create_chat_messages(self):
        messages = []
        for author, content, msg_type in CHAT_MESSAGES:
            messages.append(
                ChatMessage(
                    room="general",
                    author=author,
                    content=content,
                    message_type=msg_type,
                )
            )
        ChatMessage.objects.bulk_create(messages, ignore_conflicts=True)
