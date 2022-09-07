We have three types of tests:

- General:

  - Description:
    - These are basic integration/acceptance/unit tests. No specific setup is necessary for them.
  - Requirements to run:
    - Download the repo
  - Locations:
    - These tests can be found in the `general` folder, or anywhere else in the codebase. For some tests, they are kept in the same directory as their code for ease of access.
    - We don't really prefer one way over the other, but do ask that the `general` directory remain (somewhat) organized

- Database:
  - Description:
    - These tests are database specific, and as such, need a working database instance to test against
  - Requirements to run:
    - Download the repo
    - Have a working PSQL instance running on your local device
  - Locations:
    - Same as **general** tests. The database tests can be differentiated from the general tests by the `.seq` extension, such as `search.test.seq.ts`
- End to end
  - Description:
    - These are end-to-end tests. They do everything, from environment setup onwards. As such -- these tests shouldn't be run locally, they're moreso meant for the CI
  - Requirements to run:
    - Download the repo
    - _Have a local environment (DB, Elasticsearch) that you're willing to completely trash_
      - **Note**: When running in CI, these tests set up their own environment. They can't do that locally, so if you run it locally, don't be surprised if your enviornment gets a little funky.
  - Locations:
    - **Only** in the `tests/end_to_end` directory
