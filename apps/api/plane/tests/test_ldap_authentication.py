# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import unittest
from unittest.mock import Mock, patch, MagicMock

# Django imports
from django.test import TestCase, RequestFactory
from django.contrib.auth import get_user_model

# Module imports
from plane.authentication.adapter.ldap import LDAPAdapter
from plane.authentication.adapter.error import AuthenticationException, AUTHENTICATION_ERROR_CODES
from plane.license.models import InstanceConfiguration

User = get_user_model()


class LDAPAdapterTestCase(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.request = self.factory.post('/auth/ldap/')
        
        # Create LDAP configuration
        self.ldap_configs = [
            {"key": "IS_LDAP_ENABLED", "value": "1", "category": "authentication", "is_encrypted": False},
            {"key": "LDAP_SERVER_URL", "value": "ldap.test.com", "category": "authentication", "is_encrypted": False},
            {"key": "LDAP_PORT", "value": "389", "category": "authentication", "is_encrypted": False},
            {"key": "LDAP_BIND_DN", "value": "cn=admin,dc=test,dc=com", "category": "authentication", "is_encrypted": False},
            {"key": "LDAP_BIND_PASSWORD", "value": "password", "category": "authentication", "is_encrypted": True},
            {"key": "LDAP_BASE_DN", "value": "ou=users,dc=test,dc=com", "category": "authentication", "is_encrypted": False},
            {"key": "LDAP_USER_FILTER", "value": "(uid={username})", "category": "authentication", "is_encrypted": False},
            {"key": "LDAP_USE_SSL", "value": "0", "category": "authentication", "is_encrypted": False},
            {"key": "LDAP_ATTR_USERNAME", "value": "uid", "category": "authentication", "is_encrypted": False},
            {"key": "LDAP_ATTR_EMAIL", "value": "mail", "category": "authentication", "is_encrypted": False},
            {"key": "LDAP_ATTR_FIRST_NAME", "value": "givenName", "category": "authentication", "is_encrypted": False},
            {"key": "LDAP_ATTR_LAST_NAME", "value": "sn", "category": "authentication", "is_encrypted": False},
        ]
        
        for config in self.ldap_configs:
            InstanceConfiguration.objects.get_or_create(
                key=config["key"],
                defaults={
                    "value": config["value"],
                    "category": config["category"],
                    "is_encrypted": config["is_encrypted"],
                }
            )

    def test_ldap_adapter_initialization(self):
        """Test LDAP adapter can be initialized"""
        adapter = LDAPAdapter(
            request=self.request,
            username="testuser",
            password="testpass"
        )
        
        self.assertEqual(adapter.provider, "ldap")
        self.assertEqual(adapter.username, "testuser")
        self.assertEqual(adapter.password, "testpass")

    def test_get_ldap_configuration(self):
        """Test LDAP configuration retrieval"""
        adapter = LDAPAdapter(
            request=self.request,
            username="testuser",
            password="testpass"
        )
        
        config = adapter._get_ldap_configuration()
        
        self.assertTrue(config["enabled"])
        self.assertEqual(config["server_url"], "ldap.test.com")
        self.assertEqual(config["port"], 389)
        self.assertEqual(config["bind_dn"], "cn=admin,dc=test,dc=com")
        self.assertEqual(config["base_dn"], "ou=users,dc=test,dc=com")

    def test_validate_configuration_missing_fields(self):
        """Test configuration validation with missing fields"""
        # Remove required configuration
        InstanceConfiguration.objects.filter(key="LDAP_SERVER_URL").update(value="")
        
        adapter = LDAPAdapter(
            request=self.request,
            username="testuser",
            password="testpass"
        )
        
        with self.assertRaises(AuthenticationException) as context:
            adapter._validate_configuration()
        
        self.assertEqual(
            context.exception.error_code,
            AUTHENTICATION_ERROR_CODES["LDAP_CONFIGURATION_INCOMPLETE"]
        )

    def test_validate_configuration_disabled(self):
        """Test configuration validation when LDAP is disabled"""
        InstanceConfiguration.objects.filter(key="IS_LDAP_ENABLED").update(value="0")
        
        adapter = LDAPAdapter(
            request=self.request,
            username="testuser",
            password="testpass"
        )
        
        with self.assertRaises(AuthenticationException) as context:
            adapter._validate_configuration()
        
        self.assertEqual(
            context.exception.error_code,
            AUTHENTICATION_ERROR_CODES["LDAP_NOT_CONFIGURED"]
        )

    @patch('plane.authentication.adapter.ldap.Connection')
    @patch('plane.authentication.adapter.ldap.Server')
    def test_search_user_success(self, mock_server, mock_connection):
        """Test successful user search"""
        # Mock LDAP server and connection
        mock_server_instance = Mock()
        mock_server.return_value = mock_server_instance
        
        mock_conn_instance = Mock()
        mock_connection.return_value = mock_conn_instance
        mock_conn_instance.search.return_value = True
        
        # Mock user entry
        mock_entry = Mock()
        mock_entry.entry_dn = "uid=testuser,ou=users,dc=test,dc=com"
        mock_entry.__getitem__ = Mock(side_effect=lambda key: {
            "uid": ["testuser"],
            "mail": ["testuser@test.com"],
            "givenName": ["Test"],
            "sn": ["User"]
        }.get(key, []))
        mock_entry.__contains__ = Mock(side_effect=lambda key: key in ["uid", "mail", "givenName", "sn"])
        
        mock_conn_instance.entries = [mock_entry]
        
        adapter = LDAPAdapter(
            request=self.request,
            username="testuser",
            password="testpass"
        )
        
        user_dn = adapter._search_user("testuser")
        
        self.assertEqual(user_dn, "uid=testuser,ou=users,dc=test,dc=com")
        self.assertEqual(adapter.ldap_user_attributes["email"], "testuser@test.com")
        self.assertEqual(adapter.ldap_user_attributes["first_name"], "Test")
        self.assertEqual(adapter.ldap_user_attributes["last_name"], "User")

    @patch('plane.authentication.adapter.ldap.Connection')
    @patch('plane.authentication.adapter.ldap.Server')
    def test_search_user_not_found(self, mock_server, mock_connection):
        """Test user search when user is not found"""
        # Mock LDAP server and connection
        mock_server_instance = Mock()
        mock_server.return_value = mock_server_instance
        
        mock_conn_instance = Mock()
        mock_connection.return_value = mock_conn_instance
        mock_conn_instance.search.return_value = True
        mock_conn_instance.entries = []  # No users found
        
        adapter = LDAPAdapter(
            request=self.request,
            username="nonexistent",
            password="testpass"
        )
        
        user_dn = adapter._search_user("nonexistent")
        
        self.assertIsNone(user_dn)

    @patch('plane.authentication.adapter.ldap.Connection')
    @patch('plane.authentication.adapter.ldap.Server')
    def test_authenticate_user_success(self, mock_server, mock_connection):
        """Test successful user authentication"""
        # Mock LDAP server and connection
        mock_server_instance = Mock()
        mock_server.return_value = mock_server_instance
        
        mock_conn_instance = Mock()
        mock_connection.return_value = mock_conn_instance
        
        adapter = LDAPAdapter(
            request=self.request,
            username="testuser",
            password="testpass"
        )
        
        result = adapter._authenticate_user("uid=testuser,ou=users,dc=test,dc=com", "testpass")
        
        self.assertTrue(result)

    def test_authenticate_missing_credentials(self):
        """Test authentication with missing credentials"""
        adapter = LDAPAdapter(
            request=self.request,
            username="",
            password=""
        )
        
        with self.assertRaises(AuthenticationException) as context:
            adapter.authenticate()
        
        self.assertEqual(
            context.exception.error_code,
            AUTHENTICATION_ERROR_CODES["INVALID_CREDENTIALS"]
        )

    @patch('plane.authentication.adapter.ldap.LDAPAdapter._search_user')
    @patch('plane.authentication.adapter.ldap.LDAPAdapter._authenticate_user')
    @patch('plane.authentication.adapter.ldap.LDAPAdapter.complete_login_or_signup')
    def test_authenticate_success_flow(self, mock_complete_login, mock_auth_user, mock_search_user):
        """Test complete authentication success flow"""
        # Mock successful user search
        mock_search_user.return_value = "uid=testuser,ou=users,dc=test,dc=com"
        
        # Mock successful authentication
        mock_auth_user.return_value = True
        
        # Mock user creation/login
        mock_user = Mock()
        mock_user.id = "123"
        mock_user.email = "testuser@test.com"
        mock_complete_login.return_value = mock_user
        
        adapter = LDAPAdapter(
            request=self.request,
            username="testuser",
            password="testpass"
        )
        
        # Set up user attributes (normally done by _search_user)
        adapter.ldap_user_attributes = {
            "dn": "uid=testuser,ou=users,dc=test,dc=com",
            "username": "testuser",
            "email": "testuser@test.com",
            "first_name": "Test",
            "last_name": "User",
        }
        
        result = adapter.authenticate()
        
        self.assertEqual(result, mock_user)
        mock_search_user.assert_called_once_with("testuser")
        mock_auth_user.assert_called_once_with("uid=testuser,ou=users,dc=test,dc=com", "testpass")
        mock_complete_login.assert_called_once()

    def tearDown(self):
        """Clean up test data"""
        InstanceConfiguration.objects.filter(
            key__in=[config["key"] for config in self.ldap_configs]
        ).delete()