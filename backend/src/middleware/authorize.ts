import { Response, NextFunction } from "express";
import { AuthenticatedRequest, UserRole } from "../types";

/**
 * Role-based authorization middleware factory.
 * Pass one or more allowed roles. If the authenticated user's role
 * is not in the list, a 403 Forbidden response is returned.
 *
 * Usage:
 *   router.get("/owner-only", authenticate, authorize("owner"), handler);
 *   router.get("/owner-or-manager", authenticate, authorize("owner", "manager"), handler);
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Access denied. Required role(s): ${allowedRoles.join(", ")}`,
      });
      return;
    }

    next();
  };
}
