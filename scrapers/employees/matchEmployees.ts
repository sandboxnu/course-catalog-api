/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import _ from "lodash";
import objectHash from "object-hash";
import fs from "fs-extra";
import path from "path";

import macros from "../../utils/macros";
import neuEmployees from "./employees";
import ccisFaculty from "./ccis";
import csshFaculty from "./cssh";
import camdFaculty from "./camd";
import coeFaculty from "./coe";
import "colors";
import { Employee, EmployeeWithId, MatchEmployee } from "../../types/types";

// This file combines the data from the ccis website and the NEU Employees site
// If there is a match, the data from the ccis site has priority over the data from the employee site.
// Matching is first done by email (which is scraped from both sites) and then by name
// Email is a great way to match people, but Name is not because some people use nicknames

// TODO:
// the only name on the output object is the ccis name if there was a match and the employee name if there was not
// Could keep both, or keep the output of the first name/last name logic
// Or maybe if keeping employee name put the first name first so it is in the same order as the ccis name
// Names on the output from this file are "bob smith" and not "smith, bob", even if there was no match

// Possible checks:
// How often people have conflicting data field when merging (eg different phone numbers)

// name

// url.

// Phone. Many people have one database say one phone and a different data source have a different phone. idk.
// phone: '6175586587'

// List of emails. Can be on any domain. Many people list personal emails. Duplicates are removed.
// emails : ['bob@northeastern.edu']

// primaryRole. What their job is. eg: Professor

// What department they work in. eg: CCIS
// primaryDepartment

// officeRoom: 435 Ryder Hall
// officeStreetAddress: 177 Huntington Ave

class CombineCCISandEmployees {
  analytics: Record<string, number>;

  constructor() {
    // Keep track of things that can happen during matching.
    // Output analytics and some statistics after merging each list.
    this.analytics = {};
  }

  resetAnalytics(): void {
    this.analytics = {};
  }

  logAnalyticsEvent(eventName: string): void {
    if (this.analytics[eventName] === undefined) {
      this.analytics[eventName] = 0;
    }
    this.analytics[eventName]++;
  }

  okToMatch(
    matchObj: MatchEmployee,
    person: Employee,
    peopleListIndex: number
  ): null | boolean {
    if (person.emails) {
      const emailDomainMap = {};

      matchObj.emails.forEach((email) => {
        if (!email) {
          macros.warn(
            "Invalid email, not adding to emailDomainMap?",
            email,
            matchObj,
            person,
            peopleListIndex
          );
          return;
        }
        const domain = email.split("@")[1];
        emailDomainMap[domain] = email;
      });

      for (const email of person.emails) {
        const domain = email.split("@")[1];
        if (emailDomainMap[domain] && emailDomainMap[domain] !== email) {
          this.logAnalyticsEvent("emailDomainMismatch");

          macros.verbose(
            `Not matching people because they had different emails on the same domain. ${emailDomainMap[domain]} ${email}`
          );
          return false;
        }
      }
    }

    if (matchObj.peopleListIndexMatches[peopleListIndex]) {
      this.logAnalyticsEvent("sameListNotMatching");
      macros.verbose(
        `Not matching ${matchObj.firstName} ${matchObj.lastName} and ${person.name} because they came from the same list.`
      );
      return false;
    }

    return true;
  }

