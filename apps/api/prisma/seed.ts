import { PrismaClient, Role, VerificationStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const college = await prisma.college.upsert({
    where: { name: "CBIT Hyderabad" },
    update: {},
    create: { name: "CBIT Hyderabad", city: "Hyderabad" }
  });

  const department = await prisma.department.upsert({
    where: {
      name_collegeId: {
        name: "ECE",
        collegeId: college.id
      }
    },
    update: {},
    create: {
      name: "ECE",
      collegeId: college.id
    }
  });

  const batch = await prisma.batch.upsert({
    where: {
      name_departmentId_collegeId: {
        name: "ECE 2025-2029",
        departmentId: department.id,
        collegeId: college.id
      }
    },
    update: {},
    create: {
      name: "ECE 2025-2029",
      startYear: 2025,
      endYear: 2029,
      collegeId: college.id,
      departmentId: department.id
    }
  });

  const passwordHash = await bcrypt.hash("Admin@123", 10);

  await prisma.user.upsert({
    where: { email: "admin@quad.in" },
    update: {},
    create: {
      name: "Quad Admin",
      email: "admin@quad.in",
      passwordHash,
      role: Role.ADMIN,
      verificationStatus: VerificationStatus.VERIFIED,
      collegeId: college.id,
      departmentId: department.id,
      batchId: batch.id
    }
  });

  await prisma.deal.create({
    data: {
      brand: "Swiggy",
      title: "Flat 20% off for verified students",
      code: "QUAD20",
      description: "Use this in student account checkout",
      createdBy: {
        connect: { email: "admin@quad.in" }
      }
    }
  }).catch(() => undefined);

  await prisma.opportunity.create({
    data: {
      title: "ECE Embedded Systems Intern",
      company: "Hyderabad Robotics Labs",
      description: "6-week paid internship for 1st and 2nd year ECE students",
      location: "Hyderabad",
      branch: "ECE",
      year: 1,
      createdBy: {
        connect: { email: "admin@quad.in" }
      }
    }
  }).catch(() => undefined);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
