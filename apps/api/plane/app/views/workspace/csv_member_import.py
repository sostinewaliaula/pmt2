# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import csv
import io
from datetime import datetime

import jwt

from django.conf import settings
from django.db.models.functions import Lower

from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from plane.app.permissions import WorkSpaceAdminPermission
from plane.app.views.base import BaseAPIView
from plane.bgtasks.workspace_invitation_task import workspace_invitation
from plane.db.models import User, Workspace, WorkspaceMember, WorkspaceMemberInvite
from plane.utils.exception_logger import log_exception
from plane.utils.host import base_host


_EMAIL_COLS = {"email", "emailaddress", "email address", "user email", "useremail"}


class WorkspaceCsvMemberImportEndpoint(BaseAPIView):
    parser_classes = [MultiPartParser]
    permission_classes = [WorkSpaceAdminPermission]

    def _parse_csv(self, file_obj):
        text = file_obj.read().decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            return []
        email_col = next(
            (f for f in reader.fieldnames if f.strip().lower() in _EMAIL_COLS),
            None,
        )
        if not email_col:
            return []
        return [
            row[email_col].strip().lower()
            for row in reader
            if row.get(email_col, "").strip()
        ]

    def post(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)

        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response({"error": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            emails = self._parse_csv(uploaded)
        except Exception as exc:
            log_exception(exc)
            return Response({"error": "Could not parse CSV."}, status=status.HTTP_400_BAD_REQUEST)

        if not emails:
            return Response(
                {"error": "No email addresses found. Check the CSV has an email column."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_member_emails = set(
            WorkspaceMember.objects.filter(workspace=workspace, is_active=True)
            .annotate(lower_email=Lower("member__email"))
            .values_list("lower_email", flat=True)
        )

        current_site = base_host(request=request, is_app=True)
        added, invited, skipped, invalid = [], [], [], []

        for email in emails:
            if not email or "@" not in email:
                invalid.append(email or "(empty)")
                continue

            if email in existing_member_emails:
                skipped.append(email)
                continue

            try:
                user = User.objects.annotate(lower_email=Lower("email")).get(lower_email=email)
                WorkspaceMember.objects.get_or_create(
                    workspace=workspace,
                    member=user,
                    defaults={"role": 5},
                )
                added.append(email)
            except User.DoesNotExist:
                token = jwt.encode(
                    {"email": email, "timestamp": datetime.now().timestamp()},
                    settings.SECRET_KEY,
                    algorithm="HS256",
                )
                invite, created = WorkspaceMemberInvite.objects.get_or_create(
                    workspace=workspace,
                    email=email,
                    defaults={"role": 5, "token": token},
                )
                if created:
                    workspace_invitation.delay(
                        invite.email,
                        workspace.id,
                        invite.token,
                        current_site,
                        request.user.email,
                    )
                invited.append(email)
            except Exception as exc:
                log_exception(exc)
                invalid.append(email)

        return Response(
            {
                "added": added,
                "invited": invited,
                "skipped": skipped,
                "invalid": invalid,
                "summary": {
                    "added": len(added),
                    "invited": len(invited),
                    "skipped": len(skipped),
                    "invalid": len(invalid),
                    "total_parsed": len(emails),
                },
            },
            status=status.HTTP_200_OK,
        )
