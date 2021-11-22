/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 *
 * Translates information about meeting times from NUBanner to SearchNEU backend standard.
 * This module does synchronous operations on JavaScript objects,
 * its input should be JSON stuff retrieved from NUBanner.
 */

import moment from "moment";
import macros from "../../../utils/macros";
import {BackendMeeting, FacultyMeetingTime, MeetingTime} from "../../../types/types";

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_DAY = 86_400;

/**
 * "LastName, FirstName" --> "FirstName LastName"
 * @param xeData should be an element of the fmt.faculty array as returned from
 * https://jennydaman.gitlab.io/nubanned/dark.html#searchresults-meeting-times-get
 */
function profName(xeData: string | { displayName: string }): string {
	// consider reusing existing solution?
	// https://github.com/ryanhugh/searchneu/blob/274fb0976acd88927835c8621aa4a0931c5e9397/backend/scrapers/employees/employees.js#L187
	if (typeof xeData === 'object' && 'displayName' in xeData) {
		xeData = xeData.displayName;
	}

	if (typeof xeData !== "string") {
		macros.error("parameter should be a string");
	}
	return xeData
	.split(",")
	.map(s => s.trim())
	.reverse()
	.join(" ");
}

/**
 * example "0915" -> 9 * 3600 + 15 * 60 = 33300
 * @param hhmm 24hr time representation as "HHMM" (4 digits, no colon)
 * @return {number/string} of seconds since midnight OR "TBD"
 */
function hhmmToSeconds(hhmm: string): number | string {
	if (!hhmm) {
		return "TBD";
	}
	if (hhmm.length !== 4) {
		macros.error(`Length of hhmm time string "${hhmm}" is not 4`);
	}
	const hours = parseInt(hhmm.substring(0, 2), 10) * SECONDS_PER_HOUR;
	const minutes = parseInt(hhmm.substring(2), 10) * SECONDS_PER_MINUTE;
	return hours + minutes;
}

/**
 * example: '01/07/2019' --> 17903
 * @param mmddyyyy a date as "MM/DD/YYYY"
 * @return {number} whole number of seconds since epoch
 */
function mmddyyyyToDaysSinceEpoch(mmddyyyy: string): number {
	// moment is in GMT, epoch is in UTC, apparently those are the same.
	return Math.trunc(moment(mmddyyyy, "MM/DD/YYYY").unix() / SECONDS_PER_DAY);
}

const DAYS = [
	"sunday",
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
];

/**
 * example result:
 * "times": {
 *     "1": {
 *       "start": 36000,
 *       "end": 52200
 *     },
 *     "3": {
 *       "start": 36000,
 *       "end": 52200
 *     }
 * }
 * @param meetingTime
 */
function days(meetingTime: { beginTime: string, endTime: string }): Partial<Record<"0" | "1" | "2" | "3" | "4" | "5" | "6", MeetingTime[]>> {
	const times = {};
	const info = [
		{
			start: hhmmToSeconds(meetingTime.beginTime),
			end: hhmmToSeconds(meetingTime.endTime),
		},
	];

	for (let i = 0; i < DAYS.length; i++) {
		if (meetingTime[DAYS[i]]) {
			times[i.toString()] = info;
		}
	}
	return times;
}

/**
 * @param facultyMeetingTimes meetingsFaculty object from search results, or /searchResults/getFacultyMeetingTimes
 */
function parseMeetings(facultyMeetingTimes: { meetingTime: FacultyMeetingTime }[]): BackendMeeting[] {
	return facultyMeetingTimes.map((m): BackendMeeting => {
		const meetingTime = m.meetingTime;
		return {
			startDate: mmddyyyyToDaysSinceEpoch(meetingTime.startDate),
			endDate: mmddyyyyToDaysSinceEpoch(meetingTime.endDate),
			where: meetingTime.buildingDescription
					? `${meetingTime.buildingDescription} ${meetingTime.room}`
					: "TBA",
			type: meetingTime.meetingTypeDescription,
			times: days(meetingTime),
		};
	});
}

export default {parseMeetings: parseMeetings, profName: profName};


export const forTesting = {hhmmToSeconds, mmddyyyyToDaysSinceEpoch};