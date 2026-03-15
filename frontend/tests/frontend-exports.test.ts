import { describe, expect, it } from "vitest";

import * as apiModule from "../src/lib/api";
import apiClientDefault, { api as apiClientNamed, clearApiCache } from "../src/lib/apiClient";
import * as ownerApiModule from "../src/lib/ownerApi";
import * as managerApiModule from "../src/lib/managerApi";
import * as tenantApiModule from "../src/lib/tenantApi";
import * as phLocationsModule from "../src/lib/phLocations";
import * as utilsModule from "../src/lib/utils";
import useBrowserNotifications from "../src/hooks/useBrowserNotifications";
import * as inViewHookModule from "../src/hooks/useInView";
import * as themeContextModule from "../src/context/ThemeContext";

const moduleEntries: Array<{ name: string; mod: Record<string, unknown> }> = [
  { name: "api", mod: apiModule },
  { name: "ownerApi", mod: ownerApiModule },
  { name: "managerApi", mod: managerApiModule },
  { name: "tenantApi", mod: tenantApiModule },
  { name: "phLocations", mod: phLocationsModule },
  { name: "utils", mod: utilsModule },
  { name: "useInView", mod: inViewHookModule },
  { name: "ThemeContext", mod: themeContextModule },
];

describe("frontend export smoke tests", () => {
  it("apiClient exports are defined", () => {
    expect(clearApiCache).toBeTypeOf("function");
    expect(apiClientNamed).toBeDefined();
    expect(apiClientDefault).toBeDefined();
  });

  it("useBrowserNotifications default export is a function", () => {
    expect(useBrowserNotifications).toBeTypeOf("function");
  });

  for (const { name, mod } of moduleEntries) {
    describe(`${name} module`, () => {
      for (const [exportName, exported] of Object.entries(mod)) {
        if (exportName === "default") continue;

        it(`${exportName} is exported`, () => {
          expect(exported).toBeDefined();
        });
      }
    });
  }
});
