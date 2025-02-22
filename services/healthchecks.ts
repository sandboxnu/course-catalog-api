import axios from "axios";
import macros from "../utils/macros";

export async function sendHealthCheck(): Promise<void> {
  /**
   * Sends out a ping to the pingURL, if there is an error with the updater,
   * a message will be sent to the Search-Support channel in the sandbox slack.
   */
  try {
    await axios.get(process.env.HEALTHCHECK_PING);
  } catch (error) {
    macros.warn("Health checks service is not responding properly: " + error);
  }
}
