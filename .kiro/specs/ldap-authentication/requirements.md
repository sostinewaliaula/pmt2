# Requirements Document: LDAP/Active Directory Authentication Integration

## Introduction

This document specifies the requirements for integrating LDAP (Lightweight Directory Access Protocol) and Active Directory authentication into Caava Group Project Management (based on Plane.so Community Edition). The integration will enable organizations to authenticate users against their existing LDAP/AD infrastructure, providing centralized user management and single sign-on capabilities. The feature will be configurable through the admin "God Mode" interface, following the existing authentication provider pattern used for OAuth providers (Google, GitHub, GitLab, Gitea).

## Glossary

- **LDAP_System**: The LDAP/Active Directory authentication module being developed
- **LDAP_Server**: The external LDAP or Active Directory server that stores user credentials and attributes
- **Admin_UI**: The God Mode administration interface in the React-based admin application
- **Backend_API**: The Django REST Framework API that handles authentication requests
- **LDAP_Adapter**: The authentication adapter class that implements LDAP authentication logic
- **Configuration_Store**: The InstanceConfiguration model that stores LDAP settings as key-value pairs
- **User_Model**: The Django User model (AUTH_USER_MODEL = "db.User") that represents authenticated users
- **Authentication_Card**: The UI component in God Mode that displays and configures an authentication method
- **Bind_DN**: The Distinguished Name used to authenticate with the LDAP server for user searches
- **Base_DN**: The Distinguished Name that serves as the root for LDAP user searches
- **User_Filter**: The LDAP search filter used to locate user entries (e.g., "(uid={username})")
- **Attribute_Mapping**: The configuration that maps LDAP attributes to User_Model fields
- **LDAPS**: LDAP over SSL/TLS, the secure version of LDAP protocol
- **Connection_Pool**: A pool of reusable LDAP connections to improve performance
- **Pretty_Printer**: A component that formats LDAP configuration objects into human-readable text
- **Parser**: A component that reads and validates LDAP configuration from the Configuration_Store

## Requirements

### Requirement 1: LDAP Server Connection Management

**User Story:** As a system administrator, I want to configure LDAP server connection settings, so that the application can communicate with our organization's directory server.

#### Acceptance Criteria

1. THE Admin_UI SHALL display an LDAP authentication card in the God Mode authentication page
2. THE Authentication_Card SHALL include a toggle switch to enable or disable LDAP authentication
3. THE Authentication_Card SHALL display a configuration form with the following fields: server URL, port, Bind_DN, bind password, Base_DN, user search filter, and SSL/TLS options
4. WHEN an admin saves LDAP configuration, THE Backend_API SHALL validate that the server URL is a valid hostname or IP address
5. WHEN an admin saves LDAP configuration, THE Backend_API SHALL validate that the port is between 1 and 65535
6. WHEN an admin saves LDAP configuration, THE Backend_API SHALL store the bind password in encrypted form in the Configuration_Store
7. THE Configuration_Store SHALL use the is_encrypted flag set to true for the LDAP bind password key
8. WHEN LDAP authentication is enabled, THE LDAP_System SHALL establish connections using the configured server URL and port
9. WHERE SSL/TLS is enabled, THE LDAP_System SHALL connect to the LDAP_Server using LDAPS protocol
10. IF the LDAP_Server connection fails, THEN THE LDAP_System SHALL log the error and return a descriptive error message to the user

### Requirement 2: LDAP User Authentication

**User Story:** As an end user, I want to log in using my LDAP credentials, so that I can access the application without creating a separate password.

#### Acceptance Criteria

