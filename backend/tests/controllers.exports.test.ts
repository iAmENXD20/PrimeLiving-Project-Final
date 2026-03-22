import { describe, expect, it } from "vitest";

import * as analyticsController from "../src/controllers/analytics.controller";
import * as announcementsController from "../src/controllers/announcements.controller";
import * as apartmentsController from "../src/controllers/apartments.controller";
import * as authController from "../src/controllers/auth.controller";
import * as clientsController from "../src/controllers/clients.controller";
import * as documentsController from "../src/controllers/documents.controller";
import * as inquiriesController from "../src/controllers/inquiries.controller";
import * as maintenanceController from "../src/controllers/maintenance.controller";
import * as managersController from "../src/controllers/managers.controller";
import * as notificationsController from "../src/controllers/notifications.controller";
import * as paymentsController from "../src/controllers/payments.controller";
import * as revenuesController from "../src/controllers/revenues.controller";
import * as tenantsController from "../src/controllers/tenants.controller";

const controllerModules = [
  { name: "analytics", mod: analyticsController },
  { name: "announcements", mod: announcementsController },
  { name: "apartments", mod: apartmentsController },
  { name: "auth", mod: authController },
  { name: "apartment_owners", mod: clientsController },
  { name: "documents", mod: documentsController },
  { name: "inquiries", mod: inquiriesController },
  { name: "maintenance", mod: maintenanceController },
  { name: "apartment_managers", mod: managersController },
  { name: "notifications", mod: notificationsController },
  { name: "payments", mod: paymentsController },
  { name: "revenues", mod: revenuesController },
  { name: "tenants", mod: tenantsController },
];

describe("controller export smoke tests", () => {
  for (const { name, mod } of controllerModules) {
    describe(`${name} controller exports`, () => {
      for (const [exportName, exported] of Object.entries(mod)) {
        if (exportName === "default") continue;

        it(`${exportName} is an exported function`, () => {
          expect(typeof exported).toBe("function");
        });
      }
    });
  }
});
