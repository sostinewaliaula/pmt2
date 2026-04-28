# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import csv
import io
import uuid

from django.db.models.functions import Lower

from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from plane.app.permissions import WorkSpaceAdminPermission
from plane.app.views.base import BaseAPIView
from plane.db.models import User, Workspace, WorkspaceMember
from plane.utils.exception_logger import log_exception


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

        added, skipped, invalid = [], [], []

        for email in emails:
            if not email or "@" not in email:
                invalid.append(email or "(empty)")
                continue

            if email in existing_member_emails:
                skipped.append(email)
                continue

            try:
                # Get existing PMT user or create a new pre-provisioned account
                try:
                    user = User.objects.annotate(lower_email=Lower("email")).get(lower_email=email)
                except User.DoesNotExist:
                    user = User(email=email, username=uuid.uuid4().hex)
                    # Random unknown password; is_password_autoset=True means they'll
                    # use the magic-code flow to set their own password on first login
                    user.set_password(uuid.uuid4().hex)
                    user.is_password_autoset = True
                    user.is_email_verified = True
                    user.display_name = User.get_display_name(email)
                    user.save()

                WorkspaceMember.objects.get_or_create(
                    workspace=workspace,
                    member=user,
                    defaults={"role": 5},
                )
                added.append(email)
            except Exception as exc:
                log_exception(exc)
                invalid.append(email)

        return Response(
            {
                "added": added,
                "skipped": skipped,
                "invalid": invalid,
                "summary": {
                    "added": len(added),
                    "invited": 0,
                    "skipped": len(skipped),
                    "invalid": len(invalid),
                    "total_parsed": len(emails),
                },
            },
            status=status.HTTP_200_OK,
        )
