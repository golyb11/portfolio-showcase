import time
import hashlib
from django.core.cache import cache
from django.http import JsonResponse
from django.conf import settings


class RateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.limit = getattr(settings, "RATE_LIMIT_REQUESTS", 5)
        self.window = getattr(settings, "RATE_LIMIT_WINDOW", 60)
        self.prefix = getattr(settings, "RATE_LIMIT_CACHE_PREFIX", "rl")

    def __call__(self, request):
        if request.path.startswith("/api/security/rate-limit-test/"):
            response = self._check_rate_limit(request)
            if response:
                return response
        return self.get_response(request)

    def _check_rate_limit(self, request):
        ip = self._get_client_ip(request)
        key = f"{self.prefix}:{hashlib.md5(ip.encode()).hexdigest()}:{request.path}"
        now = int(time.time())
        window_start = now - self.window

        pipe_key = f"{key}:timestamps"
        timestamps = cache.get(pipe_key, [])
        timestamps = [t for t in timestamps if t > window_start]

        if len(timestamps) >= self.limit:
            retry_after = self.window - (now - timestamps[0])
            return JsonResponse(
                {
                    "status": "error",
                    "message": "Rate limit exceeded. Too many requests.",
                    "retry_after": retry_after,
                },
                status=429,
                headers={"Retry-After": str(retry_after)},
            )

        timestamps.append(now)
        cache.set(pipe_key, timestamps, timeout=self.window * 2)
        return None

    def _get_client_ip(self, request):
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "unknown")
