/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Eye, EyeOff, TestTube } from "lucide-react";
// plane internal packages
import { setPromiseToast, setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { TInstanceAuthenticationMethodKeys } from "@plane/types";
import { Button, Input, ToggleSwitch } from "@plane/ui";
import { cn } from "@plane/utils";
// hooks
import { useInstance } from "@/hooks/store";

type Props = {
  disabled: boolean;
  updateConfig: (key: TInstanceAuthenticationMethodKeys, value: string) => void;
};

export const LDAPConfiguration = observer(function LDAPConfiguration(props: Props) {
  const { disabled, updateConfig } = props;
  // states
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  // store hooks
  const { formattedConfig } = useInstance();
  // derived values
  const isLDAPEnabled = formattedConfig?.IS_LDAP_ENABLED === "1";
  const serverUrl = formattedConfig?.LDAP_SERVER_URL ?? "";
  const port = formattedConfig?.LDAP_PORT ?? "389";
  const bindDN = formattedConfig?.LDAP_BIND_DN ?? "";
  const bindPassword = formattedConfig?.LDAP_BIND_PASSWORD ?? "";
  const baseDN = formattedConfig?.LDAP_BASE_DN ?? "";
  const userFilter = formattedConfig?.LDAP_USER_FILTER ?? "(uid={username})";
  const useSSL = formattedConfig?.LDAP_USE_SSL === "1";
  const attrUsername = formattedConfig?.LDAP_ATTR_USERNAME ?? "uid";
  const attrEmail = formattedConfig?.LDAP_ATTR_EMAIL ?? "mail";
  const attrFirstName = formattedConfig?.LDAP_ATTR_FIRST_NAME ?? "givenName";
  const attrLastName = formattedConfig?.LDAP_ATTR_LAST_NAME ?? "sn";

  const handleTestConnection = async () => {
    if (!serverUrl || !bindDN || !bindPassword || !baseDN) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Missing configuration",
        message: "Please fill in all required fields before testing the connection.",
      });
      return;
    }

    setIsTestingConnection(true);

    try {
      const response = await fetch("/auth/ldap/test-connection/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]')?.getAttribute('value') || "",
        },
        credentials: "same-origin",
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "Connection successful",
          message: data.message || "Successfully connected to LDAP server",
        });
      } else {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "Connection failed",
          message: data.error_message || "Failed to connect to LDAP server",
        });
      }
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Connection failed",
        message: "An error occurred while testing the connection",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium text-custom-text-100">Enable LDAP authentication</div>
        <div className="text-xs font-normal text-custom-text-300">
          Allow users to authenticate using LDAP/Active Directory credentials
        </div>
      </div>
      <div className="flex items-center gap-4">
        <ToggleSwitch
          value={isLDAPEnabled}
          onChange={() => updateConfig("IS_LDAP_ENABLED", isLDAPEnabled ? "0" : "1")}
          size="sm"
          disabled={disabled}
        />
        {isLDAPEnabled && (
          <div className="flex flex-col gap-4 w-full max-w-md">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-custom-text-200">Server URL *</label>
                <Input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => updateConfig("LDAP_SERVER_URL", e.target.value)}
                  placeholder="ldap.company.com"
                  disabled={disabled}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-custom-text-200">Port *</label>
                <Input
                  type="number"
                  value={port}
                  onChange={(e) => updateConfig("LDAP_PORT", e.target.value)}
                  placeholder="389"
                  disabled={disabled}
                  className="w-full"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-custom-text-200">Bind DN *</label>
              <Input
                type="text"
                value={bindDN}
                onChange={(e) => updateConfig("LDAP_BIND_DN", e.target.value)}
                placeholder="cn=admin,dc=company,dc=com"
                disabled={disabled}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-custom-text-200">Bind Password *</label>
              <div className="relative">
                <Input
                  type={isPasswordVisible ? "text" : "password"}
                  value={bindPassword}
                  onChange={(e) => updateConfig("LDAP_BIND_PASSWORD", e.target.value)}
                  placeholder="Enter bind password"
                  disabled={disabled}
                  className="w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-custom-text-400 hover:text-custom-text-300"
                >
                  {isPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-custom-text-200">Base DN *</label>
              <Input
                type="text"
                value={baseDN}
                onChange={(e) => updateConfig("LDAP_BASE_DN", e.target.value)}
                placeholder="ou=users,dc=company,dc=com"
                disabled={disabled}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-custom-text-200">User Filter *</label>
              <Input
                type="text"
                value={userFilter}
                onChange={(e) => updateConfig("LDAP_USER_FILTER", e.target.value)}
                placeholder="(uid={username})"
                disabled={disabled}
                className="w-full"
              />
              <div className="text-xs text-custom-text-300 mt-1">
                Use {"{username}"} or {"{email}"} as placeholders
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <ToggleSwitch
                  value={useSSL}
                  onChange={() => updateConfig("LDAP_USE_SSL", useSSL ? "0" : "1")}
                  size="sm"
                  disabled={disabled}
                />
                <span className="text-xs font-medium text-custom-text-200">Use SSL/TLS</span>
              </div>
            </div>

            <div className="border-t border-custom-border-200 pt-4">
              <div className="text-xs font-medium text-custom-text-200 mb-3">Attribute Mapping</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-custom-text-300">Username Attribute</label>
                  <Input
                    type="text"
                    value={attrUsername}
                    onChange={(e) => updateConfig("LDAP_ATTR_USERNAME", e.target.value)}
                    placeholder="uid"
                    disabled={disabled}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-custom-text-300">Email Attribute</label>
                  <Input
                    type="text"
                    value={attrEmail}
                    onChange={(e) => updateConfig("LDAP_ATTR_EMAIL", e.target.value)}
                    placeholder="mail"
                    disabled={disabled}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-custom-text-300">First Name Attribute</label>
                  <Input
                    type="text"
                    value={attrFirstName}
                    onChange={(e) => updateConfig("LDAP_ATTR_FIRST_NAME", e.target.value)}
                    placeholder="givenName"
                    disabled={disabled}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-custom-text-300">Last Name Attribute</label>
                  <Input
                    type="text"
                    value={attrLastName}
                    onChange={(e) => updateConfig("LDAP_ATTR_LAST_NAME", e.target.value)}
                    placeholder="sn"
                    disabled={disabled}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={handleTestConnection}
                loading={isTestingConnection}
                disabled={disabled || isTestingConnection}
                className="flex items-center gap-2"
              >
                <TestTube size={16} />
                Test Connection
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});