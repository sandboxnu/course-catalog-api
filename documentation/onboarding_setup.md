# Onboarding & SearchNEU Setup

## Overview

**"SearchNEU"**, as a complete application, exists in two parts:

- Backend: The backend is our API server, which does all of the heavy lifting. This stores all of the course data - names, IDs, sections, descriptions, etc. It also handles notifications. The user can interact with this data using the frontend.
  - The backend is also used by other applications (like GraduateNU).
- Frontend: The frontend is what a user sees when they go to [searchneu.com](https://searchneu.com). It does not have any data on its own - whenever a user searches for a course, the frontend sends a request to the backend, which returns the data. The frontend handles display; the backend handles data processing.

## Backend Setup

### Prerequisites

This setup guide tries its best not to assume people have background knowledge, and provides basic setup instructions.

#### Notes

Throughout this, we link to other sites for installation instructions. Those sites will have more updated infomation, and will serve as the source of truth for the installs.

#### Terminal

To work on this project, you\'ll need a UNIX-based terminal. Mac/Linux users already have this - Windows users should install WSL, the Windows Subsystem for Linux.

[WSL installation instructions](https://docs.microsoft.com/en-us/windows/wsl/install-win10) (If this link doesn\'t work, just use the most current instructions provided by Microsoft).

We also recommend installing [Windows Terminal](https://docs.microsoft.com/en-us/windows/terminal/install) - this provides a much more pleasant experience than the Command Prompt.

#### Docker Desktop

- Install [Docker Desktop](https://docs.docker.com/desktop)
- Ensure that `docker-compose` was installed
  - Run `docker-compose --help` in your terminal to check
  - If using Windows, ensure that WSL2 integration is enabled ([WSL integration](https://docs.docker.com/desktop/windows/wsl/))

#### Node Version Manager (nvm)

- Install [NVM](https://github.com/nvm-sh/nvm)
  - This helps you manage Node versions - we have some legacy dependencies (hopefully not for much longer) which limit us
- Install Node
  - Check the status of this PR: https://github.com/sandboxnu/course-catalog-api/pull/64
  - If this PR has been merged:
    - Skip to "Clone the backend repo", and run `nvm use`.
    - There is a file called `.nvmrc` in the repository, which tells `nvm` which version to use
  - If the PR has not been merged:
    - Use Node `12.18`

#### Yarn

- Run `npm i -g yarn`
- This will install `yarn` globally, which helps us manage our dependencies.

### Install/Setup

#### Unpack the cache

Scraping the course information from Northeastern takes a long time, and it resource (memory/network) intensive. Also, we don\'t want to break Banner\'s servers 🙃.

To get around that, we use a course cache. You can get it from any of our current members - it will be a `.zip` file containing the course data.

- Unzip the `cache.zip` file, and move the contents to a directory named `cache` in the **root** of the repository
  - ie. `course-catalog-api/cache` (Make sure there isn\'t a `cache` directory in the `cache` directory - depending on how you unzip it, it might have created a nested directory.)

#### Run

The fun part - run these commands, one after the other.

- `yarn install` - installs all of our dependencies (only installs them locally, specific to this project)
- `yarn dev:docker` - creates a Docker container for our database (Postgres) and for Elasticsearch (which helps us return results for search queries)
- `yarn db:migrate` - sets up our database with all of the tables/structures that we need
- `yarn db:refresh` - generates a custom Prisma client for our project
  - Prisma is an [ORM](https://en.wikipedia.org/wiki/Object-relational_mapping) - it allows us to interface with our database using Javascript, instead of SQL.
- `yarn scrape` - this command _would_ scrape Northeastern for course data, but since we have a `cache` directory, it just populates our database with the cached data.
- `yarn scrape` - yes, run it again. This second pass-through is necessary to generate the table for the term IDs, based off of the historical course data we have.
- `yarn dev` - This should, at this point, let you use the GraphQL API (try hitting http://localhost:4000/ to see the GraphQL playground)

## Frontend Setup

This is a lot easier.

- Download the repo:
  - `git clone https://github.com/sandboxnu/searchneu`
- Run the following:
  - `yarn install`
  - `yarn migrate`
  - `yarn dev:fullstack` (WITH THE BACKEND RUNNING)

You should now have a fully functional Search instance (at http://localhost:5000)

## Common Errors

- at the end: we were running into a problem where cache was taking much longer than expected, and will continue to update on how this turns out.
  - The scrapers don\'t seem to be reading from the cache not sure why that\'s happening
- recorded eddy\'s frontend setup to becca\'s zoom cloud
