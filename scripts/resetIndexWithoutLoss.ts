import elastic from "../utils/elastic";
import macros from "../utils/macros";

if (require.main === module) {
  macros.log(
    "Resetting indices without data loss for URL ",
    macros.getEnvVariable("elasticURL")
  );
  (async () => {
    await elastic.resetIndexWithoutLoss();
    macros.log("Success! Closing elastic client and exiting.");
    elastic.closeClient();
    process.exit();
  })().catch((e) => macros.log(e));
}
