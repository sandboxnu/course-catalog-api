## Overview

In a nutshell - Elasticsearch (ES) is used to handle our searches. In their own words, Elasticsearch is "a distributed, free and open search and analytics engine for all types of data".

Every search query goes through Elasticsearch, which does some weighting of results & returns course/employee information.

## Technical Information

Elasticsearch (ES) has a concept of "indexes", which are similar to a "database" in a relational database. In short, it's a namespace for data.

Our Elasticsearch setup has two indexes, `classes` and `employees`.

### Blue/Green Deployment

Our ES indexes now use a blue/green deployment mechanism, which allows us to make changes without any downtime on the user side.

We make use of **aliases** to make this work. An alias is essentially a mapping - `name -> index_name`, where `index_name` is any Elasticsearch index. The alias name is a constant - for example, the alias `classes` will always keep this name. However, the `index_name` referenced may change.

Say you want to reset an ES index in order to catch new mapping changes for the documents, or in general to just refresh it. You may use the reset index action, but doing so drops all the data inside that ES index. Therefore, you might try reindexing instead. To reindex, we first "clone" the index by copying its data to another new index. This new index can have a different mapping but still catch the old data (there is a caveat here explained below). Thus, you now have two indexes, one with the updated mapping, and one with the old one. Both have data. Now, you simply switch the alias to point to this new one, then delete the old index.

As an example: we have a `classes` alias, which at any given time may reference either the `classes_green` index or the `classes_blue` index.

Any interactions with an alias that you might perform on an index will simply be forwarded to its reference. for example, if one were to execute a query on an alias `classes`, while it referenced `classes_green`, it would forward the query to `classes_green`, and return the result for the user. This extra layer of abstraction allows us to perform actions behind the scenes, while a service/user does not have to change behavior. The most important thing we do behind the scenes is reindexing.

#### Caveats

The caveat with blue green deployment and reindexing is that mapping differences can be drastic enough to cause issues with the reindexing. In general, small differences like a setting, data type change, etc can be interpeted. But big changes will require a script such that ES understands how to migrate the data from one index to another with a completely different mapping. We do not have functionality to support scripts yet.

The second caveat is that ES is by nature non-transactional. This means we have no guarauntee that data transfers or insertions are successful. We currently have no mechanism for checking other than status codes on the requests.
