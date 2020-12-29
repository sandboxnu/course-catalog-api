# The Course Catalog API

## TODO
- [x] Copy over GraphQL API
- [x] Copy over its dependency graph
- [x] Copy over Data Pipeline
- [x] Copy over its dependency graph
- [x] Make sure things run locally
- [ ] Copy over tests (see if they run/pass)
- [ ] Copy over infrastructure/deployment stuff
- [ ] Associate the new repo with a new project in Terraform Cloud

- [ ] Clear out unnecessary dependencies (unused packages and scripts)
- [ ] Configure CI/CD (GitHub Actions)
- [ ] Add Prettier, ESlint, Husky
- [ ] Run codemod for prisma update
- [ ] Fix Rollbar, Amplitude, etc.
- [ ] Re-organize repo
    - Gonna need to re-configure the `package.json` scripts and config files

## Questions
1. Should we rename `class` to `course` in the GraphQL API?
2. What do we do about directory structure?
3. How are we going to share types and modules?
    - Create a Sandbox-sponsored NPM package
4. What do about the `data/` directory (for majors)?