1. WHEN a user submits login credentials, THE Backend_API SHALL check if LDAP authentication is enabled
2. WHEN LDAP authentication is enabled, THE LDAP_Adapter SHALL attempt to bind to the LDAP_Server using the user's credentials
3. THE LDAP_Adapter SHALL construct the user's DN by searching the LDAP_Server using the Base_DN and User_Filter
4. WHEN the User_Filter contains "{username}", THE LDAP_Adapter SHALL replace it with the provided username
5. WHEN the User_Filter contains "{email}", THE LDAP_Adapter SHALL replace it with the provided email address
6. WHEN the LDAP bind succeeds, THE LDAP_Adapter SHALL retrieve user attributes from the LDAP_Server
7. WHEN the LDAP bind fails, THE LDAP_Adapter SHALL return an authentication error with code "LDAP_AUTHENTICATION_FAILED"
8. IF the LDAP_Server is unreachable, THEN THE LDAP_System SHALL return an error with code "LDAP_SERVER_UNREACHABLE"
9. WHEN LDAP authentication succeeds, THE LDAP_Adapter SHALL call the complete_login_or_signup method to create or update the User_Model
10. THE LDAP_Adapter SHALL set the user's last_login_medium field to "ldap"

### Requirement 3: User Attribute Mapping and Provisioning

**User Story:** As a system administrator, I want to map LDAP attributes to user profile fields, so that user information is automatically synchronized from our directory.

#### Acceptance Criteria

1. THE Admin_UI SHALL provide configuration fields for mapping LDAP attributes to User_Model fields
2. THE Attribute_Mapping SHALL support mapping for the following fields: username, email, first_name, last_name, and display_name
3. THE Admin_UI SHALL provide default attribute mappings: uid→username, mail→email, givenName→first_name, sn→last_name
4. WHEN a user authenticates via LDAP for the first time, THE LDAP_Adapter SHALL create a new User_Model instance
5. WHEN creating a new user, THE LDAP_Adapter SHALL populate User_Model fields using the Attribute_Mapping configuration
6. WHEN creating a new user, THE LDAP_Adapter SHALL set is_password_autoset to true
7. WHEN creating a new user, THE LDAP_Adapter SHALL set is_email_verified to true
8. WHEN creating a new user, THE LDAP_Adapter SHALL generate a random password using uuid.uuid4().hex
9. WHEN an existing LDAP user logs in, THE LDAP_Adapter SHALL update the User_Model fields with current LDAP attributes
10. IF an LDAP attribute specified in Attribute_Mapping is missing, THEN THE LDAP_Adapter SHALL use an empty string for that field

### Requirement 4: LDAP Configuration Validation and Testing

**User Story:** As a system administrator, I want to test the LDAP connection before saving, so that I can verify the configuration is correct.

#### Acceptance Criteria

1. THE Admin_UI SHALL display a "Test Connection" button in the LDAP configuration form
2. WHEN an admin clicks "Test Connection", THE Backend_API SHALL attempt to bind to the LDAP_Server using the provided Bind_DN and password
3. WHEN the test connection succeeds, THE Admin_UI SHALL display a success message with the text "Successfully connected to LDAP server"
4. WHEN the test connection fails, THE Admin_UI SHALL display an error message describing the failure reason
5. THE Backend_API SHALL validate that Base_DN is a valid Distinguished Name format before saving
6. THE Backend_API SHALL validate that Bind_DN is a valid Distinguished Name format before saving
7. THE Backend_API SHALL validate that User_Filter contains at least one of "{username}" or "{email}" placeholders
8. IF the User_Filter is invalid, THEN THE Backend_API SHALL return an error with code "INVALID_LDAP_FILTER"
9. WHEN saving LDAP configuration, THE Backend_API SHALL verify that all required fields (server URL, port, Bind_DN, bind password, Base_DN, User_Filter) are provided
10. IF any required field is missing, THEN THE Backend_API SHALL return an error with code "LDAP_CONFIGURATION_INCOMPLETE"

### Requirement 5: LDAP Configuration Parser and Serialization

**User Story:** As a developer, I want to parse and serialize LDAP configuration reliably, so that configuration data is correctly stored and retrieved.

#### Acceptance Criteria

