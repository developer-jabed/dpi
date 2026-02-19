import bcrypt from "bcryptjs";
import { prisma } from "../shared/prisma";
import config from "../../config";
import { UserRole } from "@prisma/client";

export const seedAdmin = async () => {
  try {
    // ✅ Check ENV values
    if (!config.ADMIN_EMAIL || !config.ADMIN_PASSWORD) {
      throw new Error("❌ Missing ADMIN_EMAIL or ADMIN_PASSWORD in config.");
    }

    // ✅ Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: config.ADMIN_EMAIL },
    });

    if (existingAdmin) {
      console.log("✅ Admin already exists!");
      return;
    }

    console.log("🛠️ Creating Admin...");

    // ✅ Hash password
    const saltRounds = Number(config.salt_round) || 10;
    const hashedPassword = await bcrypt.hash(config.ADMIN_PASSWORD, saltRounds);

    // ✅ Create User (for admin)
    const user = await prisma.user.create({
      data: {
        email: config.ADMIN_EMAIL,
        password: hashedPassword,
        role: UserRole.ADMIN,
        needPasswordChange: false,
      },
    });

    // ✅ Create related Admin record
    await prisma.admin.create({
      data: {
        id: user.id, // same ID as the User
        name: "System Administrator",
        email: config.ADMIN_EMAIL,
        profilePhoto: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
        contactNumber: "01700000000",
      },
    });

    console.log("🎉 Admin created successfully!");
    console.log({
      email: config.ADMIN_EMAIL,
      password: config.ADMIN_PASSWORD,
    });
  } catch (error) {
    console.error("❌ Error seeding admin:", error);
  } finally {
    await prisma.$disconnect();
  }
};
