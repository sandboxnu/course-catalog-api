# Some Helpful Commands

## For Dev Work

- ```
  docker exec -it dev_postgresql_1 bash
  psql -U postgres
  \c searchneu_dev
  ```
  run these one line at a time to connect to your dev database

## For AWS Infrastructure / Deployment

### Inside The Jumphost (the thing that can connect to the rest of the AWS infrastructure)

- `DATABASE_URL=<PROD DATABASE URL> elasticURL=<PROD ELASTICSEARCH URL> yarn scrape` to run a production scrape (you have to be in the `course-catalog-api` project inside the Jumphost)
  - Remember you can get the URL values from AWS Systems Manager -> Parameter Store
- `psql <DATABASE URL>` to connect to the staging or prod database and view/update data

### Not Inside The Jumphost (but related to the Jumphost)

- `scp -i <PATH TO YOUR JUMPHOST PRIVATE KEY> <PATH TO SOME FOLDER/FILE> <JUMPHOST USER>@<JUMPHOST PUBLIC IP ADDRESS>:<DIRECTORY>`to copy a local folder/file into the Jumphost

### Deployment

- `./infrastructure/aws/push-image` in `course-catalog-api` to push a new Docker image to AWS ECR with the `staging` tag
- `./infrastructure/aws/redeploy staging` in `course-catalog-api` to redeploy staging CCA with the latest Docker image tagged with `staging`
- `./infrastructure/aws/redeploy prod` in `course-catalog-api` to tag the latest `staging` Docker image with a `prod` tag then redeploy prod CCA using that image

```

```
