# LDAP/Active Directory Authentication Setup

This guide explains how to configure LDAP/Active Directory authentication in Caava Group Project Management.

## Features

✅ **LDAP/Active Directory Support** - Authenticate against LDAP or AD servers  
✅ **SSL/TLS Support** - Secure LDAPS connections  
✅ **Automatic User Provisioning** - Users are created on first login  
✅ **Attribute Mapping** - Map LDAP attributes to user fields  
✅ **Mixed Authentication** - Use LDAP alongside other auth methods  
✅ **Admin UI Configuration** - Configure via God Mode interface  
✅ **Connection Testing** - Test LDAP connection before saving  
✅ **Fallback Support** - Falls back to other auth methods if LDAP fails  

## Configuration

### 1. Via Admin UI (Recommended)

1. Access God Mode: `http://your-domain/god-mode/`
2. Navigate to **Authentication** settings
3. Find **LDAP / Active Directory** section
4. Toggle **Enable LDAP authentication**
5. Fill in the configuration:

#### Required Fields:
- **Server URL**: `ldap.company.com` or `192.168.1.100`
- **Port**: `389` (LDAP) or `636` (LDAPS)
- **Bind DN**: `cn=admin,dc=company,dc=com`
- **Bind Password**: Password for the bind user
- **Base DN**: `ou=users,dc=company,dc=com`
- **User Filter**: `(uid={username})` or `(sAMAccountName={username})`

#### Optional Settings:
- **Use SSL/TLS**: Enable for secure connections
- **Attribute Mapping**: Map LDAP attributes to user fields

6. Click **Test Connection** to verify settings
7. Save configuration

### 2. Via Environment Variables

Add these to your `.env` file:

```bash
# Enable LDAP
IS_LDAP_ENABLED=1

# Server Configuration
LDAP_SERVER_URL=ldap.company.com
LDAP_PORT=389
LDAP_USE_SSL=0

# Authentication
LDAP_BIND_DN=cn=admin,dc=company,dc=com
LDAP_BIND_PASSWORD=your_bind_password

# User Search
LDAP_BASE_DN=ou=users,dc=company,dc=com
LDAP_USER_FILTER=(uid={username})

# Attribute Mapping
LDAP_ATTR_USERNAME=uid
LDAP_ATTR_EMAIL=mail
LDAP_ATTR_FIRST_NAME=givenName
LDAP_ATTR_LAST_NAME=sn
```

## Common Configurations

### Active Directory (Windows)

```bash
LDAP_SERVER_URL=ad.company.com
LDAP_PORT=389
LDAP_USE_SSL=0
LDAP_BIND_DN=cn=Administrator,cn=Users,dc=company,dc=com
LDAP_BASE_DN=cn=Users,dc=company,dc=com
LDAP_USER_FILTER=(sAMAccountName={username})
LDAP_ATTR_USERNAME=sAMAccountName
LDAP_ATTR_EMAIL=mail
LDAP_ATTR_FIRST_NAME=givenName
LDAP_ATTR_LAST_NAME=sn
```

### OpenLDAP

```bash
LDAP_SERVER_URL=ldap.company.com
LDAP_PORT=389
LDAP_USE_SSL=0
LDAP_BIND_DN=cn=admin,dc=company,dc=com
LDAP_BASE_DN=ou=people,dc=company,dc=com
LDAP_USER_FILTER=(uid={username})
LDAP_ATTR_USERNAME=uid
LDAP_ATTR_EMAIL=mail
LDAP_ATTR_FIRST_NAME=givenName
LDAP_ATTR_LAST_NAME=sn
```

### LDAPS (Secure)

```bash
LDAP_SERVER_URL=ldaps.company.com
LDAP_PORT=636
LDAP_USE_SSL=1
# ... other settings same as above
```

## User Filter Examples

The user filter determines how users are found in LDAP. Use `{username}` or `{email}` placeholders:

- **By Username**: `(uid={username})`
- **By Email**: `(mail={email})`
- **Active Directory**: `(sAMAccountName={username})`
- **Both Username/Email**: `(|(uid={username})(mail={username}))`

## Authentication Flow

1. User enters username/email and password
2. If LDAP is enabled, system tries LDAP authentication first
3. System searches for user in LDAP using the user filter
4. If user found, system attempts to bind with user's credentials
5. On successful authentication:
   - User is created in Caava if first login
   - User attributes are synchronized from LDAP
   - User is logged into Caava
6. If LDAP fails, system falls back to other enabled auth methods

## Troubleshooting

### Connection Issues

1. **Test Connection**: Use the "Test Connection" button in Admin UI
2. **Check Network**: Ensure LDAP server is reachable from Caava server
3. **Verify Credentials**: Ensure bind DN and password are correct
4. **Check SSL**: If using SSL, ensure certificates are valid

### Authentication Issues

1. **Check User Filter**: Ensure filter matches your LDAP schema
2. **Verify Base DN**: Ensure users exist under the specified base DN
3. **Check Attributes**: Ensure mapped attributes exist in LDAP
4. **Review Logs**: Check Caava logs for detailed error messages

### Common Errors

- **LDAP_SERVER_UNREACHABLE**: Check server URL and network connectivity
- **LDAP_AUTHENTICATION_FAILED**: Check user credentials and user filter
- **LDAP_CONFIGURATION_INCOMPLETE**: Ensure all required fields are filled
- **LDAP_MULTIPLE_USERS_FOUND**: User filter returns multiple results

## Security Considerations

1. **Use SSL/TLS**: Enable LDAPS for production environments
2. **Bind User Permissions**: Use a dedicated bind user with minimal permissions
3. **Network Security**: Restrict LDAP server access to Caava server only
4. **Password Storage**: Bind passwords are encrypted in the database
5. **Audit Logs**: Monitor LDAP authentication attempts

## API Endpoints

- **Authentication**: `POST /auth/ldap/`
- **Test Connection**: `POST /auth/ldap/test-connection/`

## Mixed Authentication

LDAP can be used alongside other authentication methods:

1. LDAP authentication is tried first (if enabled)
2. If LDAP fails, system tries other enabled methods
3. Users can have both LDAP and local accounts
4. LDAP users are identified by `last_login_medium = "ldap"`

## Migration Notes

When upgrading to include LDAP support:

1. Run database migrations: `python manage.py migrate`
2. Restart all services
3. Configure LDAP via Admin UI
4. Test with a few users before full rollout

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Caava logs for detailed error messages
3. Test connection using the Admin UI
4. Verify LDAP server configuration independently