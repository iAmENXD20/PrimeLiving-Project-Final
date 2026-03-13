import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

/**
 * Zod validation middleware factory.
 * Validates request body, query, or params against a Zod schema.
 *
 * Usage:
 *   router.post("/", validate(createClientSchema), handler);
 *   router.get("/", validate(querySchema, "query"), handler);
 */
export function validate(
  schema: ZodSchema,
  source: "body" | "query" | "params" = "body"
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = result.error.issues.map((issue: any) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors,
      });
      return;
    }

    // Replace the source with the parsed (and potentially transformed) data
    (req as any)[source] = result.data;
    next();
  };
}
