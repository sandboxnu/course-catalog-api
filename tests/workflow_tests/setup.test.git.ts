import prisma from "../../services/prisma";

describe("Ensure termIDs have been populated", async () => {
  test("term IDs are in the database", async () => {
    const numTermIds = await prisma.subject.count();
    expect(numTermIds).toBe(3);
  });
});
