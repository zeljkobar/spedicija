import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { changePassword, getCurrentUser, login } from "../services/auth.service.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6)
});

router.post("/login", async (req, res, next) => {
  try {
    res.json({ success: true, data: await login(loginSchema.parse(req.body)) });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await getCurrentUser(req.user.sub);
    if (!user) return res.status(401).json({ success: false, message: "Korisnik nije pronadjen." });
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

router.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    await changePassword(req.user.sub, changePasswordSchema.parse(req.body));
    res.json({ success: true, message: "Lozinka je promijenjena." });
  } catch (error) {
    next(error);
  }
});

export default router;
