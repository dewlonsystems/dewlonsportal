from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response(
                {'error': 'Username and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return Response({
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
            }, status=status.HTTP_200_OK)
        else:
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({'message': 'Logged out successfully'}, status=status.HTTP_200_OK)


@method_decorator(ensure_csrf_cookie, name='dispatch')
class UserDetailView(APIView):
    """
    Returns current user info + sets CSRF cookie on first load.
    Call this on app startup to get user context and CSRF token.
    """
    def get(self, request):
        if request.user.is_authenticated:
            return Response({
                'id': request.user.id,
                'username': request.user.username,
                'first_name': request.user.first_name,
                'is_staff': request.user.is_staff,
                'is_superuser': request.user.is_superuser,
            })
        else:
            return Response({'error': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)