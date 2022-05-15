import elastic from "../utils/elastic";
import macros from "../utils/macros";

if (require.main === module) {
  macros.log(
    "Resetting indices for URL",
    process.env["elasticURL"] || "localhost:9200"
  );
  (async () => {
    await elastic.resetIndex();
    macros.log("Success! Closing elastic client and exiting.");
    elastic.closeClient();
    process.exit();
  })().catch((e) => macros.error(e));
}
