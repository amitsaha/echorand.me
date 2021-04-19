---
title:  Jenkins Docker Workflow plugin - A look at inside()
date: 2019-11-26
categories:
-  infrastructure
---

# Introduction 

The [docker workflow plugin](https://github.com/jenkinsci/docker-workflow-plugin) enables leveraging Docker containers
for CI/CD workflows in Jenkins. There are two broad patterns one would generally use containers in their CI/CD environment.
The first would be as "side car" containers - these are containers which run alongside your tests/other workflow and provide
services such as a database server, memory store and such. The second would be as base execution environments for the
tests/builds. The documentation for the plugin [explains](https://jenkins.io/doc/book/pipeline/docker/) these two patterns
and how to achieve either using Jenkins workflow plugin.

The goal of this post is to discuss a bit about how the second workflow works.

## How does `inside()` work?

This is how `inside()` is implemented by Jenkins, given a docker image, `user/image:version`:

1. Start a docker container in daemonized mode from `user/image:version` passing `cat` as the command to execute
2. (1) will ensure that the container stays running since that's how `cat` works (waits for input)
3. Now that the execution environment is ready, the build/test commands are then executed

(1) would roughly translate to the docker command, `docker run -t -d user/image:version ... cat`  and (3) would roughly
translate to `docker exec -t <docker container id above> ..` commands. For the curious, the source code for this is 
[here](https://github.com/jenkinsci/docker-workflow-plugin/blob/74a2370901f41e8b5b541d768b440e2ab1cd1b18/src/main/java/org/jenkinsci/plugins/docker/workflow/WithContainerStep.java#L198)


## `inside()` and ENTRYPOINT

Let's say the docker image you specify to `inside()` defines an entrypoint. What happens then? `cat` is specified as
an argument to the entrypoint. So unless, your entrypoint can execute the `cat` program successfully, your container
will never start successfully. The error in your CI build will be something like:

```
java.io.IOException: Failed to run top '80e56ee23982149fa484429af94fb70c1f63245bbf4fac265fe0a2f972dc16f5'. Error: 
Error response from daemon: Container 80e56ee23982149fa484429af94fb70c1f63245bbf4fac265fe0a2f972dc16f5 is not running
```

After (1) above is run, Jenkins runs the equivalent of the `docker top` command (source code [reference](https://github.com/jenkinsci/docker-workflow-plugin/blob/74a2370901f41e8b5b541d768b440e2ab1cd1b18/src/main/java/org/jenkinsci/plugins/docker/workflow/client/DockerClient.java#L143))
to find out the processes that are running and check if there is a process running the `cat` command. If there is none or
there is an error otherwise, the build is aborted. Hence the above error that it failed to run `top` inside the container.

Thus, if you are not sure about whether there is an ENTRYPOINT defined or not, we can disable the entrypoint using, `--entrypoint=''`.
Thus, our `inside()` statement will look something like this:

```
docker.image('user/image:version').inside("""--entrypoint=''""") {
}
```
The above will result in the following docker command for step (1) above:

```
docker run -d -t --entrypoint='' user/image:version cat
```

# Conclusion

Hopefully this post helps somebody else when you are furiously trying to figure out what's going on. I know it will certainly
help me. To learn about docker's ENTRYPOINT (and CMD), this [post](https://blog.codeship.com/understanding-dockers-cmd-and-entrypoint-instructions/)
should be useful. Jenkins isn't my favorite CI solution, but at least I can if I wish to figure out what's going on since
it's open source.


