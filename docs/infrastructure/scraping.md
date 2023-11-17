Our scrapers in AWS are currently inactive, so we run our scrapes manually. This only needs to be done when classes for a new semester are released, or when a new environment is set up.

1. We prefer not running the actual scrape in production - instead, get a zip file of the cached information you want to insert

- To get this information, you can either:
  - Run the scrapers in your local environment
  - Copy the information you need from the [Course Catalog cache](https://github.com/sandboxnu/course-catalog-api-cache)

2. Copy the zipped cache from your machine to the Jumphost. To do this, open up a terminal and run the following command:

```bash
scp -i <PATH TO YOUR JUMPHOST PRIVATE KEY> <PATH TO THE ZIPPED CACHE> <JUMPHOST USER>@<JUMPHOST PUBLIC IP ADDRESS>:<DIRECTORY>
```

- `JUMPHOST USER` is most likely `ubuntu` and you can determine `DIRECTORY` by running `pwd` inside the jumphost.

3. Unzip the cache inside `~/course-catalog-api` in the Jumphost, make sure the unzipped folder is named `cache`.
4. If the instance type of the jumphost is `t3 nano`, you'll need to stop the instance and change the instance type to something with more memory like `t3 large` in order for the scrapers to run successfully. If there's not enough memory, the scrapers will exit early with status code 137.
5. Run `fnm use`
6. Run `DATABASE_URL=<PROD DATABASE URL> elasticURL=<PROD ELASTICSEARCH URL> yarn scrape` where the database URL and ElasticSearch URL are the secrets in the AWS Parameter Store.

!> **Important:** Remember to change the instance type back to `t3.nano` when the scrape finishes to save credits!
