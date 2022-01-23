# The Course Catalog API

## Installation

1. If you don't have these on your machine, install:

- git
- node
- yarn
- Docker Desktop

2. Launch Docker Desktop by clicking on the app
3. Clone the repo by running `git clone https://github.com/sandboxnu/course-catalog-api.git` in your terminal
4. In your terminal, navigate to this project and run the following commands:

- `yarn install`
- `yarn dev:docker`
- `yarn db:migrate`
- `yarn db:refresh`
- Optional step: if you have a cache zip/folder, unzip it, make sure it's named `cache` and place it in the root level of the project so your project directory looks something like this:

```
PROJECT
  |
  -- package.json
  -- ...
  -- cache
      |
      -- dev_data
          |
          -- v2
      -- requests
```

This step allows you to quickly insert the course catalog data into your database by using a cache with all the information instead of having to run the full scrapers.

- `yarn scrape`
- `yarn dev`

5. At this point, you should be able to use the GraphQL API by visiting `localhost:4000`

## Custom Scraping

Scraping course data for multiple terms can take quite a bit of time. Caching scrapes is fantastic for quickly initializing local databases, but for scraper-related work we might need to run real scrapes often. In order to speed up scraper-related dev work we can specify custom scraping filters so that we only fetch data for a subset of the total courses for the given terms. Filters are specified in `scrapers/filters.ts` in the following format:

```js
const filters = {
  campus: (campus) => true,
  subject: (subject) => ["CS", "MATH"].includes(subject),
  courseNumber: (courseNumber) => courseNumber >= 3000,
  truncate: true,
};
```

The custom scrape will only scrape courses that fulfill **all** filters, so the above can be read as: "Scrape all courses from all campuses that have subject "CS" or "MATH" AND have a course number 3000 or higher. Clear out my local database before inserting the custom scrape data."

The custom scrape will _not_ overwrite the cache, and therefore it will also never read from the cache.

### Flags

- `truncate`
  - If `truncate` is set to true, then the `courses` and `sections` tables in your local database will be cleared before they are re-populated with the scraped data. The `classes` elasticsearch index will also be cleared before being re-populated with scraped data.

### Related Courses

There are a number of course-to-course relations that we store - coreqs of a course, prereqs of a course, courses that the given course is a prereq of, and courses that the given course is an optional prereq of. It's important to note how the custom scrape will behave in these cases, for example if `Course A` is a prereq of `Course B`, and the filters include `Course B` but _not_ `Course A`.

Assuming the filters include `B` but _not_ `A`:

- If `B` has `A` as a `prereq` or `coreq`, then in your local database `B` will know that `A` exists as a `prereq` or `coreq`, but `A` will not have been scraped so `A` will be marked as `missing` in the `prereq` or `coreq` field.
- If `A` has `B` as a `prereq` or `optionalPrereq`, then `B` will not know anything about `A`, meaning `B`'s `prereqs_for` or `opt_prereqs_for` fields will _not_ include `A`.

In summary, if you're looking at any course-to-course info while using a custom scrape then pay extra attention to what exactly you scraped. When in doubt, do a full scrape.

The command to run the custom scrape is:

`yarn scrape:custom`

## TODO

- [ ] Clear out unnecessary dependencies (unused packages and scripts)
- [ ] Get rid of unnecessarily large packages
- [ ] Configure CI/CD (GitHub Actions)
- [x] Add Prettier, ESlint, Husky
- [x] Run codemod for prisma update
- [ ] Fix Rollbar, Amplitude, etc.

  - Need to create new project for these

- [ ] divide dependencies into prod and dev dependencies

- [ ] Clean up `jest` config
- [ ] Add config for unit tests
- [ ] Rename `seq` to `db`
- [ ] Move Major changes to new repo

## Questions

1. Should we rename `class` to `course` in the GraphQL API?
2. What do we do about directory structure?
3. What do about the `data/` directory (for majors)?

## Infrastructure TODOs

- [ ] Fix the AWS scripts
- [ ] Fix the other scripts
