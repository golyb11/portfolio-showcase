from rest_framework.renderers import JSONRenderer
import json


class StandardJSONRenderer(JSONRenderer):
    def render(self, data, accepted_media_type=None, renderer_context=None):
        if renderer_context is None:
            return super().render(data, accepted_media_type, renderer_context)

        response = renderer_context.get("response")
        if response is None:
            return super().render(data, accepted_media_type, renderer_context)

        if isinstance(data, dict) and "status" in data:
            return super().render(data, accepted_media_type, renderer_context)

        if response.status_code >= 400:
            wrapped = {"status": "error", "data": None, "message": data}
        else:
            wrapped = {"status": "success", "data": data, "message": None}

        return super().render(wrapped, accepted_media_type, renderer_context)
