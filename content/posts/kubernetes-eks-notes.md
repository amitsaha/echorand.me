---
title:  Notes on Kubernetes
date: 2019-08-02
categories:
-  infrastructure
---

# Introduction

This in-progress page lists some of my findings while working with [Kubernetes](https://kubernetes.io/). My findings are
based on working with a managed kubernetes cluster running in AWS EKS.

# EKS cluster setup

## Private subnet tagging

## Public subnet tagging

## Terraform configuration

## EKS private master and DNS resolution

In my setup, the master was private (along with all the nodes residing in private subnets). Right off the bat, 
I ran into issue of the master  hostname not resolving from my local workstation (even when I was connected to 
the VPN which had VPC peering with the VPC the master was running in). This issue is described 
[here](https://github.com/aws/containers-roadmap/issues/221). The solution I used ended up getting the IP 
address of the master via the network interface attached to it and then making an entry in the local `/etc/hosts` file.


## Authentication and Authorization

## Getting cluster data

## Authentication and Authorization for other users

## RBAC

## Human users

## Service accounts

## Using kubectl with a service account token


# Worker node joining

# Adding users and roles

# Persistent volumes

When you create a persistent volume claim, an EBS volume is created for you in AWS. 

Topology aware: https://kubernetes.io/blog/2018/10/11/topology-aware-volume-provisioning-in-kubernetes/

# Pods in pending state

https://kubernetes.io/docs/tasks/debug-application-cluster/debug-pod-replication-controller/

# Ingress with SSL throughout

# Jobs

# Cron jobs
