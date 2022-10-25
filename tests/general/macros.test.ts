/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import macros from "../../utils/macros";

it("logging things work", () => {
  macros.warn();
  macros.verbose();
  macros.error("fjdaj");
});

it("some other stuff doesnt crash", () => {
  macros.logAmplitudeEvent("test event", { hi: 4 } as any);
});

it("logAmplitudeEvent should not crash", () => {
  macros.logAmplitudeEvent("event_from_testing", { a: 3 } as any);
});