1. THE Parser SHALL read LDAP configuration from the Configuration_Store key-value pairs
2. THE Parser SHALL decrypt the bind password using the is_encrypted flag
3. THE Parser SHALL validate that all required configuration keys exist before returning the configuration object
4. THE Pretty_Printer SHALL format LDAP configuration objects into JSON format for storage in Configuration_Store
5. THE Pretty_Printer SHALL ensure the bind password is marked for encryption before storage
6. FOR ALL valid LDAP configuration objects, parsing then printing then parsing SHALL produce an equivalent object (round-trip property)
7. WHEN the Parser encounters an invalid configuration key, THE Parser SHALL return an error with code "INVALID_LDAP_CONFIG_KEY"
8. WHEN the Pretty_Printer receives a configuration object with missing required fields, THE Pretty_Printer SHALL return an error with code "INCOMPLETE_LDAP_CONFIG"
9. THE Parser SHALL support the following configuration keys: LDAP_SERVER_URL, LDAP_PORT, LDAP_BIND_DN, LDAP_BIND_PASSWORD, LDAP_BASE_DN, LDAP_USER_FILTER, LDAP_USE_SSL, LDAP_ATTR_USERNAME, LDAP_ATTR_EMAIL, LDAP_ATTR_FIRST_NAME, LDAP_ATTR_LAST_NAME
10. THE Pretty_Printer SHALL preserve all configuration values without modification during serialization

### Requirement 6: Security and Credential Protection

**User Story:** As a security officer, I want LDAP credentials to be securely stored and transmitted, so that our directory server is protected from unauthorized access.

#### Acceptance Criteria

1. THE Backend_API SHALL store the LDAP bind password in encrypted form in the Configuration_Store
2. THE Backend_API SHALL never log the LDAP bind password in plain text
3. THE Backend_API SHALL never return the LDAP bind password in API responses
4. WHERE SSL/TLS is enabled, THE LDAP_System SHALL verify the LDAP_Server certificate
5. WHERE SSL/TLS is enabled, THE LDAP_System SHALL reject connections with invalid certificates
6. THE LDAP_System SHALL use secure password hashing (bcrypt or PBKDF2) for any locally stored credentials
7. WHEN an LDAP connection is established, THE LDAP_System SHALL use the Connection_Pool to reuse connections
8. WHEN an LDAP connection is idle for more than 300 seconds, THE Connection_Pool SHALL close the connection
9. THE LDAP_System SHALL set a connection timeout of 10 seconds for LDAP_Server connections
10. THE LDAP_System SHALL set a search timeout of 30 seconds for LDAP user searches

### Requirement 7: Error Handling and Logging

**User Story:** As a system administrator, I want detailed error messages and logs for LDAP authentication failures, so that I can troubleshoot configuration issues.

#### Acceptance Criteria

1. WHEN an LDAP authentication fails, THE LDAP_System SHALL log the failure with the error code and username (but not password)
2. WHEN an LDAP_Server connection fails, THE LDAP_System SHALL log the server URL, port, and error message
3. THE LDAP_System SHALL return user-friendly error messages for common failures: invalid credentials, server unreachable, configuration error
4. IF the LDAP_Server returns an error code, THEN THE LDAP_System SHALL include the LDAP error code in the log message
5. THE LDAP_System SHALL log successful LDAP authentications with the username and timestamp
6. THE LDAP_System SHALL use the Django logging framework with logger name "plane.authentication.ldap"
7. WHEN an LDAP search returns no results, THE LDAP_System SHALL log a warning with the search filter and Base_DN
8. WHEN an LDAP search returns multiple results, THE LDAP_System SHALL log an error and reject the authentication
9. THE LDAP_System SHALL log LDAP connection pool statistics (active connections, idle connections) every 60 seconds
10. IF an unexpected exception occurs during LDAP authentication, THEN THE LDAP_System SHALL log the full stack trace using log_exception

### Requirement 8: Admin UI Integration

**User Story:** As a system administrator, I want the LDAP configuration interface to match the existing authentication provider UI, so that the experience is consistent.

#### Acceptance Criteria

1. THE Admin_UI SHALL add LDAP to the authentication modes list returned by useAuthenticationModes hook
2. THE LDAP Authentication_Card SHALL display an icon representing LDAP (a directory or server icon)
3. THE LDAP Authentication_Card SHALL display the name "LDAP / Active Directory"
4. THE LDAP Authentication_Card SHALL display the description "Allow members to log in with their LDAP or Active Directory credentials"
5. THE LDAP configuration component SHALL follow the same pattern as GoogleConfiguration, GithubConfiguration components
6. THE LDAP configuration component SHALL use the ToggleSwitch component for the enable/disable toggle
7. THE LDAP configuration component SHALL use the updateConfig callback to save configuration changes
8. WHEN LDAP is the only enabled authentication method, THE Admin_UI SHALL prevent disabling LDAP
9. THE Admin_UI SHALL display the LDAP Authentication_Card in the same list as other authentication methods
10. THE LDAP configuration form SHALL use the same styling and layout as other authentication configuration forms

