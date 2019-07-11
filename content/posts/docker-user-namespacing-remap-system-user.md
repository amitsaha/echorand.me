---
title:  Docker userns-remap and system users on Linux
date: 2018-08-24
categories:
-  infrastructure
aliases:
- /docker-userns-remap-and-system-users-on-linux.html
---

In this post, we learn how we can make use of `docker`'s user namespacing feature on Linux in a CI/build environment
to avoid running into permission issues. Using user namespacing also keeping things a bit sane without adopting
sub-optimal alternatives.

# Introduction

Let's consider that we are leveraging `docker` in a continuous integration (CI)/build environment and the usage scenario
looks as follows:

1. CI agent/slave runs as an unpriviliged user `agent` on the host
2. `agent` clones the repository during a build on the host
3. The build happens in a `docker` container spawned by scripts running as `agent` with the repository volume mounted

On a new build, the agent doesn't do a fresh clone if a clone already exists, but instead does a `git clean` followed 
by `git fetch` of the commit. Here's is what's going to happen: the `agent` is going to get a permission denied when
a `git clean` is attemped.

In Step 3 above, when the build was done in the container, the build process was running as `root` user. Since the repository 
was volume mounted, contents written to the repository directory will show up as being owned by the `root` user on the host. 
Hence, when `agent` tries to cleanup the directory on the next build, it gets a permission denied.

What do we do? We could run the CI agent as `root` user - avoid it. Or, figure out some way of changing back the permissions
after the build. However, `user namespaces` via `userns-remap` is better than both these workarounds.

Before we get into configuring `docker` engine, we have a bit to learn about Linux `system` users and entries in
`/etc/subuid` and `/etc/subgid`.

# System users and entries in `/etc/subuid` and `/etc/subgid`

On Linux, a `system` user is created with `-s` switch to `useradd`. A [system user](http://www.linuxfromscratch.org/blfs/view/svn/postlfs/users.html) doesn't have shell access or a home
directory and is most useful for running daemons and other processes, like a CI slave for example.

`/etc/subuid` is explained in the [subuid(5)](http://man7.org/linux/man-pages/man5/subuid.5.html) manual page. 
Basically, it is a file whose lines are similar to:

```
root:100000:65536
ubuntu:165536:65536
```

The first column is a username, the second column is the starting _subordinate_ user ID that this user is allowed 
to use in a user namespace upto a maximum number of user IDs given by the third column. You can also see that 
the starting sub user ID of the second row is calculated as: `Previous Starting Sub UID + the number of user IDs allowed`.

The `/etc/subgid` is similar, but for group IDs.

When we create a non-system user, [useradd](https://linux.die.net/man/8/useradd) adds an entry automatically to these files. 
However, for `system` users, this is not done. I am not sure why though. 


# docker `userns-remap` with system users

docker's `userns-remap` feature allows us to use a default `dockremap` user. In this scenario, docker engine creates 
the user `dockremap` on the host and maps the `root` user inside a container to this user. For this user, `docker` also 
needs to have entries on the host's `/etc/subuid` and `/etc/subgid` files. We learned in the previous paragraph that 
for system users entries don't automatically get created at user creation time. Hence, the `docker engine` 
does this itself - [initial commit](https://github.com/moby/moby/pull/21266/commits/c18e7f3a0419e35aeab4eefa51f3c17fbd72381f). 

This is useful when we want to avoid privilege escalation. This doesn't work however when we want that any operation 
inside a container is performed as the same user as the one spawning the container - for example, the `agent` user. Hence,
we want to specify another user on the host that the root user inside the container should map to.


# Adding a `subuid` and `subgid` entry for system users

Since, we want the user inside the container to be the same user as that outside the container, we have to set the
`subuid` starting user ID to be the same as the user ID on the host. If we don't do this, any changes to the volume
mounted directory will have a different owner/group associated with them. 

This is how we can go about doing so:

```
$ username="agent"
$ uid=$(id -u "$username")
$ gid=$(id -g "$username")
$ lastuid=$(( uid + 65536 ))
$ lastgid=$(( gid + 65536 ))

$ sudo usermod --add-subuids "$uid"-"$lastuid" "$username"
$ sudo usermod --add-subgids "$gid"-"$lastgid" "$username"
```

We are now ready to enable `userns-remap` and specify `docker engine` to use the `agent` user. 

Note that if you are trying to use this feature with a non-system user, you will have to manually modify the `subuid`
and `subgid` entries so that your starting subuid is the same as the User ID.

# Enabling `docker's` userns-remap

You could modify docker's daemon.json file to enable `userns-remap`. I went with the approach of using a
drop in systemd unit file to update the `dockerd` flags:

```
$ sudo mkdir -p /etc/systemd/system/docker.service.d
$ echo "[Service]" | sudo tee /etc/systemd/system/docker.service.d/docker-userns-remap.conf > /dev/null
$ # First clear ExecStart (https://github.com/moby/moby/issues/14491)
$ echo "ExecStart=" | sudo tee --append  /etc/systemd/system/docker.service.d/docker-userns-remap.conf > /dev/null
$ # Now, override to apply userns-remap
$ echo "ExecStart=/usr/bin/dockerd -H fd:// --userns-remap=\"agent:agent\"" | sudo tee --append  /etc/systemd/system/docker.service.d/docker-userns-remap.conf > /dev/null

$ sudo systemctl daemon-reload
$sudo systemctl restart docker
```


# User namespace in action

Now, if we run a container and note the PID from the host:

```
ubuntu@ip-172-34-54-228:~$ cat /proc/18407/uid_map
         0        999      65537
```


Inside the container, we see:

```
root@028c3d79babd:/# cat /proc/1/uid_map
         0        999      65537
```

Please see [user_namespaces(7)](http://man7.org/linux/man-pages/man7/user_namespaces.7.html) for description of these 
files.


# Using third party images

One of the interesting issues I faced while using `userns-remap` was an error when doing a `docker pull` of the form:
`failed to register layer: Error processing tar file (exit status 1): container id xxx cannot be mapped to a host id`.
Once `userns-remap` is enabled, all `docker engine` operations are carried out as the user specified - not the user
executing the docker client command. If an image you are pulling has files with user ID `1000`, and if your `subuid` 
file entry doesn't have space for `1000` users, it is going to fail. The solution is to have a decent enough range
of users in your `subuid` entry.

# Problem with the above

Since we have manually set the sub ordinate user IDs to start at the same ID (say, A) as the user ID, a sub-ordinate 
user ID B inside the container, such that B=A+N, may map to an existing user ID, C on the host and hence any changes
to the volume mounted directory by a user B, will be mapped back on the host as being modified by user C.

# Learn more

- [User namespacing on Linux](http://man7.org/linux/man-pages/man7/user_namespaces.7.html)
- [User namespaces in Docker](https://success.docker.com/article/introduction-to-user-namespaces-in-docker-engine)
- [Initial commit in docker related to dockremap implementation](https://github.com/moby/moby/pull/21266/commits/c18e7f3a0419e35aeab4eefa51f3c17fbd72381f)

