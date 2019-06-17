---
title:  Why RPC in Microservices instead of HTTP?
date: 2018-02-11
categories:
-  software
aliases:
- /why-rpc-in-microservices-instead-of-http.html
---

The Freelancer.com [REST API](https://developers.freelancer.com/)
is powered by a number of backend services. The API itself is powered by a Python HTTP server which
communicates with the other services (Python, Golang and PHP) via RPC calls implemented using [Apache Thrift](https://thrift.apache.org/).
It is only during the past 2.5 years that I have been working with Apache Thrift or cross-language RPCs in general.
The question often comes up especially when thinking about the future - why not just use HTTP throughout across 
all services? HTTP 1.1 is simple and easy to understand. Implementing a HTTP API endpoint doesn't also mean having 
to learn about Apache Thrift so that the data we want to respond with can come from another service written
in a different language. HTTP is also not coupled to any specific language, which means you can still use
different programming language across services. So, __Why not use HTTP throughout?__

Without going into technicalities, the one reason I think RPCs are a better fit than HTTP is very well put in this
[blog post](https://blog.bugsnag.com/grpc-and-microservices-architecture/) on why they chose RPC:

> Unfortunately, it felt like we were trying to shoehorn simple methods calls into a data-driven RESTful interface. 
> The magical combination of verbs, headers, URL identifiers, resource URLs, and payloads that satisfied a RESTful 
> interface and made a clean, simple, functional interface seemed an impossible dream. RESTful has lots of rules and
> interpretations, which in most cases result in a RESTish interface, which takes extra time and effort to maintain its purity.

That to me is the number 1 reason of going with RPC. Instead of spending time and effort to have a semi-REST API, just use
RPC as the method of communication. Whether you go with [Apache Thrift](https://thrift.apache.org) or [gRPC](https://grpc.io/)
is a different question. If you are working across services written in the same programming language, you may
find the language's own RPC implementation worth looking at as well. If you are working with `golang`, 
[twirp](https://blog.twitch.tv/twirp-a-sweet-new-rpc-framework-for-go-5f2febbf35f) looks interesting.

If you are working on prototyping or teaching the idea of microservices, HTTP is a good idea, but RPC would
be a better choice if you are looking to implement something which is going to be put into production.
