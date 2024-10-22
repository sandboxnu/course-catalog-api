import CourseSerializer from "../../../serializers/courseSerializer";
import HydrateSerializer from "../../../serializers/hydrateCourseSerializer";
import ElasticProfSerializer from "../../../serializers/elasticProfSerializer";
import HydrateProfSerializer from "../../../serializers/hydrateProfSerializer";
import HydrateCourseSerializer from "../../../serializers/hydrateCourseSerializer";
import coursePartialFixtures from "./courseSerializerFixtures";
import hydrateCourseFixtures from "./hydrateCourseSerializer";
import elasticProfFixtures from "./elasticProfSerializer";
import elasticCourseFixtures from "./elasticCourseFixtures";
import profPartialFixtures from "./hydrateProfSerializerFixtures";
import { PrismaCourseWithSections } from "../../../types/serializerTypes";

import {
  Course as PrismaCourse,
  Professor as PrismaProfessor,
} from "@prisma/client";
import ProfSerializer from "../../../serializers/profSerializer";
import ElasticCourseSerializer from "../../../serializers/elasticCourseSerializer";

describe("HydrateSerializer.bulkSerialize", () => {
  const serializer = HydrateSerializer;

  // test all of the cases in courseSerializerFixtures.ts
  it("should serialize all courses correctly", async () => {
    const serializedCourses = await CourseSerializer.bulkSerialize(
      coursePartialFixtures as PrismaCourseWithSections[]
    );

    coursePartialFixtures.forEach((inputCourse, index) => {
      const serializedCourse = Object.values(serializedCourses)[index];

      // Test class-level fields
      expect(serializedCourse.class.classId).toEqual(inputCourse.classId);
      expect(serializedCourse.class.name).toEqual(inputCourse.name);
      expect(serializedCourse.class.subject).toEqual(inputCourse.subject);
      expect(serializedCourse.class.termId).toEqual(inputCourse.termId);

      // Test section-level fields
      inputCourse.sections.forEach((inputSection, sectionIndex) => {
        const serializedSection = serializedCourse.class.sections[sectionIndex];

        expect(serializedSection.crn).toEqual(inputSection.crn);
        expect(serializedSection.campus).toEqual(inputSection.campus);
        expect(serializedSection.classType).toEqual(inputSection.classType);
        expect(serializedSection.profs).toEqual(inputSection.profs);
      });
    });
  });
});

describe("Test HydrateProfSerializer.bulkSerialize", () => {
  it("should bulk serialize professor data correctly", async () => {
    const serializedProfessors = await HydrateProfSerializer.bulkSerialize(
      profPartialFixtures
    );
    const receivedProfessors = Object.values(serializedProfessors).map(
      ({ employee }) => employee
    );
    expect(receivedProfessors.length).toEqual(profPartialFixtures.length); // Ensure both have the same length

    profPartialFixtures.forEach((expectedProfessor, index) => {
      const receivedProfessor = receivedProfessors[index];

      // test fields
      expect(receivedProfessor.email).toEqual(expectedProfessor.email);
      expect(receivedProfessor.firstName).toEqual(expectedProfessor.firstName);
      expect(receivedProfessor.lastName).toEqual(expectedProfessor.lastName);
      expect(receivedProfessor.name).toEqual(expectedProfessor.name);
      expect(receivedProfessor.officeRoom).toEqual(
        expectedProfessor.officeRoom
      );
      expect(receivedProfessor.phone).toEqual(expectedProfessor.phone);
      expect(receivedProfessor.primaryDepartment).toEqual(
        expectedProfessor.primaryDepartment
      );
      expect(receivedProfessor.primaryRole).toEqual(
        expectedProfessor.primaryRole
      );
    });
  });
});

describe("Test ElasticProfSerializer.bulkSerialize", () => {
  it("should bulk serialize professor data correctly", async () => {
    const serializedProfessors = await ElasticProfSerializer.bulkSerialize(
      elasticProfFixtures
    );
    Object.values(serializedProfessors).forEach((receivedProfessor, index) => {
      const expectedProfessor = elasticProfFixtures[index];

      expect(receivedProfessor.employee.id).toEqual(expectedProfessor.id);
      expect(receivedProfessor.employee.name).toEqual(
        expectedProfessor.firstName + " " + expectedProfessor.lastName
      );
      expect(receivedProfessor.employee.phone).toEqual(expectedProfessor.phone);
      expect(receivedProfessor.employee.email).toEqual(expectedProfessor.email);
      expect(receivedProfessor.type).toEqual("employee");
    });
  });
});

describe("Test HydrateCourseSerializer.bulkSerialize", () => {
  it("should bulk serialize course data correctly", async () => {
    const serializedCourses = await HydrateCourseSerializer.bulkSerialize(
      hydrateCourseFixtures
    );
    Object.values(serializedCourses).forEach((receivedCourse, index) => {
      const expectedCourse = hydrateCourseFixtures[index];

      expect(receivedCourse.class.classAttributes).toEqual(
        expectedCourse.classAttributes
      );
      expect(receivedCourse.class.classId).toEqual(expectedCourse.classId);
      expect(receivedCourse.class.coreqs).toEqual(expectedCourse.coreqs);
      expect(receivedCourse.class.desc).toEqual(expectedCourse.description);
      expect(receivedCourse.class.feeAmount).toEqual(expectedCourse.feeAmount);
      expect(receivedCourse.class.feeDescription).toEqual(
        expectedCourse.feeDescription
      );
      expect(receivedCourse.class.host).toEqual(expectedCourse.host);
      expect(receivedCourse.class.lastUpdateTime).toEqual(
        expectedCourse.lastUpdateTime
      );
      expect(receivedCourse.class.maxCredits).toEqual(
        expectedCourse.maxCredits
      );
      expect(receivedCourse.class.minCredits).toEqual(
        expectedCourse.minCredits
      );
      expect(receivedCourse.class.name).toEqual(expectedCourse.name);
      expect(receivedCourse.class.prereqs).toEqual(expectedCourse.prereqs);
      expect(receivedCourse.class.prettyUrl).toEqual(expectedCourse.prettyUrl);
      expect(receivedCourse.class.subject).toEqual(expectedCourse.subject);
      expect(receivedCourse.class.termId).toEqual(expectedCourse.termId);
      expect(receivedCourse.class.url).toEqual(expectedCourse.url);
      expect(receivedCourse.class.desc).toEqual(expectedCourse.description); // Alias to 'description' if applicable
    });
  });
});
