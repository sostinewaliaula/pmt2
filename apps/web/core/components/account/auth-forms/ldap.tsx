/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
// plane imports
import { Button, Input } from "@plane/ui";
import { API_BASE_URL } from "@plane/constants";
// helpers
import type { TAuthErrorInfo } from "@/helpers/authentication.helper";
import { EErrorAlertType, authErrorHandler, EAuthenticationErrorCodes, EAuthSteps } from "@/helpers/authentication.helper";

type TLDAPAuthForm = {
  handleAuthStep: (step: EAuthSteps) => void;
  handleErrorInfo: (errorInfo: TAuthErrorInfo | undefined) => void;
};

export const AuthLDAPForm = ({ handleAuthStep, handleErrorInfo }: TLDAPAuthForm) => {
  // states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password) {
      const errorhandler = authErrorHandler(EAuthenticationErrorCodes.REQUIRED_EMAIL_PASSWORD_SIGN_IN);
      if (errorhandler?.type) handleErrorInfo(errorhandler);
      return;
    }

    setIsSubmitting(true);
    handleErrorInfo(undefined);

    try {
      // Create form data
      const formData = new FormData();
      formData.append("username", username.trim());
      formData.append("password", password);
      formData.append("next_path", "/");

      // Submit to LDAP endpoint
      const response = await fetch(`${API_BASE_URL}/auth/ldap/`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      // Check if response is a redirect
      if (response.redirected) {
        // Follow the redirect
        window.location.href = response.url;
      } else if (response.ok) {
        // Successful authentication - redirect to home
        window.location.href = "/";
      } else {
        // Handle error response
        const errorhandler = authErrorHandler(EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_IN);
        if (errorhandler?.type) handleErrorInfo(errorhandler);
      }
    } catch (error) {
      const errorhandler = authErrorHandler(EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_IN);
      if (errorhandler?.type) handleErrorInfo(errorhandler);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-4">
      <div className="space-y-1">
        <Input
          id="username"
          name="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter your username (e.g., firstname.lastname)"
          className="h-[46px] w-full border border-onboarding-border-100 !bg-onboarding-background-200 pr-12 text-onboarding-text-400 placeholder:text-onboarding-text-400"
          disabled={isSubmitting}
          autoComplete="username"
          autoFocus
        />
      </div>
      <div className="space-y-1">
        <Input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          className="h-[46px] w-full border border-onboarding-border-100 !bg-onboarding-background-200 pr-12 text-onboarding-text-400 placeholder:text-onboarding-text-400"
          disabled={isSubmitting}
          autoComplete="current-password"
        />
      </div>
      <div className="space-y-2.5">
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          size="lg"
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          {isSubmitting ? "Signing in..." : "Sign in with LDAP"}
        </Button>
        <Button
          type="button"
          variant="outline-primary"
          className="w-full"
          size="lg"
          onClick={() => handleAuthStep(EAuthSteps.EMAIL)}
          disabled={isSubmitting}
        >
          Back to email login
        </Button>
      </div>
    </form>
  );
};