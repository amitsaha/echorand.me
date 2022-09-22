---
title: Custom HTTP client with golang.org/x/oauth2 and GitHub Go SDK
date:  2022-09-21
categories:
-  go
---

In this post, we are going to discuss an implementation detail about
how we can use a custom HTTP client to use the Go GitHub SDK and the
https://pkg.go.dev/golang.org/x/oauth2 package.

- [Introduction](#introduction)
- [Using a custom HTTP client with golang.org/x/oauth2](#using-a-custom-http-client-with-golangorgxoauth2)
- [Using the custom HTTP client with Go Github SDK](#using-the-custom-http-client-with-go-github-sdk)
- [Summary](#summary)
- [References](#references)

## Introduction 

Let's create an example `*oauth2.Config` for communicating with `GitHub.com`
oauth provider:

```go
oauthConf = &oauth2.Config{
	ClientID:     getEnvironValue("CLIENT_ID"),
	ClientSecret: getEnvironValue("CLIENT_SECRET"),
	Scopes:       []string{"repo", "user"}, // see the project desrciption for understandng why we need full scopes here
	Endpoint:     github.Endpoint,
}
```

One key step as part of the OAuth authorization process is to call the
`Exchange(..)` method to obtain an access token:

```go
t, err  = oauthConf.Exchange(ctx, ..)
```

The above method call requires a HTTP client to communicate.

The golang.org/x/oauth2 library looks for a HTTP client inside the
context, `ctx` and if it doesn't find it using`ctx.Value(HTTPClient)`, 
it creates a `http.DefaultClient`:

```go
type ContextKey struct{}
var HTTPClient ContextKey

if ctx != nil {
        if hc, ok := ctx.Value(HTTPClient).(*http.Client); ok {
                return hc
        }
}
return http.DefaultClient
```

You can find the complete code [here](https://cs.opensource.google/go/x/oauth2/+/f2134210:internal/transport.go;l=23).

## Using a custom HTTP client with golang.org/x/oauth2

To use a custom HTTP client, we create a new `context.Context` 
value with oauth2.HTTPClient and then pass that as the context to
the `Exchange()` method:

```go
customHttpClient := &http.Client{}
ctx := context.WithValue(ctx, oauth2.HTTPClient, customHttpClient)
t, err := oauthConf.Exchange(ctx, ...)
```

Now, the above code finds the configured HTTP client, `customHttpClient`
and uses that to make the HTTP requests.

## Using the custom HTTP client with Go Github SDK

Now, to use the same custom HTTP client, `customHttpClient` with the
Go GitHub SDK and using the access token obtained from the `Exchange()`
method call above, all we need to do is continue using the 
same context above:

```go
// ctx is the same as we created above with the
// value containing the custom HTTP client
ts := oauth2.StaticTokenSource(
        &oauth2.Token{AccessToken: t.Token},
)
tc := oauth2.NewClient(ctx, ts)
ghClient := github.NewClient(tc)
```

Then, we can use the GitHub client as usual:

```go
u, _, err := ghClient.Users.Get(ctx, "")
```

## Summary

Configuring a custom HTTP client for use with golang.org/x/oauth2 also automatically
ensures that the same client is used for accessing the GitHub API via the GitHub Go SDK.
This post illustrates how that works.

If you are wondering why you may want to use a custom HTTP client, it can be useful
when writing tests where you don't want to interact with the GitHub.com oauth2
provider or the GitHub.com API. You can learn how in my previous blog post, 
[Writing HTTP client middleware in Go](https://echorand.me/posts/go-http-client-middleware/).

## References

- [Using custom HTTP client with golang.org/x/oauth2](https://pkg.go.dev/golang.org/x/oauth2#example-Config-CustomHTTP)
- [Using GitHub Go SDK with oauth2](https://github.com/google/go-github#authentication)
- [Context package](https://pkg.go.dev/context#pkg-functions)

