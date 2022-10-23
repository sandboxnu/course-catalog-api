/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import fs from "fs-extra";
import path from "path";
import pMap from "p-map";
import { Major, Prisma } from "@prisma/client";
import prisma from "../services/prisma";

// In order to execute this module, you need a directory `data`
// that contains the file `majors.json`. The JSON object in
// that file must conform to the `MajorJSON` interface.
// This file will then insert all majors provided in the file
// into the database.

const FILE_NAME = "majors.json";
const CONCURRENCY_COUNT = 10;

interface MajorInput {
  id: string;
  yearVersion: string;
  major: Prisma.JsonValue;
  plansOfStudy: Prisma.JsonValue;
}

interface MajorJSON {
  all_objects: MajorInput[];
}

function fetchData(): MajorJSON {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "data", FILE_NAME), "utf-8")
  );
}

function migrateData(majorDirectory: MajorInput[]): Promise<Major[]> {
  return pMap(
    majorDirectory,
    (m: MajorInput) => {
      const majorId = m.id;
      const yearVersion = String(m.yearVersion);

      const newMajor: Major = {
        majorId,
        yearVersion,
        spec: m.major,
        plansOfStudy: m.plansOfStudy,
      };

      return prisma.major.upsert({
        where: { yearVersion_majorId: { majorId, yearVersion } },
        create: newMajor,
        update: newMajor,
      });
    },
    { concurrency: CONCURRENCY_COUNT }
  );
}

(async () => {
  const startTime = Date.now();
  const ms = await migrateData(fetchData().all_objects);
  const duration = (Date.now() - startTime) / 1000; // how long inserting took in seconds
  console.log(
    `Success! ${ms.length} majors were inserted or updated in ${duration} seconds! You may exit.`
  );
})();
