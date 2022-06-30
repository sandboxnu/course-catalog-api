## For Dev Work

#### Q: How do I connect to my dev database?

Run these commands one line at a time

```
  docker exec -it dev_postgresql_1 bash
  psql -U postgres
  \c searchneu_dev
```

## For AWS Infrastructure / Deployment

### Inside The Jumphost

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

## For Elasticsearch

Elasticsearch is interacted via HTTP requests. If you're doing a lot of these to work with ES, I recommend downloading Postman to make this easier. All the commands below are HTTP requests you will make to localhost:9200 (your ES instance).

In general, \_cat requests are for all requests that check on the health/statuts of the ES client. To read more, visit this [API page](https://www.elastic.co/guide/en/elasticsearch/reference/current/search.html).

#### Q: How do I check on the Indexes I have on the elasticsearch client?

- `GET localhost:9200/\_cat/indices`
  - Example output will look like this: <br>
    yellow open classes_blue JB7XCWvASESQ8T7QgEo_bA 1 1 11607 0 3.6mb 3.6mb <br>
    yellow open employees_blue 9zolI39nS-icCxjMAJ-O_g 1 1 1 0 5.1kb 5.1kb
  - The main parts are the name "employees_blue" or "classes_blue" in this case, and the health status, in this case "yellow".
  - There are three status colors, yellow, green and red. We're always in yellow because shard setup, which is separate and complex discussion but TLDR yellow is fine.

#### Q: How do I check on the Aliases I have on the elasticsearch client?

- `GET localhost:9200/\_cat/aliases`
  - Example output will look like this: <br>
    employees employees_blue - - - <br>
    classes classes_blue - - -
  - The first column is the alias name, the second is the index name that the alias points to

#### Q: How do I execute a search generally?

- `POST localhost:9200/\_search`
- Body: `{ "query": { "match_all": {}}}`
  - Be sure to use raw, JSON if you are using Postman
  - Example output should be a large JSON, with the first few relevant search results.
  - The hits object tells you how many documents were retrieved, and it's default capped to 10,000.
  - To learn more about what different queries to use in the body of the request, reference [Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html). Specifically, you can look a match queries.

#### Q: How do I execute a search on a specific index?

- `POST localhost:9200/classes/\_search`
- Body: `{ "query": { "match_all": {}}}`
  - Same as above, but put the index name before search in the url.

#### Q: How do I reindex an index to another?

- `POST localhost:9200/\_reindex`
- Body

```
{
    "source": {
    "index": "classes"
},
    "dest": {
    "index": "classes_green"
    }
}
```

    - the index in source is the index you're copying, the index in dest is the name of the index that will be created after copying the data from source.
    - Example output should be a JSON with details on the operation, if the status code is a 200 it succeeded.

#### Q: How do I change aliases?

- `POST localhost:9200/\_aliases`
- Body

```
{
    "actions": [
        {
            "add": {
                "index": "classes_green",
                "alias": "classes1"
            }
        }
    ]
}
```

    - This doesn't actually work for our index settup right now, because our aliases don't have the correct permissions. However, I thought it was worth mentioning.
    - This endpoint in general allows you to manage aliases witth the given actions you pass. Read more [here](https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-aliases.html).

#### Q: How do I delete an index?

- `DELETE localhost:9200/employees`
  - Example output: `{ "acknowledged": true }`
  - Specify the name of the index in the url, in this case the employees index was deleted.
