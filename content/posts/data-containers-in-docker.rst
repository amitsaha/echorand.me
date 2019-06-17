---
title:  Data only Docker containers
date: 2015-12-13
categories:
-  infrastructure
aliases:
- /data-only-docker-containers.html
---

In this post, we shall take a look at the idea of data only
containers - containers whose sole purpose is to exist on the *docker
host* so that other containers can have portable access to a
persistent data volume.


Why do we need a persistent data volume?
========================================

We will experiment with the ``jenkins`` image from the `docker
hub <https://hub.docker.com/_/jenkins/>`__. Let's run a jenkins
container using `$ sudo docker run -p 8080:8080 jenkins`. Now, if we
visit the URL `http://docker-host-ip:8080`, we will see the familiar
Jenkins home page.

By default, a Jenkins installation doesn't come with any
authentication configured. Hence, we will first setup a simple
authentication setup using Jenkins' own user password database. To do
so, we will visit the URL:
`http://docker-host-ip:8080/configureSecurity/` and check the ``Enable
security`` checkbox and then select the ``Jenkins`` own user database`
option, and check the ``Allow users to sign up`` check box under
``Security Realm``, select the ``Logged-in users can do anything``
option and finally click on ``Save``. This will bring us to the login
page from where we can create a new account since we don't have one
yet. Now, we will exit out of the container - we can use ``Ctrl + c``
combination for that. Now, if we restart the container using the
previous command, you will see that none of the configuration changes
above has been saved.

The reason for that is because none of the changes we make during a
container's lifetime in it's own file system is preserved. So, we need
*data volumes*.

Persistent data with a volume mount
===================================

If you look at the
`Dockerfile <https://github.com/jenkinsci/docker/blob/master/Dockerfile>`__
you will see the command ``VOLUME /var/jenkins_home``. This
essentially means that the mount point ``/var/jenkins_home`` points to
a location on the docker host. Hence, the changes made in that
directory will be available from the host even after you have exited
the container. However, the catch here is that every time you run a
new container, the host location it mounts to will change and hence as
we saw above, the data we wrote (via the configuration changes) were
not visible the next time we started a container from the same
image. To achieve that, we have to do things slightly differently. We
will start the container and give a name to it:

```
$ sudo docker run -p 8080:8080 --name jenkins jenkins
```

We will perform the same configuration changes above and exit the
container using Ctrl + C. Next, we will ``start`` the container using
``sudo docker start jenkins``. You will see all your changes have been
preserved.

So, now we have a setup of jenkins where our changes are preserved, so
long as we make sure we start/stop the containers and not run a new
container from the ``jenkins`` image. The key point to take away from
here is that for a specific container, the host directory the volume
maps to is always the same. This leads to the use of what is commonly
referred to as ``data containers`` for persistent data storage in
containers.

Using data containers for persistent storage
============================================

The idea here is that you use the same base image from which your
actual container will run to only create a container (using ``docker
create``), not run it:

.. code::

   $ sudo docker create --name jenkins-data jenkins

We gave the name ``jenkins-data`` to this container and it's only
purpose is to be there on our filesystem to serve as a source of
persistent ``/var/jenkins_home`` for other jenkins containers. Let's
run a jenkins container now:

.. code::

   $ sudo docker run --volumes-from jenkins-data -p 8080:8080 jenkins

As earlier, we can now go to the Jenkins home page at
`http://docker-host-ip:8080/configureSecurity/` and make the above
configuration changes. You can now exit the container and use the
above command to run another jenkins container. The changes will still
be visible. We are no more restricted to starting and stopping the
same container since our ``jenkins-data`` container will have all our
changes stored in its ``/var/jenkins_home``. You can have other
containers (perhaps a container for
`backing up <https://github.com/discordianfish/docker-lloyd>`__ your
``/var/jenkins_home``) being able to access the same data by using the
same ``volumes-from`` option.

Comparison to volume mounting a host directory
==============================================

The alternative to using data containers is to mount a directory from
the host as ``/var/jenkins_home`` in the container. This approach will
solve our end-goal, but there are two additional steps that one would
need to do:

- Decide which host location to use, perhaps creating it
- Making sure the container will have appropriate read-write permissions (including `SELinux
  labels <www.projectatomic.io/blog/2015/06/using-volumes-with-docker-can-cause-problems-with-selinux/>`__).

We don't need to do either of these when using data containers. As
long as the image we plan to use has the appropriate ``VOLUME``
command in it's Dockerfile, we can adopt the same approach we did
here to make sure the data we care about is persisted. For images,
which don't, we can easily enough create our own image and add the
appropriate ``VOLUME`` commands. And hence, this is a **portable**
approach to data persistence - it is not reliant on the host
setup.

Conclusion
==========

In conclusion, these are the main reasons why data containers are a
good approach to have persistent storage for your containers:

- No requirement to setup host
- The permissions are automatically taken care of since we are using the same base image
- Multiple containers can easily have access to the same data

The following links may be helpful to learn more:

- `Managing data in Containers <https://docs.docker.com/userguide/dockervolumes/>`__
- `Why Docker Data Containers are Good <https://medium.com/@ramangupta/why-docker-data-containers-are-good-589b3c6c749e>`__
