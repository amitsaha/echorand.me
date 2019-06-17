---
title:  runC and libcontainer on Fedora 23/24
date: 2016-04-27
categories:
-  golang
aliases:
- /runc-and-libcontainer-on-fedora-2324.html
---

In this post, I will post my notes on how I got `runC
<https://github.com/opencontainers/runc/>`__ and then using 
`libcontainer` on Fedora. The first step is to install ``golang``:

.. code::

   $ sudo dnf -y install golang
   $ go version
   go version go1.6 linux/amd64

We will set GOPATH=~/golang/ and then do the following:

.. code::

   $ mkdir -p ~/golang/github.com/opencontainers
   $ cd ~/golang/github.com/opencontainers
   $ git clone https://github.com/opencontainers/runc.git
   $ cd runc

   $ sudo dnf -y install libseccomp-devel
   $ make
   $ sudo make install

At this stage, ``runc`` should be installed and ready to use:

.. code::

   $ runc --version
   runc version 0.0.9
   commit: 89ab7f2ccc1e45ddf6485eaa802c35dcf321dfc8
   spec: 0.5.0-dev


Now we need a rootfs that we will use for our container, we will use
the "busybox" docker image - pull it and export a tar archive:

.. code::

  $ sudo dnf -y install docker
  $ sudo systemctl start docker
  $ docker pull busybox
  $ sudo docker export $(sudo docker create busybox) > busybox.tar
  $ mkdir ~/rootfs
  $ tar -C ~/rootfs -xf busybox.tar

Now that we have a rootfs, we have one final step - generate the spec
for our container:

.. code::

   $ runc spec
   
This will generate a ``config.json`` (`config
<https://github.com/opencontainers/runtime-spec/blob/master/config.md>`__)
file and then we can start a container using the rootfs above:
(runC expects to find ``config.json`` and ``rootfs`` in the same
directory as you are going to start the container from)
   
.. code::

   # for some reason, i have to pass the absolute path to runc when using sudo
   # UPDATE: (Thanks to Dharmit for pointingme to: http://unix.stackexchange.com/questions/91541/why-is-path-reset-in-a-sudo-command/91556#91556)
   $ sudo /usr/local/bin/runc start test #  test is the "container-id"
   / # ps
	PID   USER     TIME   COMMAND
    1 root       0:00 sh
    8 root       0:00 ps
   /# exit


Getting started with libcontainer
=================================

``runC`` is built upon `libcontainer
<https://github.com/opencontainers/runc/tree/master/libcontainer>`__. This 
means that wcan write our own Golang programs which will start a
container and do stuff in it. An example program is available `here
<https://github.com/amitsaha/libcontainer_examples/blob/master/example1.go>`__ 
(thanks to the fine folks on #opencontainers on Freenode for helpful
pointers). It starts a container using the above rootfs, runs ``ps``
in it and exits.

Once you have saved it somewhere on your go path, we will first
need to get all the dependent packages:

.. code::

   $ # My program is in the below directory
   $ cd ~/golang/src/github.com/amitsaha/libcontainer_examples
   $ go get
   $ sudo GOPATH=/home/asaha/golang go run example1.go /home/asaha/rootfs/
    [sudo] password for asaha: 
    PID   USER     TIME   COMMAND
    1 root       0:00 ps


(Thanks Dharmit for all the suggestions)
