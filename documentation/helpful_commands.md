# Some Helpful Commands

## For Dev Work

#### Q: How do I connect to my dev database?

Run these commands one line at a time

- ```
  docker exec -it dev_postgresql_1 bash
  psql -U postgres
  \c searchneu_dev
  ```

## For AWS Infrastructure / Deployment

### Inside The Jumphost

#### Q: What is a jumphost?

A jump server, jump host or jump box is a system on a network used to access and manage devices in a separate security zone. For SearchNEU, the jumphost is an EC2 that can connect to the rest of the AWS infrastructure (database, elasticsearch, etc.)

#### Q: How do I run a production scrape?

- Check out `documentation/infrastructure/production_scrape.md` - it lists out the exact steps to do this

#### Q: How do I view or update data in production?

- `psql <DATABASE URL>` to connect to the staging or prod database and view/update data
  - Remember you can get the database URL from AWS Systems Manager -> Parameter Store

#### Q: How do I migrate majors data into the staging or prod database for Graduate?

- In `~/course-catalog-api` inside the Jumphost, run `DATABASE_URL=<DATABASE URL> yarn babel-node-ts scripts/migrate_major_data.ts`

### Not Inside The Jumphost (but related to the Jumphost)

#### Q: How I copy a local folder/file into the Jumphost?

- In a terminal on your machine, run `scp -i <PATH TO YOUR JUMPHOST PRIVATE KEY> <PATH TO SOME FOLDER/FILE> <JUMPHOST USER>@<JUMPHOST PUBLIC IP ADDRESS>:<DIRECTORY>`
