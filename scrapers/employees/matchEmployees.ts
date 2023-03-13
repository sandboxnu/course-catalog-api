/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import fs from "fs-extra";
import path from "path";

import macros from "../../utils/macros.js";
import neuEmployees from "./employees.js";
import "colors";
import { Employee } from "../../types/types.js";

/*
Originally, this module combined employee data from the CCIS, COE, CSSH, CAMD, and the overall Northeastern sites.
However, this functionality has been removed. 

For context, employee scraping USED TO be split into two parts:
- NEU api. This gets all NEU faculty from a simple API. Data contains name, department, role, contact information
- College-specific websites. This has more detailed information for each college, and its employees. 
  - However, the data isn't consistent - each college site has different things. Images, personal sites, snippets, etc. 

We removed the college-specific functionality for two reasons:
- The college-specific sites relied on hacky web-scraping and parsing - unstable
- Each college website had different data for employees
  - This looks bad visually - why does one professor have a website link, a headshot, and a personal
      blurb when the other professors just have a name and email?
    - This could potentially lead to professors asking us to add their own extra data - this would be 
        a pain to manage manually
  - Inconsistent styling - for example, COE keeps the accents in names, but NEU doesn't (and neither does Banner). 
      - This creates issues where people are duplicated (eg. Sinan Müftü)


If we ever want to restore this functionality:
- Look at this git hash: 9ba702a8644fa8719e5b01def3a19fb8857e5dff
  - Link: https://github.com/sandboxnu/course-catalog-api/tree/9ba702a8644fa8719e5b01def3a19fb8857e5dff

Two colleges have APIs we can use:
Khoury: [link](https://www.khoury.northeastern.edu/wp-admin/admin-ajax.php)
CAMD: [link](https://camd.northeastern.edu/wp-admin/admin-ajax.php?action=load_faculty_posts&postdata[0][name]=faculty_staff_departments&postdata[0][value]=163&postdata[1][name]=faculty_staff_titles&postdata[1][value]=&postdata[2][name]=faculty_staff_research_areas&postdata[2][value]=)

Two don't: COE and CSSH.
*/

class Employees {
  // Removes data from the professors who have requesed we omit it
  filterProfs(employeeList: Employee[]): Employee[] {
    // Ask Ryan about this for more details.
    const hiddenProfs = [
      "i.escobedo@northeastern.edu",
      "p.kothamali@northeastern.edu",
    ];

    const filteredList = employeeList.filter((person) => {
      return !hiddenProfs.includes(person.email);
    });

    // Remove data from individual entries
    for (const person of filteredList) {
      // This is also a specific exception, ask Ryan about it.
      if (person.email === "s.gary@northeastern.edu") {
        person.phone = undefined;
      }
    }

    return filteredList;
  }

  async main(): Promise<Employee[]> {
    macros.log("Scraping employees...".blue.underline);

    const rawEmployeeList = await neuEmployees.main();
    const employeeList = this.filterProfs(rawEmployeeList);

    // Save the array to disk for the employees API.
    await fs.ensureDir(macros.PUBLIC_DIR);
    await fs.writeFile(
      path.join(macros.PUBLIC_DIR, "employees.json"),
      JSON.stringify(employeeList, null, 4)
    );

    // Turn it into a hashmap instead of a list for the dump
    const employeeDump = {};
    for (const person of employeeList) {
      employeeDump[person.id] = person;
    }

    await fs.writeFile(
      path.join(macros.PUBLIC_DIR, "employeeDump.json"),
      JSON.stringify(employeeDump)
    );

    macros.log(
      `Done scraping employees! (found ${employeeList.length})\n\n`.green
        .underline
    );
    return employeeList;
  }
}

const instance = new Employees();

if (require.main === module) {
  instance.main();
}

export default instance;
