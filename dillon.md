## Custom Scraping

Scraping course data for multiple terms can take quite a bit of time. Caching scrapes is fantastic for quickly initializing local databases, but for scraper-related work we might need to run real scrapes often. In order to speed up scraper-related dev work we can specify custom scraping filters so that we only fetch data for a subset of the total courses for the given terms. Filters are specified in `scrapers/filters.js` in the following format:

```js
const filters = {
  subject: (subject) => ["CS", "MATH"].includes(subject),
  courseNumber: (courseNumber) => courseNumber >= 3000,
  truncate: true,
  includeCourseRefs: true,
};
```

The custom scrape will only scrape courses that fulfill **all** filters, so the above can be read as: "Scrape all courses that have subject "CS" or "MATH" AND have a course number 2000 or higher."

### Flags

- `truncate`
  - If `truncate` is set to true, then the `courses` and `sections` tables in your local database will be cleared before they are re-populated with the scraped data.
- `includeCourseRefs`
  - If `includeCourseRefs` is set to true, then the scrape will also include all courses that refer to courses that fultill the filters (e.g. prereqs, coreqs, and courses which the filtered course is a prereq for).

The custom scrape will overwrite the cache, same as a regular scrape.

The command to run the custom scrape is:

`yarn scrape:custom`

TODO: Figure out which other attributes could be filtered on
