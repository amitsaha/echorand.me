---
title:  flyway baseline Introducing flyway migrations into existing database
date: 2018-10-12
categories:
-  software
aliases:
- /flyway-baseline-introducing-flyway-migrations-into-existing-database.html
---

If you are trying to introduce [flyway](https://flywaydb.org/) to an existing database with the schemas and tables already
created, you may find [flyway baseline](https://flywaydb.org/documentation/command/baseline) command useful.

Let's say you already have the migration scripts written, or perhaps dumped out of your existing DB setup, and they are:

```
V1__foo.sql
V2__foo_new.sql.
V3__bar.sql
```

You basically want to say - flyway, ignore all scripts upto V3, but if there are newer migrations, run them. To do so,
you run the `baseline` command, like so:

```
$ docker run --rm -v 
  "$(pwd)"/MigrationScripts:/flyway/sql \
  boxfuse/flyway \
  -url="jdbc:<url>" \
  -baselineVersion=3 \
  baseline
```

The key parameter above is `baselineVersion=3`. Executing the above command will create the `schema_version` table 
with a single row, like so:

```
installed_rank	version	description	           type	     script	           checksum	installed_by	installed_on	        execution_time	success
1              3	    << Flyway Baseline >>	BASELINE	<< Flyway Baseline >>	NULL	 UserName	    2018-10-11 23:33:07.4	     0	         1
```

If you now, run `migrate`, you will see it doesn't apply any migrations.