### Requirement 9: Fallback and Mixed Authentication

**User Story:** As a system administrator, I want to enable multiple authentication methods simultaneously, so that users can choose their preferred login method.

#### Acceptance Criteria

1. THE Backend_API SHALL support enabling LDAP authentication alongside other authentication methods (email/password, OAuth)
2. WHEN multiple authentication methods are enabled, THE Backend_API SHALL attempt LDAP authentication first for users with LDAP accounts
3. WHEN LDAP authentication fails, THE Backend_API SHALL fall back to other enabled authentication methods
4. THE User_Model SHALL track the authentication method used for each login via the last_login_medium field
5. WHEN a user has both LDAP and local credentials, THE Backend_API SHALL prioritize LDAP authentication
6. THE Admin_UI SHALL allow admins to enable or disable LDAP independently of other authentication methods
7. WHEN LDAP is disabled, THE Backend_API SHALL not attempt LDAP authentication for any users
8. THE Backend_API SHALL ensure at least one authentication method remains enabled at all times
9. WHEN an admin attempts to disable the last enabled authentication method, THE Admin_UI SHALL display an error message
10. THE Backend_API SHALL validate that at least one authentication method is enabled before saving configuration changes

### Requirement 10: Performance and Scalability

**User Story:** As a system architect, I want LDAP authentication to perform efficiently under load, so that user login times remain acceptable.

#### Acceptance Criteria

1. THE LDAP_System SHALL use a Connection_Pool with a minimum of 2 and maximum of 10 concurrent connections
2. THE LDAP_System SHALL reuse LDAP connections from the Connection_Pool for multiple authentication requests
3. WHEN the Connection_Pool is exhausted, THE LDAP_System SHALL queue authentication requests with a timeout of 5 seconds
4. THE LDAP_System SHALL cache successful LDAP user searches for 60 seconds to reduce LDAP_Server load
5. THE LDAP_System SHALL invalidate the user search cache when a user's attributes are updated
6. THE LDAP_System SHALL complete user authentication within 2 seconds under normal conditions (95th percentile)
7. THE LDAP_System SHALL handle at least 50 concurrent authentication requests without degradation
8. THE LDAP_System SHALL implement exponential backoff for LDAP_Server connection retries (1s, 2s, 4s)
9. WHEN the LDAP_Server is unreachable, THE LDAP_System SHALL fail fast after 3 retry attempts
10. THE LDAP_System SHALL monitor and log LDAP authentication latency metrics (p50, p95, p99)

### Requirement 11: LDAP Group Mapping (Optional)

**User Story:** As a system administrator, I want to map LDAP groups to workspace roles, so that user permissions are automatically assigned based on directory group membership.

#### Acceptance Criteria

1. THE Admin_UI SHALL provide an optional configuration section for LDAP group mappings
2. THE Admin_UI SHALL allow admins to specify an LDAP group attribute (default: "memberOf")
3. THE Admin_UI SHALL allow admins to define mappings from LDAP group DNs to workspace roles
4. WHEN a user authenticates via LDAP, THE LDAP_Adapter SHALL retrieve the user's group memberships
5. WHEN a user authenticates via LDAP, THE LDAP_Adapter SHALL apply workspace role assignments based on group mappings
6. THE LDAP_Adapter SHALL support multiple group mappings per user
7. WHEN a user's LDAP groups change, THE LDAP_Adapter SHALL update workspace role assignments on next login
8. THE LDAP_Adapter SHALL log group mapping operations for audit purposes
9. WHERE group mapping is not configured, THE LDAP_Adapter SHALL skip group synchronization
10. THE LDAP_Adapter SHALL handle missing or invalid group attributes gracefully without failing authentication

