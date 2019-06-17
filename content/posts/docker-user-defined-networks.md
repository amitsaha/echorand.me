---
title:  User-defined networks in Docker for inter-container communication on Linux
date: 2017-10-26
categories:
-  infrastructure
aliases:
- /user-defined-networks-in-docker-for-inter-container-communication-on-linux.html
---


**Problem**

Let's say a program in a container wants to communicate with a service running in another docker container
on the same host. The current recommended approach to do so is using a `user-defined` network and 
[avoid](https://docs.docker.com/engine/userguide/networking/default_network/dockerlinks/) using `links`.

**Solution**

![Docker user defined network]({filename}/images/docker-user-defined-network.png "Docker user defined network")


Create an [user-defined network](https://docs.docker.com/engine/userguide/networking/#user-defined-networks)
and run both (or as many you have) the containers in this network:
(For reference, I am using docker 17.09.0-ce)

```
$ sudo docker network create --driver bridge webapp1
```

The first container which we will launch in this network is a HTTP server listening 
on port 8000. The `Dockerfile` is as follows:

[gist:id=bd31ad432f83bfd178f0cedd7a45d59f,file=webapp.Dockerfile]

Start the container in the network we created above:

```
$ sudo docker run -d -network webapp1 -name webapp amitsaha/webapp
94a3f4631eb924f7e4339986b73b1af7fca4c09b2a1a8d3ea106b698eae5c577
```

Now, we will communicate with the web application from another container:

```
$ sudo docker run -network webapp1 -rm appropriate/curl -fsSL webapp:8000
<!DOCTYPE HTML PUBLIC “-//W3C//DTD HTML 4.01//EN” “http://www.w3.org/TR/html4/strict.dtd">
<html>
...
```

If we tried to communicate with webapp container from a container on a different network, 
we will get a name resolution error:

```
$ sudo docker run --rm appropriate/curl -fsSL webapp:8000
curl: (6) Couldn't resolve host 'webapp'
```

**Background information**

When we install docker, by default, we have three networks:

```
$ sudo docker network ls
NETWORK ID          NAME                DRIVER              SCOPE
8a6a3da7b5a2        bridge              bridge              local
31f4f28111f0        host                host                local
b0dfa09e8949        none                null                local
```

When we run a container (like so, `docker run -ti <image>`), it will use the default `bridge` network. 
In this network mode, your container can access the outside world and the outside world can communicate 
with your container via published service ports. In this mode, however there is no "automagic" way for 
another container using the bridge network to communicate with it. The `host` network runs a container in 
the host’s network space. The `none` network essentially gives our container only the loopback interface.

When we create a user-defined network, we are creating an isolated network for our containers where we 
[automatically](https://docs.docker.com/engine/userguide/networking/configure-dns/)
get container name resolution to facilitate inter-container communication. In addition, 
we can expose and publish ports for a service to be also accessible from outside the container.
If you look at the output of `docker network ls` again, you will see an additional entry 
for the network we created:

```
$ sudo docker network ls
NETWORK ID          NAME                DRIVER              SCOPE
e865bd63c762        webapp1             bridge              local
```

**References**

- Learn [more](https://docs.docker.com/engine/userguide/networking/) about docker container networking.
- To learn even more, I recommend [Demystifying container networkking](http://blog.mbrt.it/2017-10-01-demystifying-container-networking/?utm_source=webopsweekly&utm_medium=email).
