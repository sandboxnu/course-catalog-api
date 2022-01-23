## Blue green deployment and Aliases

Our elasticsearch indexes now use a blue green deployment. A blue green deployment involves the use of an alias in our ES client. An alias is essentially a reference that maintains a constant name. For example, the alias, "classes", will always have the name classes. However, it will reference an index (via name), and this reference may change.

Any interactions with an alias that you might perform on an index will simply be forwarded to its reference. for example, if one were to execute a query on an alias "classes", while it referenced "classes_green", it would forward the query to classes_green, and return the result for the user.

This extra layer of abstraction allows us to perform actions behind the scenes, while a service/user does not have to change behavior. The most important thing we do behind the scenes is reindexing.

Say you want to reset an ES index in order to catch new mapping changes for the documents, or in general to just refresh it. You may use the reset index action, but doing so drops all the data inside that ES index. Therefore, you might try reindexing instead. To reindex, we first "clone" the index by copying its data to another new index. This new index can have a different mapping but still catch the old data (there is a caveat here explained below). Thus, you now have two indexes, one with the updated mapping, and one with the old one. Both have data. Now, you simply switch the alias to point to this new one, then delete the old index.

This is blue green deploymemt, named so because the index names are typically named classes_green, classes_blue, etc. By using an alias, we can do any needed updates on a non-live index, then switch which is live, and delete the old one.

The caveat with blue green deployment and reindexing is that mapping differences can be drastic enough to cause issues with the reindexing. In general, small differences like a setting, data type change, etc can be interpeted. But big changes will require a script such that ES understands how to migrate the data from one index to another with a completely different mapping. We do not have functionality to support scripts yet.

The second caveat is that ES is by nature non-transactional. This means we have no guarauntee that data transfers or insertions are successful. We currently have no mechanism for checking other than status codes on the requests.

## Helpful commands for diagnosing your elasticsearch instance

Check helpful_commands.md
