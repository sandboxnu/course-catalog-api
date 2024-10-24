import HydrateCourseSerializer from "../../../serializers/hydrateCourseSerializer";
import HydrateProfSerializer from "../../../serializers/hydrateProfSerializer";
import ElasticProfSerializer from "../../../serializers/elasticProfSerializer";
import ElasticCourseSerializer from "../../../serializers/elasticCourseSerializer";
import { PrismaCourseWithSections } from "../../../types/serializerTypes";
import { PrismaClient } from "@prisma/client";
import professorDataFixtures from "./fixtures/professorDataFixtures";
import elasticCourseDataFixtures from "./fixtures/elasticCourseDataFixtures";

const prisma = new PrismaClient();

async function seedTestData() {
  await prisma.section.deleteMany();
  await prisma.course.deleteMany();
}

async function seedProfTestData() {
  await prisma.professor.deleteMany();
  await prisma.professor.createMany({ data: professorDataFixtures });
}

async function seedElasticCourseTestData() {
  await prisma.course.deleteMany();
  await prisma.course.createMany({ data: elasticCourseDataFixtures });
}

jest.setTimeout(10000);

describe("HydrateCourseSerializer Integration Tests", () => {
  beforeAll(async () => {
    await seedTestData();
  });

  afterAll(async () => {
    await prisma.section.deleteMany();
    await prisma.course.deleteMany();
    await prisma.$disconnect();
  });

  it("should serialize all courses correctly with actual database data", async () => {
    const prismaCourses = await prisma.course.findMany({
      include: { sections: true },
    });

    const serializedCourses = await HydrateCourseSerializer.bulkSerialize(
      prismaCourses as PrismaCourseWithSections[]
    );

    Object.values(serializedCourses).forEach((course, index) => {
      const originalCourse = prismaCourses[index];

      expect(course).toHaveProperty("class");
      expect(course.class).toMatchObject({
        classId: originalCourse.classId,
        name: originalCourse.name,
        subject: originalCourse.subject,
        termId: originalCourse.termId,
      });

      course.class.sections.forEach((section: any) => {
        expect(section).toHaveProperty("crn");
        expect(section).toHaveProperty("campus");
        expect(section).toHaveProperty("classType");
        expect(section).toHaveProperty("profs");
        expect(typeof section.lastUpdateTime).toBe("number");
      });

      expect(Array.isArray(course.class.sections)).toBe(true);
      expect(course.sections).toEqual([]);
      expect(course.type).toBe("class");
    });
  });
});

describe("HydrateProfSerializer Integration Tests", () => {
  beforeAll(async () => {
    await seedProfTestData();
  });

  afterAll(async () => {
    await prisma.professor.deleteMany();
    await prisma.$disconnect();
  });

  it("should serialize all professors correctly with actual database data", async () => {
    const prismaProfessors = await prisma.professor.findMany();

    const serializedProfessors = await HydrateProfSerializer.bulkSerialize(
      prismaProfessors
    );

    Object.values(serializedProfessors).forEach((prof, index) => {
      const originalProf = prismaProfessors[index];

      expect(prof).toHaveProperty("employee");
      expect(prof.employee).toMatchObject({
        id: originalProf.id,
        name: originalProf.name,
        firstName: originalProf.firstName,
        lastName: originalProf.lastName,
        email: originalProf.email,
        phone: originalProf.phone,
        officeRoom: originalProf.officeRoom,
        primaryDepartment: originalProf.primaryDepartment,
        primaryRole: originalProf.primaryRole,
      });

      expect(prof.type).toBe("employee");
    });
  });
});

describe("ElasticProfSerializer Integration Tests", () => {
  beforeAll(async () => {
    await seedProfTestData();
  });

  afterAll(async () => {
    await prisma.professor.deleteMany();
    await prisma.$disconnect();
  });

  it("should serialize all professors correctly with actual database data", async () => {
    const prismaProfessors = await prisma.professor.findMany();

    const serializedProfessors = await ElasticProfSerializer.bulkSerialize(
      prismaProfessors
    );

    Object.values(serializedProfessors).forEach((prof, index) => {
      const originalProf = prismaProfessors[index];

      expect(prof).toHaveProperty("employee");
      expect(prof.employee).toMatchObject({
        id: originalProf.id,
        name: `${originalProf.firstName} ${originalProf.lastName}`,
        email: originalProf.email,
        phone: originalProf.phone,
      });

      expect(prof.type).toBe("employee");
    });
  });
});

describe("ElasticCourseSerializer Integration Tests", () => {
  beforeAll(async () => {
    await seedElasticCourseTestData();
  });

  afterAll(async () => {
    await prisma.course.deleteMany();
    await prisma.$disconnect();
  });

  it("should serialize all courses correctly with actual database data", async () => {
    const prismaCourses = await prisma.course.findMany();

    const serializedCourses = await ElasticCourseSerializer.bulkSerialize(
      prismaCourses
    );

    Object.values(serializedCourses).forEach((course, index) => {
      const originalCourse = prismaCourses[index];

      expect(course).toHaveProperty("class");
      expect(course.class).toMatchObject({
        host: originalCourse.host,
        name: originalCourse.name,
        subject: originalCourse.subject,
        classId: originalCourse.classId,
        termId: originalCourse.termId,
      });

      expect(Array.isArray(course.class.nupath)).toBe(true);
      expect(course.sections).toEqual([]);
      expect(course.type).toBe("class");
    });
  });
});
