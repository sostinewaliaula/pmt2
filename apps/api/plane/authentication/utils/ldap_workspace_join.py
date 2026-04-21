# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.utils import timezone
from django.urls import resolve
from urllib.parse import urlparse

# Module imports
from plane.db.models import Workspace, WorkspaceMember
from plane.utils.cache import invalidate_cache_directly
from plane.bgtasks.event_tracking_task import track_event
from plane.utils.analytics_events import USER_JOINED_WORKSPACE
from plane.license.utils.instance_value import get_configuration_value


def process_ldap_workspace_membership(user, request):
    """
    Automatically add LDAP users to workspaces based on the URL they're accessing
    and LDAP configuration settings
    """
    
    # Get LDAP auto-join configuration (we'll add this as a new setting)
    (LDAP_AUTO_JOIN_WORKSPACE,) = get_configuration_value([
        {"key": "LDAP_AUTO_JOIN_WORKSPACE", "default": "1"}  # Default: enabled
    ])
    
    if LDAP_AUTO_JOIN_WORKSPACE != "1":
        return
    
    # Extract workspace slug from the request
    workspace_slug = None
    
    # Check if there's a next_path parameter that contains workspace info
    next_path = request.POST.get("next_path") or request.GET.get("next_path")
    if next_path:
        # Extract workspace slug from paths like "/caava-group" or "/caava-group/projects"
        path_parts = next_path.strip("/").split("/")
        if path_parts and path_parts[0]:
            workspace_slug = path_parts[0]
    
    # If no workspace slug found, try to extract from referer
    if not workspace_slug:
        referer = request.META.get('HTTP_REFERER')
        if referer:
            try:
                parsed_url = urlparse(referer)
                path_parts = parsed_url.path.strip("/").split("/")
                if path_parts and path_parts[0]:
                    workspace_slug = path_parts[0]
            except:
                pass
    
    if not workspace_slug:
        return
    
    try:
        # Find the workspace
        workspace = Workspace.objects.get(slug=workspace_slug)
        
        # Check if user is already a member
        if WorkspaceMember.objects.filter(workspace=workspace, member=user).exists():
            return
        
        # Get default role for LDAP users (we'll add this as a configuration)
        (LDAP_DEFAULT_ROLE,) = get_configuration_value([
            {"key": "LDAP_DEFAULT_ROLE", "default": "15"}  # Default: Member role (15)
        ])
        
        # Add user to workspace
        workspace_member = WorkspaceMember.objects.create(
            workspace=workspace,
            member=user,
            role=int(LDAP_DEFAULT_ROLE),
        )
        
        # Invalidate cache
        invalidate_cache_directly(
            path=f"/api/workspaces/{workspace.slug}/members/",
            url_params=False,
            user=False,
            multiple=True,
        )
        
        # Track the event
        track_event.delay(
            user_id=user.id,
            event_name=USER_JOINED_WORKSPACE,
            slug=workspace.slug,
            event_properties={
                "user_id": user.id,
                "workspace_id": workspace.id,
                "workspace_slug": workspace.slug,
                "role": int(LDAP_DEFAULT_ROLE),
                "joined_at": str(timezone.now().isoformat()),
                "join_method": "ldap_auto_join",
            },
        )
        
        print(f"LDAP user {user.email} automatically added to workspace {workspace.slug}")
        
    except Workspace.DoesNotExist:
        print(f"Workspace {workspace_slug} not found for LDAP user {user.email}")
    except Exception as e:
        print(f"Error adding LDAP user {user.email} to workspace {workspace_slug}: {str(e)}")