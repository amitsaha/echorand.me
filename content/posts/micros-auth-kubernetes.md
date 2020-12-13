---
title: Authentication between services using Kubernetes primitives
date: 2020-12-13
categories:
-  infrastructure
---

In my latest article for the folks at [learnk8s](https://learnk8s.io), I write
about establishing authentication between services deployed in Kubernetes.

Specifically, we discuss how you can use the Kubernetes primitives - Service
accounts with a new feature - Service Account Token Volume Projection to setup
authentication between two HTTP services.

You can find the article [here](https://learnk8s.io/microservices-authentication-kubernetes) with the
accompanying code repository [here](https://github.com/amitsaha/kubernetes-sa-volume-demo).
