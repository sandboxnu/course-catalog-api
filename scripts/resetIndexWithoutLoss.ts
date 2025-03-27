import elastic from "../utils/elastic";
import logger from "../utils/logger";

if (require.main === module) {
  logger.info("resetting indicies without loss");

  (async () => {
    await elastic.resetIndexWithoutLoss();
    logger.info("sucessfully reset indicies without loss");
    elastic.closeClient();
    process.exit();
  })().catch((err) =>
    logger.error("error resetting indicies without loss", { error: err }),
  );
}
