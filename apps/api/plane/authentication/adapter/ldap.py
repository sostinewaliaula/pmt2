# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import os
import uuid
import ssl
from typing import Dict, Any, Optional

# Third party imports
import ldap3
from ldap3 import Server, Connection, ALL, NTLM, SIMPLE, Tls
from ldap3.core.exceptions import LDAPException, LDAPBindError, LDAPInvalidCredentialsResult

# Module imports
from plane.authentication.adapter.base import Adapter
from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)
from plane.license.utils.instance_value import get_configuration_value


class LDAPAdapter(Adapter):
    """LDAP/Active Directory authentication adapter"""
    
    def __init__(self, request, username=None, password=None, callback=None):
        super().__init__(request=request, provider="ldap", callback=callback)
        self.username = username
        self.password = password
        self.ldap_config = None
        self.connection = None
        
    def _get_ldap_configuration(self) -> Dict[str, Any]:
        """Get LDAP configuration from instance settings"""
        if self.ldap_config:
            return self.ldap_config
            
        config_keys = [
            {"key": "IS_LDAP_ENABLED", "default": os.environ.get("IS_LDAP_ENABLED", "0")},
            {"key": "LDAP_SERVER_URL", "default": os.environ.get("LDAP_SERVER_URL", "")},
            {"key": "LDAP_PORT", "default": os.environ.get("LDAP_PORT", "389")},
            {"key": "LDAP_BIND_DN", "default": os.environ.get("LDAP_BIND_DN", "")},
            {"key": "LDAP_BIND_PASSWORD", "default": os.environ.get("LDAP_BIND_PASSWORD", "")},
            {"key": "LDAP_BASE_DN", "default": os.environ.get("LDAP_BASE_DN", "")},
            {"key": "LDAP_USER_FILTER", "default": os.environ.get("LDAP_USER_FILTER", "(uid={username})")},
            {"key": "LDAP_USE_SSL", "default": os.environ.get("LDAP_USE_SSL", "0")},
            {"key": "LDAP_ATTR_USERNAME", "default": os.environ.get("LDAP_ATTR_USERNAME", "uid")},
            {"key": "LDAP_ATTR_EMAIL", "default": os.environ.get("LDAP_ATTR_EMAIL", "mail")},
            {"key": "LDAP_ATTR_FIRST_NAME", "default": os.environ.get("LDAP_ATTR_FIRST_NAME", "givenName")},
            {"key": "LDAP_ATTR_LAST_NAME", "default": os.environ.get("LDAP_ATTR_LAST_NAME", "sn")},
        ]
        
        config_values = get_configuration_value(config_keys)
        
        self.ldap_config = {
            "enabled": config_values[0] == "1",
            "server_url": config_values[1],
            "port": int(config_values[2]) if config_values[2] else 389,
            "bind_dn": config_values[3],
            "bind_password": config_values[4],
            "base_dn": config_values[5],
            "user_filter": config_values[6],
            "use_ssl": config_values[7] == "1",
            "attr_username": config_values[8],
            "attr_email": config_values[9],
            "attr_first_name": config_values[10],
            "attr_last_name": config_values[11],
        }
        
        return self.ldap_config
    
    def _validate_configuration(self):
        """Validate LDAP configuration"""
        config = self._get_ldap_configuration()
        
        if not config["enabled"]:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["LDAP_NOT_CONFIGURED"],
                error_message="LDAP_NOT_CONFIGURED",
            )
        
        required_fields = ["server_url", "bind_dn", "bind_password", "base_dn", "user_filter"]
        missing_fields = [field for field in required_fields if not config.get(field)]
        
        if missing_fields:
            self.logger.error(f"LDAP configuration incomplete. Missing: {missing_fields}")
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["LDAP_CONFIGURATION_INCOMPLETE"],
                error_message="LDAP_CONFIGURATION_INCOMPLETE",
            )
    
    def _create_ldap_server(self) -> Server:
        """Create LDAP server connection"""
        config = self._get_ldap_configuration()
        
        # Configure TLS if SSL is enabled
        tls_config = None
        if config["use_ssl"]:
            tls_config = Tls(validate=ssl.CERT_REQUIRED, version=ssl.PROTOCOL_TLSv1_2)
        
        # Create server
        server = Server(
            host=config["server_url"],
            port=config["port"],
            use_ssl=config["use_ssl"],
            tls=tls_config,
            get_info=ALL,
            connect_timeout=10
        )
        
        return server
    
    def _search_user(self, username: str) -> Optional[str]:
        """Search for user DN in LDAP directory"""
        config = self._get_ldap_configuration()
        
        try:
            # Create admin connection for user search
            server = self._create_ldap_server()
            admin_conn = Connection(
                server,
                user=config["bind_dn"],
                password=config["bind_password"],
                authentication=SIMPLE,
                auto_bind=True,
                read_only=True,
                receive_timeout=30
            )
            
            # Prepare search filter
            search_filter = config["user_filter"].format(
                username=username,
                email=username  # Support both username and email
            )
            
            # Search for user
            success = admin_conn.search(
                search_base=config["base_dn"],
                search_filter=search_filter,
                search_scope=ldap3.SUBTREE,
                attributes=[
                    config["attr_username"],
                    config["attr_email"],
                    config["attr_first_name"],
                    config["attr_last_name"]
                ]
            )
            
            if not success or len(admin_conn.entries) == 0:
                self.logger.warning(f"LDAP user not found: {username}")
                admin_conn.unbind()
                return None
            
            if len(admin_conn.entries) > 1:
                self.logger.error(f"Multiple LDAP users found for: {username}")
                admin_conn.unbind()
                raise AuthenticationException(
                    error_code=AUTHENTICATION_ERROR_CODES["LDAP_MULTIPLE_USERS_FOUND"],
                    error_message="LDAP_MULTIPLE_USERS_FOUND",
                )
            
            user_entry = admin_conn.entries[0]
            user_dn = user_entry.entry_dn
            
            # Store user attributes for later use
            self.ldap_user_attributes = {
                "dn": user_dn,
                "username": str(user_entry[config["attr_username"]]) if config["attr_username"] in user_entry else username,
                "email": str(user_entry[config["attr_email"]]) if config["attr_email"] in user_entry else "",
                "first_name": str(user_entry[config["attr_first_name"]]) if config["attr_first_name"] in user_entry else "",
                "last_name": str(user_entry[config["attr_last_name"]]) if config["attr_last_name"] in user_entry else "",
            }
            
            admin_conn.unbind()
            return user_dn
            
        except LDAPException as e:
            self.logger.error(f"LDAP search error: {str(e)}")
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["LDAP_SERVER_UNREACHABLE"],
                error_message="LDAP_SERVER_UNREACHABLE",
            )
    
    def _authenticate_user(self, user_dn: str, password: str) -> bool:
        """Authenticate user against LDAP"""
        try:
            server = self._create_ldap_server()
            user_conn = Connection(
                server,
                user=user_dn,
                password=password,
                authentication=SIMPLE,
                auto_bind=True,
                read_only=True,
                receive_timeout=10
            )
            
            # If we get here, authentication was successful
            user_conn.unbind()
            return True
            
        except LDAPInvalidCredentialsResult:
            self.logger.warning(f"LDAP authentication failed for user: {user_dn}")
            return False
        except LDAPBindError as e:
            self.logger.error(f"LDAP bind error for user {user_dn}: {str(e)}")
            return False
        except LDAPException as e:
            self.logger.error(f"LDAP authentication error: {str(e)}")
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["LDAP_SERVER_UNREACHABLE"],
                error_message="LDAP_SERVER_UNREACHABLE",
            )
    
    def test_connection(self) -> Dict[str, Any]:
        """Test LDAP connection and configuration"""
        try:
            self._validate_configuration()
            config = self._get_ldap_configuration()
            
            # Test server connection
            server = self._create_ldap_server()
            test_conn = Connection(
                server,
                user=config["bind_dn"],
                password=config["bind_password"],
                authentication=SIMPLE,
                auto_bind=True,
                read_only=True,
                receive_timeout=10
            )
            
            # Test search
            test_conn.search(
                search_base=config["base_dn"],
                search_filter="(objectClass=*)",
                search_scope=ldap3.BASE,
                size_limit=1
            )
            
            test_conn.unbind()
            
            return {
                "success": True,
                "message": "Successfully connected to LDAP server",
                "server_info": {
                    "host": config["server_url"],
                    "port": config["port"],
                    "ssl": config["use_ssl"]
                }
            }
            
        except AuthenticationException:
            raise
        except Exception as e:
            self.logger.error(f"LDAP connection test failed: {str(e)}")
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["LDAP_SERVER_UNREACHABLE"],
                error_message="LDAP_SERVER_UNREACHABLE",
            )
    
    def authenticate(self):
        """Main authentication method"""
        if not self.username or not self.password:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["INVALID_CREDENTIALS"],
                error_message="INVALID_CREDENTIALS",
            )
        
        # Validate configuration
        self._validate_configuration()
        
        # Search for user
        user_dn = self._search_user(self.username)
        if not user_dn:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["LDAP_AUTHENTICATION_FAILED"],
                error_message="LDAP_AUTHENTICATION_FAILED",
            )
        
        # Authenticate user
        if not self._authenticate_user(user_dn, self.password):
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["LDAP_AUTHENTICATION_FAILED"],
                error_message="LDAP_AUTHENTICATION_FAILED",
            )
        
        # Set user data from LDAP attributes
        self.set_user_data({
            "email": self.ldap_user_attributes["email"] or f"{self.ldap_user_attributes['username']}@ldap.local",
            "user": {
                "first_name": self.ldap_user_attributes["first_name"],
                "last_name": self.ldap_user_attributes["last_name"],
                "provider_id": self.ldap_user_attributes["dn"],
                "is_password_autoset": True,
                "avatar": "",  # LDAP doesn't provide avatars
            }
        })
        
        self.logger.info(f"LDAP authentication successful for user: {self.username}")
        
        # Complete login/signup process
        return self.complete_login_or_signup()
    
    def create_update_account(self, user):
        """LDAP doesn't use OAuth tokens, so this is a no-op"""
        pass
    
    def get_user_token(self, data, headers=None):
        """Not applicable for LDAP"""
        pass
    
    def get_user_response(self):
        """Not applicable for LDAP"""
        pass