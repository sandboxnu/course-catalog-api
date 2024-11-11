/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 *
 * script to fill elasticsearch by quering postgres
 */
import { Course, Professor } from "@prisma/client";

import elastic from "../utils/elastic";
import prisma from "../services/prisma";
import ElasticCourseSerializer from "../serializers/elasticCourseSerializer";
import ElasticProfSerializer from "../serializers/elasticProfSerializer";
import macros from "../utils/macros";

export async function bulkUpsertCourses(
  courses: Course[],
): Promise<Promise<unknown>> {
  // FIXME this pattern is bad
  const serializedCourses = await ElasticCourseSerializer.bulkSerialize(
    courses,
    true,
  );
  return elastic.bulkIndexFromMap(elastic.CLASS_ALIAS, serializedCourses);
}

export async function bulkUpsertProfs(
  profs: Professor[],
): Promise<Promise<unknown>> {
  const serializedProfs = await ElasticProfSerializer().bulkSerialize(
    profs,
  );
  return elastic.bulkIndexFromMap(elastic.EMPLOYEE_ALIAS, serializedProfs);
}

export async function populateES(): Promise<void> {
  // FIXME - These Prisma calls used to be in parallel, but Prisma seems to be having issues with parallel calls -
  //    our connection limit is 30, and RDS (our AWS db) reports a max of ~15-20 connections at any time, yet parallel calls
  //    (specifically this one) cause our updater to periodically die due to a lack of free connections (allegedly).
  // This can be switched back to parallel later, but this is low priority - all it does is slow our updater a tiny bit.
  await bulkUpsertCourses(await prisma.course.findMany());
  await bulkUpsertProfs(await prisma.professor.findMany());
}

if (require.main === module) {
  macros.log(
    `Populating ES at ${macros.getEnvVariable(
      "elasticURL",
    )} from Postgres at ${macros.getEnvVariable("dbHost")}`,
  );
  (async () => {
    await populateES();
    macros.log("Success! Closing elastic client and exiting.");
    elastic.closeClient();
    process.exit();
  })().catch((e) => macros.error(e));
}
