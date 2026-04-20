/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTheme } from "next-themes";
// assets
import CaavaLogo from "/caava-logo.png";

export function LogoSpinner() {
  const { resolvedTheme } = useTheme();

  return (
    <div className="flex items-center justify-center">
      <img src={CaavaLogo} alt="logo" className="h-6 w-auto object-contain sm:h-11" />
    </div>
  );
}
