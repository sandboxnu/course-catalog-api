import elastic from "../utils/elastic";
import logger from "../utils/logger";

if (require.main === module) {
  logger.info("resetting indicies");

  (async () => {
    await elastic.resetIndex();
    logger.info("sucessfully reset indicies");
    elastic.closeClient();
    process.exit();
  })().catch((err) => logger.error("error resetting indicies", { error: err }));
}
