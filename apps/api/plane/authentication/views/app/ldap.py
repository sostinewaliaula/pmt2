# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.http import HttpResponseRedirect, JsonResponse
from django.views import View
from django.utils.http import url_has_allowed_host_and_scheme

# Module imports
from plane.authentication.utils.login import user_login
from plane.license.models import Instance
from plane.authentication.utils.host import base_host
from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)
from plane.utils.path_validator import get_safe_redirect_url, validate_next_path, get_allowed_hosts
from plane.license.utils.instance_value import get_configuration_value


class LDAPAuthenticationEndpoint(View):
    """LDAP authentication endpoint for web app"""
    
    def post(self, request):
        next_path = request.POST.get("next_path")
        
        # Check instance configuration
        instance = Instance.objects.first()
        if instance is None or not instance.is_setup_done:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["INSTANCE_NOT_CONFIGURED"],
                error_message="INSTANCE_NOT_CONFIGURED",
            )
            params = exc.get_error_dict()
            url = get_safe_redirect_url(
                base_url=base_host(request=request, is_app=True), 
                next_path=next_path, 
                params=params
            )
            return HttpResponseRedirect(url)

        # Check if LDAP is enabled
        (IS_LDAP_ENABLED,) = get_configuration_value([
            {"key": "IS_LDAP_ENABLED", "default": "0"}
        ])
        
        if IS_LDAP_ENABLED != "1":
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["LDAP_NOT_CONFIGURED"],
                error_message="LDAP_NOT_CONFIGURED",
            )
            params = exc.get_error_dict()
            url = get_safe_redirect_url(
                base_url=base_host(request=request, is_app=True), 
                next_path=next_path, 
                params=params
            )
            return HttpResponseRedirect(url)

        # Get credentials
        username = request.POST.get("username", "").strip()
        password = request.POST.get("password", "")

        if not username or not password:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["REQUIRED_EMAIL_PASSWORD_SIGN_IN"],
                error_message="REQUIRED_EMAIL_PASSWORD_SIGN_IN",
                payload={"email": str(username)},
            )
            params = exc.get_error_dict()
            url = get_safe_redirect_url(
                base_host=base_host(request=request, is_app=True), 
                next_path=next_path, 
                params=params
            )
            return HttpResponseRedirect(url)

        try:
            # Import LDAP adapter only when needed
            from plane.authentication.adapter.ldap import LDAPAdapter
            
            ldap_adapter = LDAPAdapter(
                request=request,
                username=username,
                password=password
            )
            user = ldap_adapter.authenticate()
            
            # Login the user
            user_login(request=request, user=user)
            
            # Redirect to next path
            next_path = validate_next_path(next_path=next_path)
            url = f"{base_host(request=request, is_app=True).rstrip('/')}{next_path}"
            if url_has_allowed_host_and_scheme(url, allowed_hosts=get_allowed_hosts()):
                return HttpResponseRedirect(url)
            else:
                return HttpResponseRedirect(base_host(request=request, is_app=True))
                
        except ImportError:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["LDAP_NOT_CONFIGURED"],
                error_message="LDAP_NOT_CONFIGURED",
            )
            params = exc.get_error_dict()
            url = get_safe_redirect_url(
                base_url=base_host(request=request, is_app=True), 
                next_path=next_path, 
                params=params
            )
            return HttpResponseRedirect(url)
        except AuthenticationException as e:
            params = e.get_error_dict()
            url = get_safe_redirect_url(
                base_url=base_host(request=request, is_app=True), 
                next_path=next_path, 
                params=params
            )
            return HttpResponseRedirect(url)


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
            from plane.authentication.adapter.ldap import LDAPAdapter
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