import hashlib
import random
import uuid

from django.conf import settings
from django.contrib.auth import authenticate
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import LoginSerializer, RegisterSerializer, UserSerializer

_GUEST_ADJECTIVES = [
    "Cosmic", "Neon", "Swift", "Silver", "Jade", "Blazing", "Crimson",
    "Azure", "Golden", "Shadow", "Digital", "Phantom", "Turbo", "Electric",
    "Midnight", "Crystal", "Hyper", "Stellar", "Nebula", "Prism",
]

_GUEST_NOUNS = [
    "Falcon", "Panther", "Cipher", "Drifter", "Voyager", "Nomad",
    "Pioneer", "Comet", "Spark", "Titan", "Oracle", "Vector", "Surge",
    "Drift", "Beacon", "Axiom", "Vertex", "Flux", "Quasar", "Zenith",
]


def _tokens(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def _guest_username():
    adj = random.choice(_GUEST_ADJECTIVES)
    noun = random.choice(_GUEST_NOUNS)
    num = random.randint(10, 99)
    return f"{adj}{noun}{num}"


def _ip_hash(request):
    ip = (
        request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
        or request.META.get("REMOTE_ADDR", "unknown")
    )
    return hashlib.sha256(f"{ip}:{settings.SECRET_KEY}".encode()).hexdigest()


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(_tokens(user), status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
        )
        if not user:
            return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(_tokens(user))


class GoogleAuthView(APIView):
    """
    Frontend sends the Google credential (ID token) obtained from the
    Google Sign-In button.  We verify it server-side and return our own JWT.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        credential = request.data.get("credential")
        if not credential:
            return Response({"error": "credential required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            idinfo = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_401_UNAUTHORIZED)

        google_id = idinfo["sub"]
        email = idinfo.get("email", "")
        avatar = idinfo.get("picture", "")

        user, created = User.objects.get_or_create(
            google_id=google_id,
            defaults={
                "username": email.split("@")[0] or google_id[:20],
                "email": email,
                "avatar_url": avatar,
            },
        )
        if not created and avatar:
            User.objects.filter(pk=user.pk).update(avatar_url=avatar)

        return Response({**_tokens(user), "created": created})


class GuestSessionView(APIView):
    """
    POST /api/auth/guest/

    Creates or retrieves a guest account tied to the caller's IP address.
    One guest account per IP — repeated calls from the same IP return the
    same JWT tokens so the guest doesn't lose their uploads.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        ip_hash = _ip_hash(request)

        # Return existing guest account for this IP
        existing = User.objects.filter(guest_ip_hash=ip_hash).first()
        if existing:
            return Response({**_tokens(existing), "username": existing.username, "avatar_url": existing.avatar_url})

        # Pick a unique creative username
        username = _guest_username()
        for _ in range(20):
            if not User.objects.filter(username=username).exists():
                break
            username = _guest_username()
        else:
            username = f"Guest{uuid.uuid4().hex[:8]}"

        avatar_url = f"https://api.dicebear.com/7.x/bottts-neutral/svg?seed={username}&scale=90"

        user = User.objects.create_user(
            username=username,
            password=None,
            is_guest=True,
            guest_ip_hash=ip_hash,
            avatar_url=avatar_url,
        )

        return Response(
            {**_tokens(user), "username": username, "avatar_url": avatar_url},
            status=status.HTTP_201_CREATED,
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
