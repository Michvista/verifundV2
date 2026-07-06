import type { Request, Response } from "express";
import { signAuthToken } from "../services/auth";
import { getMemberOrThrowData, registerMember } from "../services/repository";

export async function registerController(req: Request, res: Response) {
  const { firstName, lastName, phoneNumber, bvnHash, role } = req.body ?? {};
  if (!firstName || !lastName || !phoneNumber || !bvnHash) {
    return res
      .status(400)
      .json({
        message: "firstName, lastName, phoneNumber, and bvnHash are required",
      });
  }

  try {
    const { member, verification } = await registerMember({
      firstName: String(firstName),
      lastName: String(lastName),
      phoneNumber: String(phoneNumber),
      bvnHash: String(bvnHash),
      role: role ? String(role) as any : undefined,
    });

    return res.status(201).json({
      member,
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
    return res.status(500).json({ message: "Registration failed" });
  }
}

export async function loginController(req: Request, res: Response) {
  const { memberId } = req.body ?? {};
  if (!memberId)
    return res.status(400).json({ message: "memberId is required" });

  try {
    const member = await getMemberOrThrowData(String(memberId));
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
      message:
        "We could not find that member ID. Check the ID or register again if the backend was recently restarted.",
    });
  }
}
