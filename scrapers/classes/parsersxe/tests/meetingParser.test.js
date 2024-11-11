import MeetingParser, { forTesting } from "../meetingParser";
import data from "./data/meetingParser.data";

const { hhmmToSeconds, mmddyyyyToDaysSinceEpoch } = forTesting;

it("meetingParser.ts", () => {
  expect(MeetingParser.parseMeetings(data.htlh2200)).toMatchSnapshot();
});

it("profname", () => {
  expect(MeetingParser.profName({ displayName: "Chu, Daj" })).toEqual(
    "Daj Chu",
  );
  expect(MeetingParser.profName("Lastname, Firstname")).toEqual(
    "Firstname Lastname",
  );
});

it("hhmmToSeconds", () => {
  expect(hhmmToSeconds("0000")).toEqual(0);
  expect(hhmmToSeconds("0010")).toEqual(600);
  expect(hhmmToSeconds("0100")).toEqual(3600);
  expect(hhmmToSeconds("0101")).toEqual(3660);
});
