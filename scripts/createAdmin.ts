import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
    process.exit(1);
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: hashedPassword,
        name: "Admin",
        isAdmin: true,
      },
    });

    console.log("Admin user created:", admin.email);
  } catch (error) {
    console.error("Error creating admin user:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
