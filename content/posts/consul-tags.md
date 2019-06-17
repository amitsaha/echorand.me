---
title:  Brief overview of using consul tags
date: 2017-12-01
categories:
-  infrastructure
aliases:
- /brief-overview-of-using-consul-tags.html
---

[consul](https://www.consul.io/) allows a service to associate itself with `tags`. These are arbitrary
metadata that can be associated with the service and can be used for different purposes. Below I outline
a few examples of making use of tags and discuss some related topics.

## Use case #1: Dedicated service instances based on requests

Let's say our service is a HTTP server (REST API) acting as a routing point for multiple 
independent resources with the following service definition:


```
{
  "service": {
    "name": "api",
    "address": "",
    "port": 8080,
    "checks": [],
  }
}
```

We can then communicate with service using the DNS, `api.service.consul`.

Let's assume we are running N copies of this service, but want to have dedicated sub-pools for 
separate resource groups. We will assign the services in each pool a different tag as follows:

**projects**

```
{
  "service": {
    "name": "api",
    "address": "",
    "port": 8080,
    "checks": [],
    "tags":["projects"],
  }
}
```


**users**

```
{
  "service": {
    "name": "api",
    "address": "",
    "port": 8080,
    "checks": [],
    "tags":["users"],
  }
}
```

Once we register the services using the different tags, they automatically become discoverable via DNS
as `projects.api.service.consul` and `users.api.service.consul` respectively. Assuming that the routing 
to our HTTP server is happening in a higher layer, we will then direct traffic to these pools as follows:

```
api/projects/ -> projects.api.service.consul
api/users/ -> users.api.service.consul
```

## Use case #2: Running different versions of your service

We can use tags to run two different versions of our application for testing, gathering
performance data, blue-green deployment or any other reason:

**v1**

```
{
  "service": {
    "name": "api",
    "address": "",
    "port": 8080,
    "checks": [],
    "tags":["v1"],
  }
}
```


**v2**

```
{
  "service": {
    "name": "api",
    "address": "",
    "port": 8080,
    "checks": [],
    "tags":["v2"],
  }
}
```

We can then use a tag based weighted mechanism at a higher level proxy (such as [linkerd](https://github.com/linkerd/linkerd/commit/718514fb1d4b86153820880162d3c9559e115725)) to send traffic to these different service
versions.

## Use case #3: Other metadata

This [issue](https://github.com/hashicorp/consul/issues/997/) on consul's project discusses using
tags as a way to have artbitary metadata for a service due to the lack of support for key-value
labels.


## Using tags for discovery

Besides using the DNS interface for communicating with the services, we can use `tags` as filter with
the consul [catalog API](https://www.consul.io/api/catalog.html). However, it currently supports a single
tag. There is a feature request [open](https://github.com/hashicorp/consul/issues/1781) to support multiple
tags.


## Demo: Running two versions of a service

I have two versions of a service, `api`. Each service is running in a separate docker container on port 8080.
`v1` and `v2` are also the tags associated with the respective instances. The demo source code can be found 
[here](https://github.com/amitsaha/consul-demo). To follow along, clone the repository, install `docker` and 
`docker-compose`.

### Start consul and the two versions of the API

```
$ pushd tags/api/v1
$ ./build-image.sh
$ popd

$ pushd tags/api/v2
$ ./build-image.sh
$ popd

$ pushd tags
$ docker-compose up
```

We should see the following output from `docker-compose up`:

```
consul    |     2017/12/01 04:01:03 [DEBUG] http: Request PUT /v1/agent/service/register (1.020389ms) from=172.21.0.4:34030
consul    |     2017/12/01 04:01:03 [DEBUG] agent: Service 'apiv2' in sync
consul    |     2017/12/01 04:01:03 [DEBUG] agent: Node info in sync
consul    |     2017/12/01 04:01:03 [DEBUG] agent: Service 'apiv2' in sync
consul    |     2017/12/01 04:01:03 [DEBUG] agent: Node info in sync
consul    |     2017/12/01 04:01:04 [DEBUG] agent: Service 'apiv2' in sync
consul    |     2017/12/01 04:01:04 [INFO] agent: Synced service 'apiv1'
consul    |     2017/12/01 04:01:04 [DEBUG] agent: Node info in sync
consul    |     2017/12/01 04:01:04 [DEBUG] http: Request PUT /v1/agent/service/register (3.333932ms) from=172.21.0.3:42486
consul    |     2017/12/01 04:01:04 [DEBUG] agent: Service 'apiv2' in sync
consul    |     2017/12/01 04:01:04 [DEBUG] agent: Service 'apiv1' in sync
consul    |     2017/12/01 04:01:04 [DEBUG] agent: Node info in sync
consul    |     2017/12/01 04:01:04 [DEBUG] agent: Service 'apiv1' in sync
consul    |     2017/12/01 04:01:04 [DEBUG] agent: Service 'apiv2' in sync
consul    |     2017/12/01 04:01:04 [DEBUG] agent: Node info in sync
```

### Start the dnsmasq container

Next, we are going to start a new docker container running [dnsmasq](http://www.thekelleys.org.uk/dnsmasq/doc.html):

```

$ < repo root >
$ pushd support/dnsmasq
$ ./start-dnsmasq.sh
```

### Start the API client container

Now, let's start a container which will act as an API client:

```
$ < repo root >
$ cd support/apiclient
$ ./start-client.sh 

/ # dig api.service.consul +short
172.21.0.4
172.21.0.3

/ # dig v1.api.service.consul +short
172.21.0.3

/ # dig v2.api.service.consul +short
172.21.0.4

/ # curl v1.api.service.consul:8080/ping/
Hi there! I am v1/ # 

/ # curl v2.api.service.consul:8080/ping/
Hi there! I am v2/ # 

```

### Points to note

While working on the demo, I found out that I needed to specify the IP address of the service I was registering.
Otherwise, they were being registered with empty IP addresses. This could be due to those services running in the 
`docker` container. I am not sure.

I also learned that since I was running a single consul agent, I had to specify a unique service ID for the two
service instances.
