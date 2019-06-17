---
title:  Add an additional host entry to docker container
date: 2017-10-29
categories:
-  infrastructure
aliases:
- /add-an-additional-host-entry-to-docker-container.html
---

**Problem**

Let's say a program in a container should be able to resolve a custom hostname.

**Solution**

When using `docker run`:

```
$ sudo docker run --add-host myhost.name:127.0.0.1 -ti python bash
Unable to find image 'python:latest' locally
latest: Pulling from library/python
Digest: sha256:eb20fd0c13d2c57fb602572f27f05f7f1e87f606045175c108a7da1af967313e
Status: Downloaded newer image for python:latest
...
```

This will show up as an additional entry in the container's `/etc/hosts` file:

```
root@fee9aeccbc4b:/# cat /etc/hosts
...
127.0.0.1	myhost.name
```

With `docker compose`, we can use the `extra_hosts` key:

```
extra_hosts:
    - "myhost.name:127.0.0.1"
```
