---
title:  Tip MySQL - Too many connections
date: 2018-01-04
categories:
-  mysql
aliases:
- /tip-mysql-too-many-connections.html
---

If you are getting the "Too many connections" error, couple of things worth checking on the MySQL server:

```
mysql> show processlist;
..
```

The above will show the currently open connections. The second is:

```
mysql> show variables like "max_connections";
..
```
The above will show the configured `max_connections` allowed. When you get this error, this value is less than or equal to the 
number of rows returned by `show processlist`.
