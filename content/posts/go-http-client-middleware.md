---
title: Writing HTTP client middleware in Go
date: 2022-09-07
categories:
-  go
draft: true
---

## A HTTP client

## http.RoundTripper and DefaultTransport

## Writing your own RoundTripper implementation

Our first RoundTripper implementation will forward all requests to the
`DefaultTransport`'s `RoundTrip()` method:


### Returning static responses

### Logging, adding headers, caching and such

## Summary


