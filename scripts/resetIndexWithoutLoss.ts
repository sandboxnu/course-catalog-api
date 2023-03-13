import elastic from "../utils/elastic.js";
import macros from "../utils/macros.js";

if (require.main === module) {
  macros.log(
    "Resetting indices without data loss for URL",
    macros.getEnvVariable("elasticURL") || "localhost:9200"
  );
  (async () => {
    await elastic.resetIndexWithoutLoss();
    macros.log("Success! Closing elastic client and exiting.");
    elastic.closeClient();
    process.exit();
  })().catch((e) => macros.error(e));
}
