import jwt from "jsonwebtoken";

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

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ success: false, message: "Potrebna je prijava." });
  }

  try {
    req.user = jwt.verify(token, jwtSecret());
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Sesija je istekla. Prijavi se ponovo." });
  }
}
