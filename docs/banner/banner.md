## What is Banner?

Banner is a product produced by Ellcian, which designs various solutions for higher education institutions.

For Northeastern, our Banner instance can be found [here](https://nubanner.neu.edu/StudentRegistrationSsb/ssb/registration), and generally encompasses registration, planning, searching for courses, etc.

## How do we use it?

Banner has no public API documentation - therefore, everything we use has been reverse-engineered.

Check out the [API documentation](https://jennydaman.gitlab.io/nubanned/dark.html), and if that doesn't work, we have a local copy available <a href="/banner/apiSpec.html">here.</a>

## What are "term IDs"?

Banner uses "term IDs" to internally represent terms. For undergraduates, a "term" is a "semester", but a "term" can also be a "quarter" (for LAW and CPS)

Currently, the term IDs are classified as follows - however, don't rely on this always being true!

The structure of a term ID is `<YEAR><SEASON><TYPE>`

- `<YEAR>` is the 4-digit academic year (ie. the year in which this academic year ends)
  - For example, for the 2022-2023 academic year, we would use `2023`
- `<SEASON>` is a 1-digit code representing the season of the term.
  - `1` - Fall
  - `2` - Winter
  - `3` - Spring
  - `4` - Summer I
  - `5` - Full Summer
  - `6` - Summer II
- `<TYPE>` is a 1-digit code representing what type this term is
  - `0` - Undergraduate Semester
  - `2` - Law Semester
  - `4` - CPS Semester
  - `5` - CPS Quarter
  - `8` - Law Quarter

### Examples

- `202310` - Undergrad Fall Semester for the 2022-2023 academic year
- `202125` - Winter CPS Quarter for 2020-2021 academic year
- `202130` - Undergrad Spring Semester for 2020-2021 school year
