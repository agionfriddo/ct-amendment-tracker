import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { name, email, password, inviteCode } = await req.json();

    if (!email || !password || !inviteCode) {
      return NextResponse.json(
        { error: "Email, password, and invite code are required" },
        { status: 400 }
      );
    }

    // Verify invite code
    const invite = await prisma.invite.findFirst({
      where: {
        email,
        code: inviteCode,
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Invalid or expired invite code" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user and mark invite as used in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          inviteId: invite.id,
        },
      });

      await tx.invite.update({
        where: { id: invite.id },
        data: { used: true },
      });

      return newUser;
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
