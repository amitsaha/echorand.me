---
title: Writing HTTP client middleware in Go
date: 2022-09-19
categories:
-  go
draft: true
---

Go's [http.Client](https://pkg.go.dev/net/http#Client) defines a default value
for the `Transport` field when one is not specified:

```go
type Client struct {
        // Transport specifies the mechanism by which individual
        // HTTP requests are made.
        // If nil, DefaultTransport is used.
        Transport RoundTripper
        
        // other fields
}
```

Graphically, the role and position of `http.DefaultTransport` can be shown as follows:

![http.Client by default uses http.DefaultTransport](/img/go_http_client_transport_1.png "http.DefaultTransport is the default RoundTripper implementation")

`DefaultTransport`'s job is to send a HTTP request from your computer to the network server,
over the network, over TCP.

Now, as we can see above, `DefaultTransport` is of type `http.RoundTripper`, which
is an interface defined as follows:

```go
type RoundTripper interface {
        RoundTrip(*Request) (*Response, error)
}
```
Now, as with any other interface, we can write our own type which implements
the `RoundTripper` interface and use that as the `Transport` for a HTTP client.
That is the key to writing client side HTTP middleware.

Let's see a first example.


### Writing your own RoundTripper implementation

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


There is absolutely no useful purpose of writing a middleware like the above. However, what is
useful though is a `RoundTrip()` implementation which executes other code before and after calling
`http.DefaultTransport.RoundTrip()`.

This is the pattern followed by middleware that implements logging and metrics, adds common headers or
implements caching. I cover examples of using this pattern of writing middleware in my book, 
[Practical Go](https://practicalgobook.net) - for example, [middleware to add logging](https://github.com/practicalgo/code/tree/master/chap4/logging-middleware)
and a [middleware](https://github.com/practicalgo/code/tree/master/chap4/header-middleware) that adds 
headers to outgoing requests. This [blog post](https://lanre.wtf/blog/2017/07/24/roundtripper-go/) illustrates how you
can implement client-side caching.

Next, we will write a roundtripper implementation to return previously configured responses
and not call the remote server at all.

#### Returning static responses

This pattern of writing middleware is useful for writing _stub_ or _mock_ implementation
of remote servers. One situation in which this is extremely useful is in writing tests
for your application where you don't want to interact with remote network servers.

When you invoke the client's `GET` method, the following steps occur in such a mdidleware:

- The `RoundTrip()` method of the custom roundtripper implementation is invoked.
- This method doesn't call `http.DefaultTransport.RoundTrip()`. Hence, the remote request never
  gets the request.
- Instead, it creates and returns a `*http.Response` value itself, with a `nil` error value
  - If the roundtripper wants to abort the request,  it can return a `nil` `*http.Response` value
    and non-nill error value.


Graphically, it works as follows:

![Custom RoundTripper implementation returning static responses](/img/go_http_client_transport_3_middleware.png "Custom RoundTripper implementation returning static responses")

Let's see an example of such a roundtripper implementation.

We define a `demoRoundTripper` struct and a `RoundTrip()` method on it as earlier:

```go
type demoRoundTripper struct{}

func (t *demoRoundTripper) RoundTrip(r *http.Request) (*http.Response, error) {
        // roundtripper logic goes here
}
```

Inside the `RoundTrip()` method, based on the _outgoing_ request's URL, we
can choose to either return a static response or call the `http.DefaultTransport.RoundTrip()`
method, as follows:

```
        switch r.URL.String() {
        case "https://github.com":
                responseBody := "This is github.com stub"
                respReader := io.NopCloser(strings.NewReader(responseBody))
                resp := http.Response{
                        StatusCode:    http.StatusOK,
                        Body:          respReader,
                        ContentLength: int64(len(responseBody)),
                        Header: map[string][]string{
                                "Content-Type": {"text/plain"},
                        },
                }
                return &resp, nil

        case "https://example.com":
                return http.DefaultTransport.RoundTrip(r)

        default:
                return nil, errors.New("Request URL not supported by stub")
        }
}
```

The above roundtriper implementation will exhibit the following behavior:

- For an outgoing request to `https://github.com`, a static response will be sent:
  - Response body: "This is github.com stub"
  - Response headers: `Content-Type: text/plain`
  - Response status code: `http.StatusOK` 
- For an outgoing request to `https://example.com`, the request will be forwarded
  to `https://example.com` and the response and error value received from the
  `http.DefaultTransport.RoundTrip()` method will be returned as-is
- For any other request, an error will be returned

When we configure a HTTP client with the above roundtripper implementation and
send HTTP GET request to `https://github.com`, you will get the statically
configured response as follows:

```
2022/09/20 06:24:03 Sending GET request to: https://github.com
2022/09/20 06:24:03 This is github.com stub
```


If we send a HTTP GET request for `https://example.com`, you will see the response
that `example.com` will send back:

```
2022/09/20 06:24:03 Sending GET request to: https://example.com
2022/09/20 06:24:04 <!doctype html>
<html>
<head>
    <title>Example Domain</title>
...

</head>

<body>
<div>
    <h1>Example Domain</h1>
    <p>This domain is for use in illustrative examples in documents. You may use this
    domain in literature without prior coordination or asking for permission.</p>
    <p><a href="https://www.iana.org/domains/example">More information...</a></p>
</div>
</body>
</html>
```

If we send a HTTP GET request for any other URL, you will get an error:

```
2022/09/20 06:24:03 Sending GET request to: https://github.com/api
2022/09/20 06:24:03 Get "https://github.com/api": Request URL not supported by stub
```

You can find a runnable example [here](https://github.com/amitsaha/learning/tree/master/blog-posts-code/go-http-client-middleware/roundtripper_stub_demo).

As you completely control what happens to the outgoing request, your roundtripper implementation
can implement logic based on the request type - such as GET or POST, send redirect responses back,
drop requests completely to simulate failure scenarios and such. Now of course, we don't want
to make our _stub_ too complicated, but it should be _just enough_ for our current requirements.

It's also worth pointing out that you should make sure you refer to the documentation of
`RoundTripper` interface as to what you should or should not do in your implementation:

```
// copied from:https://pkg.go.dev/net/http#RoundTripper

// RoundTrip should not attempt to interpret the response. In
// particular, RoundTrip must return err == nil if it obtained
// a response, regardless of the response's HTTP status code.

// RoundTrip should not attempt to
// handle higher-level protocol details such as redirects,
// authentication, or cookies.
//
// RoundTrip should not modify the request, except for
// consuming and closing the Request's Body. RoundTrip may
// read fields of the request in a separate goroutine. Callers
// should not mutate or reuse the request until the Response's
// Body has been closed.
//
// RoundTrip must always close the body, including on errors,
// but depending on the implementation may do so in a separate
// goroutine even after RoundTrip returns. This means that
// callers wanting to reuse the body for subsequent requests
// must arrange to wait for the Close call before doing so.
//
```

## Summary

In this post, we saw how we can write HTTP client middleware in Go. We started off writing the 
simplest HTTP client middleware by forwarding the request to the remote server and then focused
on writing middleware that can be used to implement _stubs_ for remote network services.

Hope you found the post useful and I will end this post with references to the key standard library
documentation:

- [http.Client](https://pkg.go.dev/net/http#Client)
- [http.RoundTripper and http.DefaultTransport](https://pkg.go.dev/net/http#RoundTripper)
- [http.Request](https://pkg.go.dev/net/http#Request)
- [http.Response](https://pkg.go.dev/net/http#Response)
