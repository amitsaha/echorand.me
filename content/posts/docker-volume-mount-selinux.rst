---
title:  Mounting a docker volume on SELinux enabled host
date: 2015-10-05
categories:
-  infrastructure
aliases:
- /mounting-a-docker-volume-on-selinux-enabled-host.html
---

My workflow with docker usually involves volume mounting a host
directory so that I can read and write to the host directory from my
container as a *non-root* user. On a Fedora 23 host with SELinux
enabled, this is what I have to do differently:

.. code::
   
   Use: -v /var/dir1:var/dir1:Z

Note the extra Z above? You can learn more about it this
`Project Atomic blog post <http://www.projectatomic.io/blog/2015/06/using-volumes-with-docker-can-cause-problems-with-selinux/>`__
