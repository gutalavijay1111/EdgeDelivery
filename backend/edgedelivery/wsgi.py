import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "edgedelivery.settings.production")

_django_app = get_wsgi_application()


def application(environ, start_response):
    # Respond to ALB health checks before Django's ALLOWED_HOSTS check runs.
    # The ALB sends the EC2 private IP as Host header, which wouldn't be in ALLOWED_HOSTS.
    if environ.get("PATH_INFO") == "/health/":
        start_response("200 OK", [("Content-Type", "application/json")])
        return [b'{"status":"ok"}']
    return _django_app(environ, start_response)
