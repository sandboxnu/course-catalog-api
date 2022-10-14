?> **Note:** If you're currently on the Northeastern `NUWave` wifi, you can skip this step during setup. However, we highly recommend reading this page!

## What's a cache?

A cache is a locally-stored version of the data we would normally scrape from the Banner API.

## Why use a cache?

This project uses a lot of data, and getting that data takes a long time.

This is further complicated by restrictions that Northeastern imposes on its catalog:

- Requests from outside the campus network (ie. from devices not connected to the `NUWave` network) are throttled
- Responses are relatively slow (perhaps artificially slow)

So, the cache saves us time in development, and also limits our interactions with Northeastern's servers (we don't want to overload them).

## Cache structure

First, some background information on how our cache is structured.

The basic cache structure looks like this:

```
cache
  |
  -- dev_data
     |
     -- v2
  -- requests
```

The `requests` directory contains cached request data. This is automatically handled by our `requests` library.

The `dev_data` directory contains arbitrary data cached by developers. Data can be manually added to this directory throughout our code.

Our caches use a versioning system. We are currently on `v2` of the cache structure, hence the `v2` sub-directory.

## Setup

A cache can be obtained from [our archives](https://github.com/sandboxnu/course-catalog-api-cache). These contain (at the time of writing) all Northeastern semesters accessible on Banner, spanning from 2015 to 2023.

You can `git clone` the repository, and then move one of the cache directories to the `course-catalog-api` directory (so, it'd look something like `course-catalog-api/20XX-XX-cache`. Rename that directory to `cache` (so, `course-catalog-api/cache`).

Now, follow the steps on the **Running the backend** page to populate your database with this cached data.

### Using multiple caches

If you'd like to use the cache of more than one academic year, you can "combine" them. Follow the instructions above for one cache, and ensure that the data is present in your database (ie. follow the steps on the **Running the backend**).

Now, you can delete the `cache` directory, and repeat _both_ steps above. Each time you do so, the new cached data will be added to the existing data - you can "stack" different caches in this manner.

?> **Tip:** For development purposes, we don't recommend "stacking" many caches - it adds unecessary overhead for dev purposes.
