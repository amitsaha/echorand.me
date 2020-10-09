---
title: Correlated error logging
date: 2019-12-12
categories:
-  software
---

_Please note this document is currently in progress._ You may read this other post instead which illustrates
what I wanted to discuss in this [post](https://filipnikolovski.com/posts/correlating-logs/) with an implementation in Go.

## Introduction

In a service oriented architecture, more popular these days as a microservice oriented architecture
it's notoriously difficult and time consuming to find out whether a certain error observed in a particular
service may have been caused to an error in another service. Correlated error logging is a pattern that
may be implemented to help in such a scenario. I have implemented this succesfully in a HTTP and RPC
service architecture and in a pure HTTP service oriented architecture. The improvement it brings to
error tracking  and visibility is mind blowing. Let's see how we can go about it.

## Unique ID generation

The core component of a correlated error logging architecture is an Unique ID which gets generated
for every request. Since we are working in the context of a request, this ID is referred to as the
`request_id` which is what we will refer to it henceforth. The `request_id` is usually generated at
the "edge" and then "propagated down" and "back up" through the different services. 

To explain what I mean by "edge", let's assume we have a web application whose architecture looks
as follows:





