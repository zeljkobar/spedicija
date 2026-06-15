import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { signUserToken } from "../middleware/auth.js";

const DEFAULT_ADMIN = {
  name: process.env.ADMIN_NAME || "Administrator",
  email: process.env.ADMIN_EMAIL || "admin@spedicija.local",
  password: process.env.ADMIN_PASSWORD || "admin12345"
};

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    organization: user.organization || null
  };
}

export async function ensureDefaultAdmin() {
  const usersCount = await prisma.user.count();
  if (usersCount > 0) return null;

  return prisma.user.create({
    data: {
      name: DEFAULT_ADMIN.name,
      email: DEFAULT_ADMIN.email,
      passwordHash: await bcrypt.hash(DEFAULT_ADMIN.password, 10),
      role: "SUPER_ADMIN"
    }
  });
}

export async function login({ email, password }) {
  await ensureDefaultAdmin();

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { organization: true }
  });

  if (!user || !user.active) {
    const error = new Error("Pogresan email ili lozinka.");
    error.status = 401;
    throw error;
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    const error = new Error("Pogresan email ili lozinka.");
    error.status = 401;
    throw error;
  }

  return {
    token: signUserToken(user),
    user: publicUser(user)
  };
}

export async function getCurrentUser(id) {
  const user = await prisma.user.findUnique({ where: { id: Number(id) }, include: { organization: true } });
  return user ? publicUser(user) : null;
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
  if (!user || !user.active) {
    const error = new Error("Korisnik nije pronadjen.");
    error.status = 404;
    throw error;
  }

  const passwordOk = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordOk) {
    const error = new Error("Trenutna lozinka nije tacna.");
    error.status = 400;
    throw error;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) }
  });

  return true;
}
