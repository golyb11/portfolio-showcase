from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        error_detail = response.data
        if isinstance(error_detail, dict):
            message = " ".join(
                str(v[0]) if isinstance(v, list) else str(v)
                for v in error_detail.values()
            )
        elif isinstance(error_detail, list):
            message = str(error_detail[0]) if error_detail else "An error occurred."
        else:
            message = str(error_detail)

        response.data = {
            "status": "error",
            "data": None,
            "message": message,
        }

    return response
