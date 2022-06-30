## Overview

The updater service can be thought of as a lightweight scrape. To compare the two:

- **Scrapes** fetch all of the data we need for this API. It gets every aspect of the course and employee data, parses it, and saves it
- **Updates** are used to update data, and requires some data to be present first.
  - Only frequently-changing data are updated by the updater. For example:
    - ✅ The number of seats available in a section (expected to change frequently)
    - ✅ The times/dates of a section's meetings
    - ❌ The name of the course (shouldn't change frequently)
    - ❌ The course's NUPath attributes

The updater is also responsible for notification data. SearchNEU allows users to register for notifications if a section opens up a seat. Since the updater gathers seating information for sections, we use this to inform when to send out notifications.
