---
title: Writing HTTP client middleware in Go
date: 2022-09-17
categories:
-  go
draft: true
---

## A HTTP client

## http.RoundTripper and DefaultTransport

![http.Client by default uses http.DefaultTransport](/img/go_http_client_transport_1.png "http.DefaultTransport is the default RoundTripper implementation")


## Writing your own RoundTripper implementation

Our first RoundTripper implementation will forward all requests to the
`DefaultTransport`'s `RoundTrip()` method:

![Custom RoundTripper implementation calling http.DefaultTransport.RoundTrip()](/img/go_http_client_transport_2_middleware.png "Custom RoundTripper calling http.DefaultTransport.RoundTripper() to forward the request to the server")


### Returning static responses

![Custom RoundTripper implementation returning static responses](/img/go_http_client_transport_3_middleware.png "Custom RoundTripper implementation returning static responses")

### Logging, adding headers, caching and such

## Summary


