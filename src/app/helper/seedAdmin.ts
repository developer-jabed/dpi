import bcrypt from "bcryptjs";

import { Role } from "@prisma/client";
import config from "../../config";
import { prisma } from "../shared/prisma";


export const seedAdmin = async () => {
  try {
    // ✅ Check ENV values
    if (!config.admin_email || !config.admin_password) {
      throw new Error("❌ Missing ADMIN_EMAIL or ADMIN_PASSWORD in config.");
    }

    // ✅ Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: config.admin_email },
    });

    if (existingAdmin) {
      console.log("✅ Admin already exists!");
      return;
    }

    console.log("🛠️ Creating Admin...");

    // ✅ Hash password
    const saltRounds = Number(config.salt_round) || 10;
    const hashedPassword = await bcrypt.hash(config.admin_password, saltRounds);

    // ✅ Create User (parent record)
    const user = await prisma.user.create({
      data: {
        email: config.admin_email,
        password: hashedPassword,
        role: Role.ADMIN, // explicitly set ADMIN
        needPassChange: false,
      },
    });

    // ✅ Create related Admin record
    await prisma.admin.create({
      data: {
        userId: user.id, // link to user
        roleLabel: "Super Admin",
        lastLogin: new Date(),
      },
    });

    console.log("🎉 Admin created successfully!");
    console.log({
      email: config.admin_email,
      password: config.admin_password,
      role: "ADMIN",
    });
  } catch (error) {
    console.error("❌ Error seeding admin:", error);
  } finally {
    await prisma.$disconnect();
  }
};
