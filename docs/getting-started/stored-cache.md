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

The cache can be obtained from any current member of the SearchNEU team. You can also generate your own cache; feel free to read through the documentation after finishing this setup guide.

The format will likely be a `.zip` archive, containing the structure mentioned in the above section. To use the cache:

- Unzip the `cache.zip` file, and move the contents to a directory named `cache` in the **root** of the repository
  - ie. `course-catalog-api/cache` (Make sure there isn\'t a `cache` directory in the `cache` directory - depending on how you unzip it, it might have created a nested directory.)
