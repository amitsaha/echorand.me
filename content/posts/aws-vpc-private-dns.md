---
title:  AWS Private Route53 DNS and Docker containers
date: 2018-08-15
categories:
-  infrastructure
aliases:
- /aws-private-route53-dns-and-docker-containers.html
---

AWS Route 53 [private hosted zones](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zones-private.html) 
enable you to have private DNS names which only resolve from your VPC. This is great
when working from EC2 instances since everything is setup and ready to go. This however becomes a problem when using
docker containers on a systemd system. On such a system, `systemd-resolved` sits in between your host applications
and name resolution. The entry in `/etc/resolv.conf` is basically, `127.0.0.53` which doesn't mean much when you want
name resolution from a docker container which defaults to `8.8.8.8` for name resolution. Hence, we need a way to set
AWS VPC DNS server as an additional DNS server for the docker daemon.

Hence, I wrote a small small utility - [aws-vpc-dns-address](https://github.com/amitsaha/aws-vpc-dns-address). 
This is basically a golang version of the comment by Dusan Bajic [here](https://stackoverflow.com/questions/39100395/getting-the-dns-ip-used-within-an-aws-vpc). Having a Golang binary means, I can use this on Linux and Windows.  Running the program will print the 
DNS server, which you can then use for example to set the DNS server in docker to be able to resolve private DNS names.
