---
title:  Notes on PostgreSQL
date: 2019-06-27
categories:
-  software
---

Some notes on PostgreSQL which you may find useful. Thanks to all those numerous StackOverflow answers
that helped me do my job at hand.

## User creation

The first thing you need to be sure of is that you are connected to the right database before you do this.
To find out the current database:

```
SELECT current_database();
```

If the above database is not the one, you want to create the user and their grants for, reconnect
to the right database.

Then, we can create the user:

```

--create user "readonlyuser" and allow them to connect to the database "dbname"
CREATE USER readonlyuser WITH PASSWORD 'plaintextpassword';
GRANT CONNECT ON DATABASE dbname TO readonlyuser


--allow select on all current and future tables in the "public" schema
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonlyuser;
GRANT USAGE ON SCHEMA public TO readonlyuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public  GRANT SELECT ON TABLES TO readonlyuser;

```

## User deletion

First, revoke privileges:

```
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM readonlyuser;
REVOKE USAGE ON SCHEMA public FROM readonlyuser;
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM readonlyuser;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM readonlyuser;
REVOKE CONNECT ON DATABASE dbname FROM readonlyuser;
```

Now, drop the user:

```
drop user readonlyuser;
```

## List all roles/users

```
SELECT
      r.rolname,
      r.rolsuper,
      r.rolinherit,
      r.rolcreaterole,
      r.rolcreatedb,
      r.rolcanlogin,
      r.rolconnlimit, r.rolvaliduntil,
  ARRAY(SELECT b.rolname
        FROM pg_catalog.pg_auth_members m
        JOIN pg_catalog.pg_roles b ON (m.roleid = b.oid)
        WHERE m.member = r.oid) as memberof
, r.rolreplication
, r.rolbypassrls
FROM pg_catalog.pg_roles r
ORDER BY 1;
```