Now for the fun part - actually running the `course-catalog-api`.

Run these commands in order:

1. `yarn install`
   - This command installs all of our dependencies, and it does so locally. In other words, these dependencies are only visible to this project.
2. `yarn dev:docker`
   - This creates two Docker containers for us, which we'll use for running the backend. One is Postgres, a relational database, which we use for storing data. The other is Elasticsearch, which helps us return results for search query.
3. `yarn db:migrate`
   - This does all the setup for our newly-created database, creating all the tables that we need to store our data
4. `yarn db:refresh`
   - This generated a custom Prisma client for our project
   - **Prisma** is an [ORM](https://en.wikipedia.org/wiki/Object-relational_mapping) - it allows us to communicate with our database in a Javascript-based fashion, instead of executing raw SQL statements
5. `yarn scrape`
   - Normally, this command would scrape Northeastern's course catalog for course data. **However**, since we have a `cache` directory, it just populates our database with the cached data.
6. `yarn scrape`
   - You read that right - re-run the scrape command.
   - The second pass-through is necessary to create the table for the term IDs (every term/semester has a unique Northeastern ID). We only store the term IDs for which we have course data, so we need one pass to actually gather the course data, and one to populate the term IDs by comparing against the course data we now how.
7. `yarn dev`
   - This command starts our GraphQL API. You should be able to access it at [`localhost:4000`](http://localhost:4000/) to see the GraphQL playground
