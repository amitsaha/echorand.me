---
title:  Notes on using Kubernetes
date: 2018-04-10
categories:
-  infrastructure
---

This in-progress page lists some of my findings while working with [Kubernetes](https://kubernetes.io/). 
There are a few things in on this page which are only relevant to [AWS EKS](https://aws.amazon.com/eks/).

# EKS private host

In my setup, my master was private (along with all the nodes residing in private subnets). Right off the bat, I ran into
issue of the master hostname not resolving from my local workstation (even when I was connected to the VPN which
had VPC peering with the VPC the master was running in). This issue is described [here](https://github.com/aws/containers-roadmap/issues/221). The solution ended up being getting the IP address of the master via the network interface attached to it
and then making an entry in the local `/etc/hosts` file.

# Authentication and Authorization

# Getting cluster data

# Worker node joining

# Adding users and roles

# Persistent volumes

When you create a persistent volume claim, an EBS volume is created for you in AWS. 

Topology aware: https://kubernetes.io/blog/2018/10/11/topology-aware-volume-provisioning-in-kubernetes/

# Pods in pending state

https://kubernetes.io/docs/tasks/debug-application-cluster/debug-pod-replication-controller/

# Public ALB with subnet tagging

# Ingress with SSL throughout

# Jobs

# Cron jobs





