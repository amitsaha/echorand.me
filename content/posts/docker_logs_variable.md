---
title:  Getting a docker container's stdout logs into a variable on Linux
date: 2019-03-11
categories:
-  infrastructure
aliases:
- /getting-a-docker-containers-stdout-logs-into-a-variable-on-linux.html
---

docker logs by default [shows](https://docs.docker.com/config/containers/logging/) the container's
`stdout` and `stderr` logs. However, what I discovered was that the `stderr` logs from the container
are output to the host system's `stderr` as well. I was expecting everything from the container
to be on the host's `stdout`.

Let's see a demo. Consider the `Dockerfile`:

```
FROM alpine:3.7

CMD echo "I echoed to stdout" && >&2 echo "I echoed to stderr"
```

Let's build it and run it:

```
$ docker build -t amit/test .

$ sudo docker run --name test amit/test
I echoed to stdout
I echoed to stderr

$ sudo docker logs test
I echoed to stdout
I echoed to stderr

$ sudo docker logs test 2> /dev/null
I echoed to stdout
```

In the second `docker logs` command, we redirect the host's `stderr` to `/dev/null`. So, if you are looking to
get only the output that was written `stdout` inside the container, we will need to make sure, we pipe
the stderr to `/dev/null` on the host.

# Assigning the output of docker logs

Coming back to the primary use case which triggered this post, if we wanted just the standard output of the
container to be assigned to a variable in bash, here's what we should do:

```
data="$(sudo docker logs test 2> /dev/null)"
```

If we don't do the above `stderr` redirection, we will still see that container's `stderr` output on the host system.
That may leave you scratching your head, as it did to me, since we think we are assigning all the output of `docker logs` 
to a variable.
