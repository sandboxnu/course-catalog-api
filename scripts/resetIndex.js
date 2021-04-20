import elastic from "../utils/elastic";
import classMap from "../scrapers/classes/classMapping.json";
import employeeMap from "../scrapers/employees/employeeMapping.json";
import macros from "../utils/macros";

if (require.main === module) {
  macros.log("Resetting indices for URL ", macros.getEnvVariable("elasticURL"));
  (async () => {
    await elastic.resetIndex("classes", classMap);
    await elastic.resetIndex("employees", employeeMap);
    macros.log("Success! Closing elastic client and exiting.");
    elastic.closeClient();
    process.exit();
  })().catch((e) => macros.error(e));
}
