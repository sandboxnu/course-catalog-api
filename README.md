# The Course Catalog API

## TODO
- [x] Copy over GraphQL API
- [x] Copy over its dependency graph
- [x] Copy over Data Pipeline
- [x] Copy over its dependency graph
- [x] Make sure things run locally
- [x] Copy over tests (see if they run/pass)
- [ ] Copy over infrastructure/deployment stuff
- [ ] Associate the new repo with a new project in Terraform Cloud
- [ ] Create docs directory

- [ ] Clear out unnecessary dependencies (unused packages and scripts)
- [ ] Get rid of unnecessarily large packages
- [ ] Configure CI/CD (GitHub Actions)
- [ ] Add Prettier, ESlint, Husky
- [x] Run codemod for prisma update
- [ ] Fix Rollbar, Amplitude, etc.
    - Need to create new project for these
- [ ] Re-organize repo
    - Gonna need to re-configure the `package.json` scripts and config files

- [ ] Move to `api.searchneu.com`?
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
- [ ] Create a new terraform project (and link it to the repo)
- [ ] Attempt to launch it
- [ ] Fix the AWS scripts
- [ ] Fix the other scripts

- [ ] If you need to create AWS_ACCESS_*, do that, and update it in GitHub (and terraform?)
- [ ] grab the GITHUB_TOKEN and add it to terraform
- [ ] rename, then un-rename name changes to generated parameters (DATABASE_URL & elasticURL)

#### Questions to Answer

