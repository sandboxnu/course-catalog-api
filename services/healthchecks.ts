import axios from "axios";
import macros from "../utils/macros";

export async function sendHealthCheck(): Promise<void> {
  const pingURL = "	https://hc-ping.com/7d9197be-db67-4cc5-be00-1a3df56d0918";
  /**
   * Sends out a ping to the pingURL, if there is an error with the updater,
   * a message will be sent to the Search-Support channel in the sandbox slack.
   */
  try {
    await axios.get(pingURL);
  } catch (error) {
    macros.warn("Health checks service is not responding properly: " + error);
  }
}
