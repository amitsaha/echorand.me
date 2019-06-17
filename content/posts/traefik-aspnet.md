---
title:  Poor man's zero downtime deployment setup using Traefik
date: 2019-01-21
categories:
-  infrastructure
aliases:
- /poor-mans-zero-downtime-deployment-setup-using-traefik.html
---

Recently, I wrote two articles about using [traefik](https://traefik.io/) as a reverse proxy. The [first article](https://blog.codeship.com/setting-up-traefik-as-a-reverse-proxy-for-asp-net-applications/)
discussed deploying a  ASP.NET framework application and the second [discussed](https://blog.codeship.com/use-cloudbees-codeship-pro-for-ci-and-traefik-for-asp-net-applications/) deploying ASP.NET core applications. 

In both cases, I demonstrated the following:

- Docker native integration
- In-built support for LetsEncrypt SSL certificates

One of the things I didn't discuss was how we could setup an architecture which allowed us to do zero-downtime 
deployments without any external help. By external help I mean taking the application instance out of the DNS pool,
having another healthchecking process automatically taking it out of a load balancing pool or something like that.
In this post, I discuss one way of achieving that. The ideas aren't limited to ASP.NET applications, of course.

## Background

Traefik's [api](https://docs.traefik.io/configuration/api/) provides a way to query the current backends that
are registered with the server. If we configure traefik to enable the API listener, we can query the endpoint
`http://localhost:<port>/api/providers/<provider>/backends` to obtain a JSON response containing details of
the currently registered backends. My suggested approach will use this API endpoint.

## Approach

My approach assumes the following:

1. You are using `traefik` native docker integration
2. You have configured `traefik` healthcheck (and docker `healthcheck`)
3. You are running a setup where you have a single instance of your application (excepting during deployment) behind a traefik
   container/host process

The following steps in order will give you a zero downtime deployment strategy when deploying `docker` containers 
with `traefik` as a reverse proxy and using native docker integration:

1. Run the new container
2. Wait till the new "server" is registered in `traefik` by polling the API endpoint
3. Once (2) is completed, gracefully stop your old backend server container
4. Wait till the old "server" has been deregistered in `traefik` by polling the API endpoint
5. Kill the old container

## Example

An example `docker-compose` file that you can use to experiment with the above idea is:

```
version: '3'

services:
  reverse-proxy:
    image: traefik # The official Traefik docker image
    command: --api --docker # Enables the web UI and tells Traefik to listen to docker
    ports:
      - "80:80"     # The HTTP port
      - "8080:8080" # The Web UI (enabled by --api)
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock # So that Traefik can listen to the Docker events
  whoami:
    image: containous/whoami # A container that exposes an API to show its IP address
    labels:
      - "traefik.frontend.rule=Host:whoami.docker.localhost"
      - "traefik.backend=backend1"

  whoami-again:
    image: containous/whoami # A container that exposes an API to show its IP address
    labels:
      - "traefik.frontend.rule=Host:whoami.docker.localhost"
      - "traefik.site1.backend=backendsite1"
```

Run `docker-compose up` and go to `http://localhost:8080/api/providers/docker/backends`, we will get the three 
backends that's configured:

```
{
  "backend-backend1": {
    "servers": {
      "server-traefik-demo-whoami-1-86460ec963c2-f0078ecb386e282a8fc546f06636ff94": {
        "url": "http:\/\/172.18.0.3:80",
        "weight": 1
      }
    },
    "loadBalancer": {
      "method": "wrr"
    }
  },
  "backend-reverse-proxy-traefik-demo": {
    "servers": {
      "server-traefik-demo-reverse-proxy-1-807284c2bf53-a4b9e1129a86189ee88fc1a031f0c65d": {
        "url": "http:\/\/172.18.0.4:80",
        "weight": 1
      }
    },
    "loadBalancer": {
      "method": "wrr"
    }
  },
  "backend-whoami-again-traefik-demo-backendsite1": {
    "servers": {
      "server-traefik-demo-whoami-again-1-36490b790acf-780f230448df16d66397c0c29cebc062": {
        "url": "http:\/\/172.18.0.2:80",
        "weight": 1
      }
    },
    "loadBalancer": {
      "method": "wrr"
    }
  }
}
```

Each backend in `traefik` has a `servers` object which is a map of each server instance. Hence, to put my suggested approach
in more concrete terms, this is how we can check if a new server container has been registered:

1. Get the container IP address
2. Poll traefik's API for the specific backend, i.e. `http://localhost:8080/api/providers/docker/backends/<backend-name>/`
3. Check if the container IP is in the `servers` list

Similarly, for the deregistration, we check for the absence of the server.

## Tips

### Traefik backend naming

One of the tricky issues I faced while working on this is the naming of the backend. See [this issue](https://github.com/containous/traefik/issues/4284)
to learn more. Basically, the backend name is not fixed, it will need to be derived at runtime.

### Getting the relevant container's IP address

How do you get the new container's IP address that you want to check if it's been registered? I used something like this:

```
NewContainer=docker ps --filter "health=healthy" --filter "label=app=${Image}" --filter "label=version=${GitHash}" --format '{{.Names}}'
```

My new container would have a label, `version` with the version of the application I am deploying so I use that to query it.

How do I get the old container's IP address? I use this appraoch:

```
$OldContainers=docker ps --filter "label=app=${Image}" --filter before=$NewContainer --format '{{.ID}}'
```

Basically, I check the container of the same application which was created before the new container. A more fool proof
approach would be to store the previous version that was deployed and use that.


## Conclusion

The above approach currently seems to be working fairly well for the setup I have - ASP.NET framework application on Windows Server 1803
and our requirements. It basically allows one to have a deployment setup without any downtime which is especially useful when 
we want to use a single VM and without using any third party services/tools.
