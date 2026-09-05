import { resetDemoUser } from "../src/lib/services/demoReset";
import { prisma } from "../src/lib/db";

resetDemoUser()
  .then((r) => {
    console.log("Demo account reset:", r);
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
