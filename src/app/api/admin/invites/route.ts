import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { authOptions } from "../../auth/[...nextauth]/route";
import { sendInviteEmail } from "@/lib/ses";

// Helper function to generate a random invite code
function generateInviteCode() {
  return crypto.randomBytes(16).toString("hex");
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all invites, sorted by creation date
    const invites = await prisma.invite.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(invites);
  } catch (error) {
    console.error("Error fetching invites:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if an unused invite already exists for this email
    const existingInvite = await prisma.invite.findFirst({
      where: {
        email,
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: "An active invite already exists for this email" },
        { status: 400 }
      );
    }

    const inviteCode = generateInviteCode();

    // Create new invite
    const invite = await prisma.invite.create({
      data: {
        email,
        code: inviteCode,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        createdById: session.user.id,
      },
    });

    // Send invite email
    const emailSent = await sendInviteEmail(email, inviteCode);

    if (!emailSent) {
      // If email fails to send, delete the invite and return an error
      await prisma.invite.delete({
        where: { id: invite.id },
      });
      return NextResponse.json(
        { error: "Failed to send invite email" },
        { status: 500 }
      );
    }

    return NextResponse.json(invite);
  } catch (error) {
    console.error("Invite generation error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
