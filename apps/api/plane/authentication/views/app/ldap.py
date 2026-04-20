# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import json

# Django imports
from django.http import JsonResponse
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

# Module imports
from plane.authentication.adapter.ldap import LDAPAdapter
from plane.authentication.adapter.error import AuthenticationException
from plane.authentication.utils.login import user_login
from plane.license.models import Instance


@method_decorator(csrf_exempt, name='dispatch')
class LDAPAuthenticationEndpoint(View):
    """LDAP authentication endpoint"""
    
    def post(self, request):
        try:
            # Check if instance is configured
            instance = Instance.objects.first()
            if instance is None or not instance.is_setup_done:
                return JsonResponse(
                    {"error_code": 5000, "error_message": "INSTANCE_NOT_CONFIGURED"},
                    status=400
                )
            
            # Parse request data
            data = json.loads(request.body)
            username = data.get("username", "").strip()
            password = data.get("password", "")
            
            if not username or not password:
                return JsonResponse(
                    {"error_code": 5070, "error_message": "REQUIRED_EMAIL_PASSWORD_SIGN_IN"},
                    status=400
                )
            
            # Create LDAP adapter and authenticate
            ldap_adapter = LDAPAdapter(
                request=request,
                username=username,
                password=password
            )
            
            user = ldap_adapter.authenticate()
            
            # Log user in
            user_login(request=request, user=user)
            
            return JsonResponse({
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "display_name": user.display_name,
                    "avatar": user.avatar,
                    "is_password_autoset": user.is_password_autoset,
                },
                "access_token": None,  # LDAP doesn't use tokens
                "refresh_token": None,
            })
            
        except AuthenticationException as e:
            return JsonResponse(e.get_error_dict(), status=400)
        except Exception as e:
            return JsonResponse(
                {"error_code": 5999, "error_message": "AUTHENTICATION_FAILED"},
                status=400
            )


@method_decorator(csrf_exempt, name='dispatch')
class LDAPTestConnectionEndpoint(View):
    """Test LDAP connection endpoint"""
    
    def post(self, request):
        try:
            # Check if instance is configured
            instance = Instance.objects.first()
            if instance is None or not instance.is_setup_done:
                return JsonResponse(
                    {"error_code": 5000, "error_message": "INSTANCE_NOT_CONFIGURED"},
                    status=400
                )
            
            # Create LDAP adapter and test connection
            ldap_adapter = LDAPAdapter(request=request)
            result = ldap_adapter.test_connection()
            
            return JsonResponse(result)
            
        except AuthenticationException as e:
            return JsonResponse(e.get_error_dict(), status=400)
        except Exception as e:
            return JsonResponse(
                {"error_code": 5210, "error_message": "LDAP_SERVER_UNREACHABLE"},
                status=400
            )