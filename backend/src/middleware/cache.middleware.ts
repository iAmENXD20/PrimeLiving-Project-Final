import { NextFunction, Response } from "express";
import { env } from "../config/env";
import { AuthenticatedRequest } from "../types";
import { cacheStore } from "../utils/cache";

type CachePayload = {
  statusCode: number;
  body: unknown;
};

type CacheOptions = {
  namespace: string;
  ttlSeconds?: number;
  keyBuilder?: (req: AuthenticatedRequest) => string;
};

export function invalidateCache(namespaces: string[]) {
  return (_req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    res.on("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        for (const namespace of namespaces) {
          cacheStore.clearPrefix(`${namespace}:`);
        }
      }
    });

    next();
  };
}

function buildDefaultKey(req: AuthenticatedRequest, namespace: string): string {
  const userPart = req.user?.id || "anonymous";
  return `${namespace}:${userPart}:${req.originalUrl}`;
}

export function cacheResponse(options: CacheOptions) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (env.CACHE_ENABLED === "false") {
      next();
      return;
    }

    const ttlSeconds = options.ttlSeconds ?? env.CACHE_DEFAULT_TTL_SECONDS;
    const cacheKey = options.keyBuilder
      ? options.keyBuilder(req)
      : buildDefaultKey(req, options.namespace);

    const cached = cacheStore.get<CachePayload>(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.status(cached.statusCode).json(cached.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheStore.set<CachePayload>(
          cacheKey,
          { statusCode: res.statusCode, body },
          ttlSeconds
        );
        res.setHeader("X-Cache", "MISS");
      }
      return originalJson(body);
    }) as typeof res.json;

    next();
  };
}
