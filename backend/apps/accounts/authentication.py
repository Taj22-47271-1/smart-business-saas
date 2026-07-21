from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication


class PasswordChangeAwareJWTAuthentication(JWTAuthentication):
    """Block temporary-password accounts from business APIs until reset."""

    ALLOWED_PATH_SUFFIXES = (
        "/api/accounts/profile/",
        "/api/accounts/change-password/",
    )

    def authenticate(self, request):
        result = super().authenticate(request)
        if not result:
            return None

        user, token = result
        if user.must_change_password and not request.path.endswith(self.ALLOWED_PATH_SUFFIXES):
            raise PermissionDenied(
                "You must change your temporary password before continuing."
            )
        return user, token
