Now for the fun part - actually running the `course-catalog-api`.

Run these commands in order:

1. `cp template.env .env`
   - This will copy our templated `.env` file for your own use. Some of these environment variables are required for our codebase to work. **Make sure to fill them out!**
1. `yarn install`
   - This command installs all of our dependencies, and it does so locally. In other words, these dependencies are only visible to this project.
1. `yarn dev:docker`
   - This creates two Docker containers for us, which we'll use for running the backend. One is Postgres, a relational database, which we use for storing data. The other is Elasticsearch, which helps us return results for search query.
1. `yarn db:migrate`
   - This does all the setup for our newly-created database, creating all the tables that we need to store our data
1. `yarn db:refresh`
   - This generated a custom Prisma client for our project
   - **Prisma** is an [ORM](https://en.wikipedia.org/wiki/Object-relational_mapping) - it allows us to communicate with our database in a Javascript-based fashion, instead of executing raw SQL statements

!> **Important:** If you are not on the Northeasern `NUWave` wifi (or don't want to wait for a scrape \[~30 minutes\]), please read the "Cache structure" page.

5. `yarn scrape`
   - Normally, this command would scrape Northeastern's course catalog for course data.
     - If you have installed the cache (see "Cache structure"), this command will just populate our database with the cached data. No network calls will be made.
     - If not, this will scrape Northeastern's live Banner API.
6. `yarn dev`
   - This command starts our GraphQL API. You should be able to access it at [`localhost:4000`](http://localhost:4000/) to see the GraphQL playground

?> Mac users may get a message along the lines of `Port 5000 already in use`. There's a process called `Control Center` running on that port; it's the AirPlay server. This can be disabled by turning off "AirPlay Receiver" in the "Sharing" System Preference.
