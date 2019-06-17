---
title:  flyway, SQL server and non-empty schema?
date: 2018-09-28
categories:
-  software
aliases:
- /flyway-sql-server-and-non-empty-schema.html
---

While attempting to use [flyway](https://flywaydb.org/) for SQL server schema migrations, I was consistently getting
an error of the form `Found non-empty schema xxx ithout metadata table! Use init() or set initOnMigrate to true to 
initialize the metadata table.`. Okay, so easy - let me just delete the tables, drop the schema and we will be good.
No luck!

Okay, let's try cleaning it - a destructive process potentially, but the risks were low in my case. So, did a `flyway clean`
and what do I see? There were some [SQL server assemblies](https://docs.microsoft.com/en-us/sql/relational-databases/clr-integration/assemblies-database-engine?view=sql-server-2017).
Apparently they are "global" in nature. 

Removing those unused assemblies fixed the issue with flyway migration.
