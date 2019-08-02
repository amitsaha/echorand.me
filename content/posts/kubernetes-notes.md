---
title:  Notes on Kubernetes
date: 2019-08-02
categories:
-  infrastructure
---

# Introduction

This in-progress page lists some of my findings while working with [Kubernetes](https://kubernetes.io/). 

# EKS cluster setup

This section will have findings that are relevant when working with an AWS EKS cluster.

## Terraform configuration for master

This is based on the tutorial from the Terraform folks [here](https://learn.hashicorp.com/terraform/aws/eks-intro). Unlike
the tutorial though, I assume that you already have the VPC and subnets you want to setup your EKS master in. 

First up, the master. There are three main category of AWS resources we will need to create:

- IAM role and policies
- Security groups
- EKS master

### IAM role

```
resource "aws_iam_role" "cluster" {
  name = "eks-cluster-${var.environment}"

  assume_role_policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "eks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
POLICY
}

resource "aws_iam_role_policy_attachment" "cluster-AmazonEKSClusterPolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = "${aws_iam_role.cluster.name}"
}

resource "aws_iam_role_policy_attachment" "cluster-AmazonEKSServicePolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSServicePolicy"
  role       = "${aws_iam_role.cluster.name}"
}
```

### Security group and rules

```
resource "aws_security_group" "cluster" {
  name        = "eks-cluster-${var.environment}"
  description = "Cluster communication with worker nodes"
  vpc_id      = "${var.vpc_id}"

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "eks-cluster-${var.environment}"
  }
}

resource "aws_security_group_rule" "cluster-ingress-workstation-https" {
  cidr_blocks       = "${var.ssh_access_ip}"
  description       = "Allow local workstation to communicate with the cluster API Server"
  from_port         = 443
  protocol          = "tcp"
  security_group_id = "${aws_security_group.cluster.id}"
  to_port           = 443
  type              = "ingress"
}
```

### EKS master

We create an EKS master with the following key attributes:

- We enable the cloudwatch logs for the `api`, `audit`, `authenticator`, `controllerManager` and `scheduler`
- We specify that we want a private endpoint access for the master
- We specify that we don't want a public endpoint access for the master
- We specify our existing private subnet IDs that we want to use

These private subnet IDs must have a tag - `kubernetes.io/cluster/<your cluster name>: shared` where the cluster name
is the same as that you use in the your terraform configuration.

The following Terraform configuration will create the EKS master:

```
resource "aws_eks_cluster" "cluster" {
  name            = "${var.cluster_name}"
  role_arn        = "${aws_iam_role.cluster.arn}"

  enabled_cluster_log_types = [
      "api","audit","authenticator","controllerManager","scheduler",
  ]

  vpc_config {
    endpoint_private_access = true
    endpoint_public_access = false
    security_group_ids = ["${aws_security_group.cluster.id}"]
    subnet_ids         = ["${var.private_subnet_ids}"]
  }

  depends_on = [
    "aws_iam_role_policy_attachment.cluster-AmazonEKSClusterPolicy",
    "aws_iam_role_policy_attachment.cluster-AmazonEKSServicePolicy",
  ]
}
```

## Terraform configuration for nodes

## Public subnet tagging

Public subnets will need the following key-value pairs as tags:

```
kubernetes.io/cluster/<cluster-name>: shared 
kubernetes.io/role/elb: 1
```

This is so that public load balancers can be created for services and/or ingress controllers.


## EKS private master and DNS resolution

In my setup, the master was private (along with all the nodes residing in private subnets). Right off the bat, 
I ran into issue of the master  hostname not resolving from my local workstation (even when I was connected to 
the VPN which had VPC peering with the VPC the master was running in). This issue is described 
[here](https://github.com/aws/containers-roadmap/issues/221). The solution I used ended up getting the IP 
address of the master via the network interface attached to it and then making an entry in the local `/etc/hosts` file.


## Authentication and Authorization

RBAC
## Getting cluster data

## Worker node joining

## Authentication and Authorization for other users

## Human users

## Adding users and roles

## Service accounts

## Using kubectl with a service account token


# Persistent volumes

When you create a persistent volume claim, an EBS volume is created for you in AWS. 

Topology aware: https://kubernetes.io/blog/2018/10/11/topology-aware-volume-provisioning-in-kubernetes/

# Ingress with SSL throughout

# Jobs

# Cron jobs


# Miscellaneous

## Pods in pending state

https://kubernetes.io/docs/tasks/debug-application-cluster/debug-pod-replication-controller/

