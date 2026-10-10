import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_EXPIRY = "7d";

function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return s;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export type TokenPayload = { userId: string };

export function signToken(userId: string): string {
  return jwt.sign({ userId } satisfies TokenPayload, jwtSecret(), { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, jwtSecret());
  if (typeof decoded !== "object" || decoded === null || !("userId" in decoded)) {
    throw new Error("Invalid token payload");
  }
  return { userId: String((decoded as { userId: unknown }).userId) };
}

// Extend Express Request with the authenticated user id.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
    }
  }
}

/** Requires `Authorization: Bearer <token>`; attaches req.userId. */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }
  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Requires admin role (looked up from the DB). Chain after authMiddleware. */
export async function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { db } = await import("../db/client.js");
    const { users } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, req.userId ?? ""))
      .limit(1);
    const role = rows[0]?.role;
    if (role !== "admin") {
      res.status(403).json({ error: "Admin only" });
      return;
    }
    req.userRole = role;
    next();
  } catch {
    res.status(500).json({ error: "Failed to verify admin role" });
  }
}
