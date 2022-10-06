Welcome to the SearchNEU documentation!

## Overview

**"SearchNEU"**, as a complete application, exists in two parts:

- Backend: The backend is our API server, which does all of the heavy lifting. This stores all of the course data - names, IDs, sections, descriptions, etc. It also handles notifications. The user can interact with this data using the frontend.
  - The backend is also used by other applications (like GraduateNU).
- Frontend: The frontend is what a user sees when they go to [searchneu.com](https://searchneu.com). It does not have any data on its own - whenever a user searches for a course, the frontend sends a request to the backend, which returns the data. The frontend handles display; the backend handles data processing.

This is the documentation for the **backend**.
