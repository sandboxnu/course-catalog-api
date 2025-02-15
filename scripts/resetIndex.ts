// import elastic from "../utils/elastic.ts";
// import macros from "../utils/macros.ts";
//
// if (require.main === module) {
//   macros.log(
//     "Resetting indices for URL",
//     macros.getEnvVariable("elasticURL") || "localhost:9200",
//   );
//   (async () => {
//     await elastic.resetIndex();
//     macros.log("Success! Closing elastic client and exiting.");
//     elastic.closeClient();
//     process.exit();
//   })().catch((e) => macros.error(e));
// }
