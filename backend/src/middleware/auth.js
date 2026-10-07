import jwt from "jsonwebtoken";
import { prisma } from "../db.js";

function jwtSecret() {
  return process.env.JWT_SECRET || "promijeni-ovo-u-produkciji";
}

export function signUserToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId
    },
    jwtSecret(),
    { expiresIn: "8h" }
  );
}

export function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== "SUPER_ADMIN") {
    return res.status(403).json({ success: false, message: "Samo super admin ima pristup." });
  }
  return next();
}

export function requireOrganizationAdmin(req, res, next) {
  if (!["SUPER_ADMIN", "ADMIN"].includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: "Samo admin moze upravljati radnicima." });
  }
  return next();
}

export function requireWriteAccess(req, res, next) {
  if (req.user?.role === "VIEWER") {
    return res.status(403).json({ success: false, message: "Viewer ima samo pravo pregleda." });
  }
  return next();
}

export function tenantWhere(user, field = "organizationId") {
  if (user?.role === "SUPER_ADMIN") return {};
  return { [field]: Number(user.organizationId) };
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ success: false, message: "Potrebna je prijava." });
  }

  try {
    const claims = jwt.verify(token, jwtSecret());
    const user = await prisma.user.findUnique({ where: { id: Number(claims.sub) }, include: { organization: true } });
    if (!user?.active || (user.organization && !user.organization.active)) {
      return res.status(401).json({ success: false, message: "Korisnik ili spedicija nisu aktivni." });
    }
    req.user = { sub: user.id, email: user.email, role: user.role, organizationId: user.organizationId };
    return next();
  } catch (error) {
    if (["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error.name)) {
      return res.status(401).json({ success: false, message: "Sesija je istekla. Prijavi se ponovo." });
    }
    return next(error);
  }
}
