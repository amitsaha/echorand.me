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

Our first RoundTripper implementation will forward all requests to the `DefaultTransport`'s `RoundTrip()` 
method.

![Custom RoundTripper implementation calling http.DefaultTransport.RoundTrip()](/img/go_http_client_transport_2_middleware.png "Custom RoundTripper calling http.DefaultTransport.RoundTripper() to forward the request to the server")

First, define a struct, let's call it, `demoRoundTripper`:

```go
type demoRoundTripper struct{}
```

Then, define a `RoundTrip()` method on the struct with the following properties:

- It must have a pointer receiver, i.e. `*demoRoundTripper`
- It must accept one argument of type, `*http.Request` - the outgoing HTTP request
- It must return two values of types, `*http.Response` and `error` respectively

The function body will simply call `http.DefaultTransport.RoundTrip()` with
the `*http.Request` value received and return the `*http.Response` and `error`
values returned.

The method definition will look as follows:

```go
func (t *demoRoundTripper) RoundTrip(r *http.Request) (*http.Response, error) {
	return http.DefaultTransport.RoundTrip(r)
}
```

Once you have defined the `demoRoundTripper` struct and a `RoundTrip()` method, you have
a `http.RoundTripper` implementation.

To configure a HTTP client to use the above RoundTripper implementation, all we need to do is
to set the `Transport` field as follows:

```go
client := http.Client{
       Transport: &demoRoundTripper{},
}
resp, err := client.Get("https://example.com")
```

This is the pattern followed by middleware that implements logging and metrics, adds common headers or
[implements caching](https://lanre.wtf/blog/2017/07/24/roundtripper-go/). 

I cover examples of using this pattern of writing middleware in my book, [Practical Go](https://practicalgobook.net).

Next, we will write a roundtripper implementation to return previously configured responses
and not call the remote server at all.

### Returning static responses

This pattern of writing middleware is useful for writing _stub_ or _mock_ implementation
of remote servers. One situation in which this is extremely useful is in writing tests
for your application where you don't want to interact with remote network servers.

![Custom RoundTripper implementation returning static responses](/img/go_http_client_transport_3_middleware.png "Custom RoundTripper implementation returning static responses")


## Summary


