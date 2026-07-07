import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { signAuthToken } from "../services/auth";
import { loginMemberWithPassword, registerMember } from "../services/repository";

const MIN_PASSWORD_LENGTH = 8;

export async function registerController(req: Request, res: Response) {
  const { firstName, lastName, phoneNumber, password, bvnHash, role } = req.body ?? {};
  if (!firstName || !lastName || !phoneNumber || !password || !bvnHash) {
    return res
      .status(400)
      .json({
        message: "firstName, lastName, phoneNumber, password, and bvnHash are required",
      });
  }

  if (String(password).length < MIN_PASSWORD_LENGTH) {
    return res
      .status(400)
      .json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  try {
    const passwordHash = await bcrypt.hash(String(password), 10);
    const { member, verification } = await registerMember({
      firstName: String(firstName),
      lastName: String(lastName),
      phoneNumber: String(phoneNumber),
      passwordHash,
      bvnHash: String(bvnHash),
      role: role ? String(role) as any : undefined,
    });

    return res.status(201).json({
      member: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        phoneNumber: member.phoneNumber,
        role: member.role,
        bvnVerified: member.bvnVerified,
        cooperativeId: (member as any).cooperativeId,
      },
      verification,
      nomba: {
        accountCreated: true,
        virtualAccountCreated: (verification as any)?.verified ?? false,
        accountRef: `va_${member.id}`,
      },
    });
  } catch (err) {
    // Log and return a safe error message instead of crashing the process.
    console.error("Registration error:", err);
    if (err instanceof Error && err.message === "PHONE_NUMBER_EXISTS") {
      return res.status(409).json({ message: "An account already exists for this phone number" });
    }
    if (err instanceof Error && err.message === "BVN_EXISTS") {
      return res.status(409).json({ message: "An account already exists for this BVN" });
    }
    return res.status(500).json({ message: "Registration failed" });
  }
}

export async function loginController(req: Request, res: Response) {
  const { identifier, phoneNumber, password } = req.body ?? {};
  const loginIdentifier = String(identifier || phoneNumber || "").trim();
  if (!loginIdentifier || !password)
    return res.status(400).json({ message: "identifier and password are required" });

  try {
    const member = await loginMemberWithPassword(loginIdentifier);
    const passwordMatches = await bcrypt.compare(String(password), member.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid member ID, phone number, or password" });
    }

    return res.json({
      token: signAuthToken(member),
      member: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        role: member.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(401).json({
      message: "Invalid member ID, phone number, or password",
    });
  }
}