### Requirement 12: LDAP Adapter Implementation

**User Story:** As a developer, I want the LDAP adapter to follow the existing authentication adapter pattern, so that it integrates seamlessly with the authentication framework.

#### Acceptance Criteria

1. THE LDAP_Adapter SHALL extend the base Adapter class from plane.authentication.adapter.base
2. THE LDAP_Adapter SHALL implement the authenticate() method to perform LDAP authentication
3. THE LDAP_Adapter SHALL implement the set_user_data() method to populate user data from LDAP attributes
4. THE LDAP_Adapter SHALL call complete_login_or_signup() to create or update the User_Model
5. THE LDAP_Adapter SHALL use the sanitize_email() method from the base Adapter class
6. THE LDAP_Adapter SHALL set the provider field to "ldap"
7. THE LDAP_Adapter SHALL not implement create_update_account() since LDAP does not use OAuth tokens
8. THE LDAP_Adapter SHALL use the django-auth-ldap or ldap3 Python library for LDAP operations
9. THE LDAP_Adapter SHALL be located in apps/api/plane/authentication/adapter/ldap.py
10. THE LDAP_Adapter SHALL follow the same error handling pattern as OauthAdapter

### Requirement 13: Configuration Keys and Storage

**User Story:** As a developer, I want LDAP configuration to be stored consistently with other authentication providers, so that configuration management is unified.

#### Acceptance Criteria

1. THE Configuration_Store SHALL use the key "IS_LDAP_ENABLED" to store the LDAP enabled/disabled state
2. THE Configuration_Store SHALL use the key "LDAP_SERVER_URL" to store the LDAP server hostname or IP
3. THE Configuration_Store SHALL use the key "LDAP_PORT" to store the LDAP server port number
4. THE Configuration_Store SHALL use the key "LDAP_BIND_DN" to store the bind DN for LDAP searches
5. THE Configuration_Store SHALL use the key "LDAP_BIND_PASSWORD" to store the encrypted bind password
6. THE Configuration_Store SHALL use the key "LDAP_BASE_DN" to store the base DN for user searches
7. THE Configuration_Store SHALL use the key "LDAP_USER_FILTER" to store the LDAP search filter template
8. THE Configuration_Store SHALL use the key "LDAP_USE_SSL" to store the SSL/TLS enabled state
9. THE Configuration_Store SHALL use keys "LDAP_ATTR_USERNAME", "LDAP_ATTR_EMAIL", "LDAP_ATTR_FIRST_NAME", "LDAP_ATTR_LAST_NAME" for attribute mappings
10. THE Configuration_Store SHALL set the category field to "authentication" for all LDAP configuration keys

### Requirement 14: Docker Deployment Compatibility

**User Story:** As a DevOps engineer, I want LDAP authentication to work in Docker deployments, so that it can be used in containerized environments.

#### Acceptance Criteria

1. THE LDAP_System SHALL support configuration via environment variables as fallback to Configuration_Store
2. THE LDAP_System SHALL read environment variables LDAP_SERVER_URL, LDAP_PORT, LDAP_BIND_DN, LDAP_BIND_PASSWORD, LDAP_BASE_DN, LDAP_USER_FILTER
3. THE LDAP_System SHALL prioritize Configuration_Store values over environment variables
4. THE LDAP_System SHALL include the ldap3 or django-auth-ldap library in requirements/base.txt
5. THE LDAP_System SHALL not require additional system packages beyond Python dependencies
6. THE LDAP_System SHALL work with the existing Docker Compose configuration without modifications
7. THE LDAP_System SHALL support LDAP servers accessible via Docker network names
8. THE LDAP_System SHALL handle DNS resolution for LDAP server hostnames in Docker environments
9. THE LDAP_System SHALL log LDAP connection attempts with resolved IP addresses for debugging
10. THE LDAP_System SHALL support both IPv4 and IPv6 LDAP server addresses

### Requirement 15: Authentication Flow Integration

**User Story:** As a developer, I want LDAP authentication to integrate with the existing authentication views, so that no changes are needed to the login API.

#### Acceptance Criteria

