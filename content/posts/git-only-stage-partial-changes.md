---
title:  Git Staging partial changes in a file
date: 2018-10-11
categories:
-  software
aliases:
- /git-staging-partial-changes-in-a-file.html
---

Let's say you have made a few changes to a file and only want to stage only some of those changes for commit.
You may want to do so either to create a nice commit history or may be you just want to discard some of the changes.
Either way, `git add -p` is our friend. Let's see an example:

```
$ git add -p file1
...
index b82819b..a281865 100644
--- file1
+++ file2
@@ -139,8 +139,14 @@ else
     docker run \
       -e ConnectionStrings__Db="Data Source=\"tcp:$SQL_SERVER_IP\";Persist Security Info=True;Initial Catalog=$DB_NAME;User ID=$APPLICATION_USER_NAME;Password=$DB_APPLICATION_PASSWORD" \
-      -e App__RedisCS="$REDIS_IP" \
+      -e "${APPLICATION_NAME}_Web__CI__ConnectionStrings__Db"="Data Source=\"tcp:$SQL_SERVER_IP\";Persist Security Info=True;Initial Catalog=$DB_NAME;User ID=$APPLICATION_USER_NAME;Password=$DB_APPLICATION_PASSWORD" \
       --sysctl net.ipv4.ip_local_port_range="49152 65535" -v "$(pwd)":/app -w "/app/$WORK_DIR" -ti --rm microsoft/dotnet:2.1-sdk ./run-tests.bash "$project"
     retVal=$?
Stage this hunk [y,n,q,a,d,/,j,J,g,e,?]? y

```

For each hunk, git will ask you if you want to stage it or not. If you want to, press, 'y', else 'n':
..
```
@@ -185,7 +196,7 @@ else
   ..
   mkdir "$workdir/$SERVICE_DEPLOYABLE"
-  cp -a "$WORK_DIR/$SERVICE_DEPLOYABLE/bin/Release/netcoreapp2.1/$dotnet_env/publish/." "$workdir/$SERVICE_DEPLOYABLE/"
+  cp -a "$SERVICE_DEPLOYABLE/bin/Release/netcoreapp2.1/$dotnet_env/publish/." "$workdir/$SERVICE_DEPLOYABLE/"
 fi

 if [ -z "$WORKER_DEPLOYABLE" ]
Stage this hunk [y,n,q,a,d,/,K,j,J,g,e,?]? n
```


What about the other letters above - like `a, `d` and others? Learn more [here](https://git-scm.com/book/en/v2/Git-Tools-Interactive-Staging).