  async main(): Promise<EmployeeWithId[]> {
    macros.log("Scraping employees...".blue.underline);
    const peopleLists = await Promise.all([
      neuEmployees.main(),
      ccisFaculty.main(),
      csshFaculty.main(),
      camdFaculty.main(),
      coeFaculty.main(),
    ]);

    const mergedPeopleList: MatchEmployee[] = [];

    let peopleListIndex = 0;

    // First, match people from the different data sources. The merging happens after the matching
    for (const peopleList of peopleLists) {
      macros.log(`At people list index #${peopleListIndex}`);

      this.resetAnalytics();

      for (const person of peopleList) {
        let matchesFound = 0;
        this.logAnalyticsEvent("people");

        // Skip to the adding for everyone in the first data set
        // Attempt to match by email
        if (person.emails && peopleListIndex > 0) {
          for (const matchedPerson of mergedPeopleList) {
            // Emails did not overlap at all. Go to next person.
            if (
              _.intersection(matchedPerson.emails, person.emails).length === 0
            ) {
              continue;
            }

            // Final checks to see if it is ok to declare a match.
            if (!this.okToMatch(matchedPerson, person, peopleListIndex)) {
              macros.verbose(
                `Not ok to match 1. ${matchedPerson.firstName} ${matchedPerson.lastName} ${person.name}`
              );
              continue;
            }

            // Found a match.
            matchedPerson.matches.push(person);

            // Update the emails array with the new emails from this person.
            if (person.emails) {
              matchedPerson.emails = matchedPerson.emails.concat(person.emails);
            }
            matchedPerson.emails = _.uniq(matchedPerson.emails);
            matchedPerson.peopleListIndexMatches[peopleListIndex] = true;

            // There should only be one match per person. Log a warning if there are more.
            matchesFound++;
            this.logAnalyticsEvent("matchedByEmail");
            if (matchesFound > 1) {
              macros.warn(`${matchesFound} matches found for ${person.name}`);
            }
          }
        }

        // The rest of this code requires both a first name and a last name
        if (!person.firstName || !person.lastName) {
          this.logAnalyticsEvent("missingNameUnmatchedEmail");
          macros.verbose(
            `Don't have person first name or last name and did not match with email. ${person}`
          );
          continue;
        }

        // Try to match by perfect name matches. If this fails then fallback to ghetto name matches.
        if (matchesFound === 0 && peopleListIndex > 0) {
          for (const matchedPerson of mergedPeopleList) {
            const firstMatch =
              person.firstName.toLowerCase() ===
              matchedPerson.firstName.toLowerCase();
            const lastMatch =
              person.lastName.toLowerCase() ===
              matchedPerson.lastName.toLowerCase();

            // If both the first names and last names did not match, go to next person
            if (!firstMatch || !lastMatch) {
              continue;
            }

            // Final checks to see if it is ok to declare a match.
            if (!this.okToMatch(matchedPerson, person, peopleListIndex)) {
              macros.verbose(
                `Not ok to perfect name match. ${matchedPerson.firstName} ${matchedPerson.lastName} ${person.name}`
              );
              continue;
            }

            // Found a match.
            matchedPerson.matches.push(person);

            // Update the emails array with the new emails from this person.
            if (person.emails) {
              matchedPerson.emails = matchedPerson.emails.concat(person.emails);
            }
            matchedPerson.emails = _.uniq(matchedPerson.emails);
            matchedPerson.peopleListIndexMatches[peopleListIndex] = true;

            macros.verbose(
              `Matching: ${person.firstName} ${person.lastName} : ${matchedPerson.firstName} ${matchedPerson.lastName}`
            );

            // There should only be one match per person. Log a warning if there are more.
            this.logAnalyticsEvent("matchedByPerfectName");
            matchesFound++;
            if (matchesFound > 1) {
              macros.warn(`${matchesFound} matches found for ${person.name}`);
            }
          }
        }

        // If a match was not found yet, try to match by name
        // Skip the first data set (peopleListIndex > 0) because that would just be matching people with that same data set.
        if (matchesFound === 0 && peopleListIndex > 0) {
          // Now try to match by name
          // Every data source must have a person name, so no need to check if it is here or not.
          for (const matchedPerson of mergedPeopleList) {
            const personFirstNameLower = person.firstName.toLowerCase();
            const personLastNameLower = person.lastName.toLowerCase();

            const matchedPersonFirstNameLower =
              matchedPerson.firstName.toLowerCase();
            const matchedPersonLastNameLower =
              matchedPerson.lastName.toLowerCase();

            const firstMatch =
              personFirstNameLower.includes(matchedPersonFirstNameLower) ||
              matchedPersonFirstNameLower.includes(personFirstNameLower);
            const lastMatch =
              personLastNameLower.includes(matchedPersonLastNameLower) ||
              matchedPersonLastNameLower.includes(personLastNameLower);

            // If both the first names and last names did not match, go to next person
            if (!firstMatch || !lastMatch) {
              continue;
            }

            // Final checks to see if it is ok to declare a match.
            if (!this.okToMatch(matchedPerson, person, peopleListIndex)) {
              macros.verbose(
                `Not ok to match 2. ${matchedPerson.firstName} ${matchedPerson.lastName} ${person.name}`
              );
              continue;
            }

            // Found a match.
            matchedPerson.matches.push(person);

            // Update the emails array with the new emails from this person.
            if (person.emails) {
              matchedPerson.emails = matchedPerson.emails.concat(person.emails);
            }
            matchedPerson.emails = _.uniq(matchedPerson.emails);
            matchedPerson.peopleListIndexMatches[peopleListIndex] = true;

            macros.verbose(
              `Matching: ${person.firstName} ${person.lastName} : ${matchedPerson.firstName} ${matchedPerson.lastName}`
            );

            // There should only be one match per person. Log a warning if there are more.
            this.logAnalyticsEvent("matchedByName");
            matchesFound++;
            if (matchesFound > 1) {
              macros.warn(`${matchesFound} matches found for ${person.name}`);
            }
          }
        }

        // If still has no match, add to the end of the matchedArray and generate phone and matching lastName and firstName
        // If there was a match, update the list of emails to match with
        if (matchesFound === 0) {
          const newMatchPerson: Partial<MatchEmployee> = {
            matches: [person],
            emails: [],
            firstName: person.firstName,
            lastName: person.lastName,
            peopleListIndexMatches: {},
          };

          newMatchPerson.peopleListIndexMatches[peopleListIndex] = true;

          if (person.emails) {
            newMatchPerson.emails = person.emails.slice(0);
          }

          if (peopleListIndex > 1) {
            macros.verbose(`Adding ${person.firstName} ${person.lastName}`);
          }
          if (person.primaryRole === "PhD Student") {
            this.logAnalyticsEvent("unmatched PhD Student");
          }

          mergedPeopleList.push(newMatchPerson as MatchEmployee);
        } else if (matchesFound > 1) {
          macros.warn(`${matchesFound} matches found for ${person.name}`);
        }
      }

      // Do some final calculations on the analytics and then log them
      if (
        this.analytics.matchedByEmail !== undefined &&
        this.analytics.matchedByName !== undefined
      ) {
        this.analytics.matched =
          this.analytics.matchedByEmail + this.analytics.matchedByName;
        this.analytics.unmatched =
          this.analytics.people - this.analytics.matched;
      }

      if (Object.keys(this.analytics).length > 0) {
        // Print if we have anything to
        macros.log("Analytics:", JSON.stringify(this.analytics, null, 4));
      }
      peopleListIndex++;
    }

    let mergedEmployees: Employee[] = [];

    mergedPeopleList.forEach((person) => {
      if (person.matches.length === 1) {
        mergedEmployees.push(person.matches[0]);
        return;
      }

      const output: Partial<Employee> = {};
      for (const profile of person.matches) {
        for (const attrName of Object.keys(profile)) {
          // Merge emails
          if (attrName === "emails") {
            if (output.emails) {
              output.emails = _.uniq(output.emails.concat(profile.emails));
            } else {
              output.emails = profile.emails;
            }
            continue;
          }

          if (output[attrName] && output[attrName] !== profile[attrName]) {
            macros.verbose(
              `Overriding ${output[attrName]} \twith ${profile[attrName]}`
            );
          }

          output[attrName] = profile[attrName];
        }
      }

      mergedEmployees.push(output as Employee);
    });

    // Add an empty array for emails if the object dosen't have an emails field
    for (let i = 0; i < mergedEmployees.length; i++) {
      if (!mergedEmployees[i].emails) {
        mergedEmployees[i].emails = [];
      }
    }

    // Add IDs to people that don't have them (IDs are only scraped from employee directory)
    const startTime = Date.now();
    mergedEmployees.forEach((person: Employee, index): EmployeeWithId => {
      if (person.id) {
        return;
      }

      mergedEmployees[index].id = objectHash(person);
    });

    macros.verbose(
      `Spent ${
        Date.now() - startTime
      } ms generating object hashes for employees without IDs.`
    );

    // Remove people who have request their information be removed from the DB.
    // Ask Ryan about this for more details.
    const hiddenProfs = [
      "i.escobedo@northeastern.edu",
      "p.kothamali@northeastern.edu",
    ];
    const beforeModifyCount = mergedEmployees.length;
    mergedEmployees = mergedEmployees.filter((person) => {
      return !(
        person.emails && _.intersection(person.emails, hiddenProfs).length > 0
      );
    });

    // Remove data from individual entries
    for (let i = 0; i < mergedEmployees.length; i++) {
      // This is also a specific exception, ask Ryan about it.
      if (mergedEmployees[i].emails.includes("s.gary@northeastern.edu")) {
        mergedEmployees[i].phone = undefined;
      }
    }

    macros.verbose(
      `Changed/Removed ${
        beforeModifyCount - mergedEmployees.length
      } person(s) from the employee list.`
    );

    // Save the array to disk for the employees API.
    await fs.ensureDir(macros.PUBLIC_DIR);
    await fs.writeFile(
      path.join(macros.PUBLIC_DIR, "employees.json"),
      JSON.stringify(mergedEmployees, null, 4)
    );

    // Turn it into a hashmap instead of a list for the dump
    const employeeDump = _.keyBy(mergedEmployees, "id");

    await fs.writeFile(
      path.join(macros.PUBLIC_DIR, "employeeDump.json"),
      JSON.stringify(employeeDump)
    );

    macros.log("Done scraping employees!\n\n".green.underline);
    return mergedEmployees as EmployeeWithId[];
  }
}

const instance = new CombineCCISandEmployees();

if (require.main === module) {
  instance.main();
}

export default instance;
