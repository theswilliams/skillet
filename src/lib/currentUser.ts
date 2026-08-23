import { prisma } from "@/lib/db";

/**
 * Single-user MVP: everything hangs off one demo account so there's no login
 * flow to build. The schema is already multi-user (User -> everything via
 * userId FKs), so swapping this for real auth later is a matter of reading
 * the session instead of a constant lookup — no data-model changes needed.
 */
const DEMO_EMAIL = "demo@skillet.app";

export async function getCurrentUser() {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    include: { preferences: true },
  });
  if (user) return user;

  return prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: "Demo",
      preferences: { create: {} },
    },
    include: { preferences: true },
  });
}

export async function getCurrentUserId() {
  const user = await getCurrentUser();
  return user.id;
}