1. THE Backend_API SHALL add LDAP authentication logic to the existing login view in apps/api/plane/authentication/views/
2. THE Backend_API SHALL check the IS_LDAP_ENABLED configuration before attempting LDAP authentication
3. WHEN LDAP is enabled and credentials are provided, THE Backend_API SHALL instantiate the LDAP_Adapter
4. THE Backend_API SHALL pass the request, username/email, and password to the LDAP_Adapter
5. THE Backend_API SHALL handle AuthenticationException raised by the LDAP_Adapter
6. THE Backend_API SHALL return appropriate HTTP status codes for LDAP authentication failures (401 for invalid credentials, 503 for server unreachable)
7. THE Backend_API SHALL maintain backward compatibility with existing authentication methods
8. THE Backend_API SHALL not modify the authentication response format for LDAP users
9. THE Backend_API SHALL set the same session cookies for LDAP users as for other authentication methods
10. THE Backend_API SHALL call the same callback functions for LDAP users as for other authentication methods

## Correctness Properties for Testing

### Property 1: Round-Trip Configuration Serialization
**Type:** Round Trip Property  
**Description:** Parsing and then printing LDAP configuration should produce an equivalent configuration object.  
**Test:** FOR ALL valid LDAP configuration objects C, Parser(Pretty_Printer(C)) == C

### Property 2: Authentication Idempotence
**Type:** Idempotence Property  
**Description:** Authenticating the same user multiple times with valid credentials should produce the same User_Model state.  
**Test:** FOR ALL valid LDAP users U, authenticate(U) produces the same User_Model fields when called multiple times

### Property 3: Configuration Validation Invariant
**Type:** Invariant Property  
**Description:** The Configuration_Store should never contain LDAP configuration with missing required fields when IS_LDAP_ENABLED is true.  
**Test:** WHEN IS_LDAP_ENABLED == "1", THEN all required configuration keys (LDAP_SERVER_URL, LDAP_PORT, LDAP_BIND_DN, LDAP_BIND_PASSWORD, LDAP_BASE_DN, LDAP_USER_FILTER) must exist in Configuration_Store

### Property 4: Password Encryption Invariant
**Type:** Invariant Property  
**Description:** The LDAP bind password should always be stored in encrypted form.  
**Test:** FOR ALL LDAP_BIND_PASSWORD entries in Configuration_Store, is_encrypted == true

### Property 5: Attribute Mapping Preservation
**Type:** Metamorphic Property  
**Description:** The number of mapped attributes should never exceed the number of available LDAP attributes.  
**Test:** FOR ALL LDAP user searches, len(mapped_attributes) <= len(ldap_attributes)

### Property 6: Authentication Method Invariant
**Type:** Invariant Property  
**Description:** At least one authentication method must remain enabled at all times.  
**Test:** FOR ALL configuration updates, count(enabled_auth_methods) >= 1

### Property 7: Connection Pool Bounds
**Type:** Invariant Property  
**Description:** The number of active LDAP connections should never exceed the maximum pool size.  
**Test:** FOR ALL time points T, active_connections(T) <= MAX_POOL_SIZE (10)

### Property 8: User Filter Substitution
**Type:** Model-Based Property  
**Description:** User filter substitution should replace all placeholders with actual values.  
**Test:** FOR ALL User_Filter strings F and usernames U, substitute(F, U) should contain no "{username}" or "{email}" placeholders

### Property 9: Error Code Consistency
**Type:** Invariant Property  
**Description:** LDAP authentication errors should always return one of the defined error codes.  
**Test:** FOR ALL LDAP authentication failures, error_code IN ["LDAP_AUTHENTICATION_FAILED", "LDAP_SERVER_UNREACHABLE", "LDAP_CONFIGURATION_INCOMPLETE", "INVALID_LDAP_FILTER", "INVALID_LDAP_CONFIG_KEY", "INCOMPLETE_LDAP_CONFIG"]

### Property 10: Timeout Bounds
**Type:** Invariant Property  
**Description:** LDAP operations should complete within specified timeout bounds.  
**Test:** FOR ALL LDAP authentication attempts, authentication_time <= 2000ms (95th percentile) AND connection_timeout == 10s AND search_timeout == 30s
