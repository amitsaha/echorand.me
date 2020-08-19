---
title:  AWS Network ACLs and ephemeral port ranges
date: 2018-08-14
categories:
-  infrastructure
aliases:
- /aws-network-acls-and-ephermal-port-ranges.html
---

In this post, I discuss a problem (and its solution) I encountered while working with AWS (Amazon Web Services) 
Network ACLs, docker containers and ephemeral port ranges.
# Infrastructure setup

A Linux EC2 instance with `docker` engine running in a VPC with inbound and outbound traffic controlled by Network ACLs.
I was connecting to another hosted service running on a separate VM, `service1` running on port `10001` inside the same 
subnet with security groups allowing traffic from the host IP (via CIDR).

# Symptoms of the problem

I could connect to the service from the host as well as from inside the `docker` container, but *occasionally* connectivity 
from the same `docker` container would fail. It would also manifest as working in one container, but fail in another
container. The connection attempt would just timeout. I thought, may be the container has lost its ability to talk to external
hosts, but basic tests didn't reveal a problem there. Then, I thought may be security group is the issue, but of course
that is not since I am using `docker` bridge network which by default will use the IP of the host as the source IP.

So..what is going on?

# Solution - Background

# Ephermal ports

Communication over IP network sockets involves two parties - usually referred to as a client and a server with
each end happening over a `socket`. A socket is composed of a pair - IP address and a port. The port for the
server side is fixed - either one of the [well known port numbers](https://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers#Well-known_ports) or an internally chosen port number for your services. What about the client side port? The client side port
is chosen `dynamically` at run time and are referred to as [ephemeral port](https://en.wikipedia.org/wiki/Ephemeral_port).

Operating systems set a configurable range from which this ephemeral port will be chosen. This brings us to AWS Network ACLs.

# AWS Network ACLs

[AWS Network ACLs](https://docs.aws.amazon.com/AmazonVPC/latest/UserGuide/VPC_ACLs.html) allow controlling/regulating traffic
flow to and from subnets. Our topic of interest is the outbound rules via which we can specify source ports for our
allow/deny rules.

In other words, if our docker container above is selecting a ephemeral port which is not in the allowed list of the outbound rules,
the request is not going to go through. This can happen when the Network ACLs range is different from the default range of your
operating system.

# Docker networks

I mentioned in the symptoms above that I am using docker's default `docker0` which by default works in a NAT mode and
hence any outgoing traffic from a docker container will have it's source IP as the host's IP. For example:

```
ubuntu@ip-172-34-59-184:~$ sudo tcpdump -i eth0 port 10001
..
07:32:49.696954 IP ip-172-34-59-184.51990 > 172.34.1.252.10001: Flags [S], seq 238158991, win 29200, options [mss 1460,sackOK,TS val 2420016438 ecr 0,nop,wscale 7], length 0
..
```

`ip-172-34-59-184.51990` is the source hostname and `51990` is the ephemeral port that has been chosen to talk to my
service which is running on port `10001`.

# Problem

Once I saw the source port via `tcpdump`, everything clicked. The source port hadn't even been in my radar when I was running
my tests inside the container since i had fixed the same issue on the underlying VM instance just a day back. 
NAT was as expected just masking the container IP address, the source port was still being preserved however and wasn't 
one in the list of allowed ranges in the Network ACL. This port was not in the list of allowed outbound rules 
(Note that, the above port specifically is not the problem, another port was).

# Solution

The solution is to basically set the ephemeral range so that it matches the one allowed in the network ACL.

# Set the ephemeral port range on a Linux VM

We will add an entry to `sysctl.conf`:

```
$ echo 'net.ipv4.ip_local_port_range=49152 65535' | sudo tee --append /etc/sysctl.conf
```

To effect the above change on a running system, `$sudo sysctl -p`.


# Set the ephemeral port range in a Linux docker container

Pass it at `docker run` time:

```
$ docker run --sysctl net.ipv4.ip_local_port_range="49152 65535" ...
```

Learn more about [sysctl for docker](https://docs.docker.com/engine/reference/commandline/run/#configure-namespaced-kernel-parameters-sysctls-at-runtime).

#  Set the ephemeral port range on Windows

Use the `netsh` command:

```
PS C:\> netsh int ipv4 show dynamicport tcp

Protocol tcp Dynamic Port Range
---------------------------------
Start Port      : 49152
Number of Ports : 16384

PS C:\> netsh int ipv4 set dynamicport tcp start=50000 num=1000
Ok.

PS C:\> netsh int ipv4 show dynamicport tcp

Protocol tcp Dynamic Port Range
---------------------------------
Start Port      : 50000
Number of Ports : 1000
```

The above works inside a Windows container as well. At this stage, there is no way to set this via `docker run`.
So, I imagine, we will need do it either an entry point of the container or during build.


# Conclusion

This problem may come up when working with Network ACLs in a hybrid Operating System enviorment as it did for me. 
I can't help but feel thankful to the problem as it allowed me to dig into some networking basics. Who would have
thought ephemeral ports can have any impact on your life?


# Learn more

A very interesting post if you are on Linux is [Bind before connect](https://idea.popcount.org/2014-04-03-bind-before-connect/).
Learn all about [AWS Network ACLs](https://docs.aws.amazon.com/AmazonVPC/latest/UserGuide/VPC_ACLs.html) here. Learn all about
[netsh](https://docs.microsoft.com/en-us/windows-server/networking/technologies/netsh/netsh) here and a lot about [sysctl](https://wiki.archlinux.org/index.php/sysctl) here.

While trying to figure out what's going wrong, I went into a bit of a rabbit hole and learned a few other things as well:

- [Linux Network Namespaces](https://blog.scottlowe.org/2013/09/04/introducing-linux-network-namespaces/)
- [Container networking deep dive](https://platform9.com/blog/container-namespaces-deep-dive-container-networking/)
- [veth devices](http://man7.org/linux/man-pages/man4/veth.4.html)
- [Linux bridge working](https://goyalankit.com/blog/linux-bridge)
