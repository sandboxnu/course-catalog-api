Imagine this: the scrapers are broken in production, no one knows why, and you NEED to import a fresh scrape to the production database and ElasticSearch (sound familiar?). Here's how to do it.

1. Have someone run the scrapers locally (assuming they work) and send you a zipped cache.
2. Copy the zipped cache from your machine to the Jumphost. To do this, open up a terminal and run the following command: `scp -i <PATH TO YOUR JUMPHOST PRIVATE KEY> <PATH TO THE ZIPPED CACHE> <JUMPHOST USER>@<JUMPHOST PUBLIC IP ADDRESS>:<DIRECTORY>`.

- `JUMPHOST USER` is most likely `ubuntu` and you can determine `DIRECTORY` by running `pwd` inside the jumphost.

3. Unzip the cache inside `~/course-catalog-api` in the Jumphost, make sure the unzipped folder is named `cache`.
4. If the instance type of the jumphost is `t2 nano`, you'll need to stop the instance and change the instance type to something with more memory like `t2 large` in order for the scrapers to run successfully. If there's not enough memory, the scrapers will exit early with status code 137. **REMEMBER TO CHANGE THE INSTANCE TYPE BACK TO T2 NANO ONCE THE SCRAPERS FINISH RUNNING TO SAVE $!**
5. Run `nvm use`
6. Run `DATABASE_URL=<PROD DATABASE URL> elasticURL=<PROD ELASTICSEARCH URL> yarn scrape` where the database URL and ElasticSearch URL are the secrets in the AWS Parameter Store.
7. **CHANGE THE INSTANCE TYPE BACK TO T2 NANO ONCE THE SCRAPERS FINISH RUNNING TO SAVE $!**
