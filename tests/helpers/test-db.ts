import { prisma } from "@/lib/prisma";

export async function resetDb() {
  await prisma.attachment.deleteMany();
  await prisma.request.deleteMany();
  await prisma.hook.deleteMany();
}

export async function disconnect() {
  await prisma.$disconnect();
}
