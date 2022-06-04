---
title:  Cookies in Go
date: 2022-06-01
categories:
-  go
draft: true
---

I am working on a new *Manning Live Project* (check out the ones I have created so far 
[here](https://echorand.me/writings-trainings/)). In this project, I will guide the learner through a project 
using the Go programming language, which among few other things, requires them to work with
[HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies). 

This was the first time I was working with cookies in Go, as it didn't make it to the topics in 
my book [Practical Go](https://practicalgobook.net/). It turned out to be a great learning experience and I 
even ended up contributing a [relevant fix](https://go.dev/cl/407654) to the Go standard library's
`net/http` package.

This post describes the learning experience and hopefully it will also prove useful to someone else. Let's dive in!

## Key packages

First off, the relevant packages we will be working with. 

When you want to set or read cookies on the *server* side, the functionality is available as part of 
the [net/http](https://pkg.go.dev/net/http) package.

When you want to set cookies on the *client* side, the functionality is available as part of 
the [net/http/cookiejar](https://pkg.go.dev/net/http/cookiejar) package.

## Failing test functions

Let's consider a a test file, `cookies_test.go`  defining two HTTP handler functions:

```go
func handlerWithCookie(w http.ResponseWriter, r *http.Request) {
	fmt.Fprint(w, "You got cookies!")
}

func handlerWithoutCookie(w http.ResponseWriter, r *http.Request) {
	fmt.Fprint(w, "No cookies!")
}

```

Then, we write a test function to check if the handler function, `handlerWithCookie` is 
setting a specific cookie correctly:

```go
func TestClientCookies(t *testing.T) {

	mux := http.NewServeMux()
	mux.HandleFunc("/cookie", handlerWithCookie)
	mux.HandleFunc("/no-cookie", handlerWithoutCookie)
	ts := httptest.NewServer(mux)
	defer ts.Close()

	jar, err := cookiejar.New(&cookiejar.Options{PublicSuffixList: publicsuffix.List})
	if err != nil {
		log.Fatal(err)
	}

	client := &http.Client{
		Jar: jar,
	}

	_, err = client.Get(ts.URL + "/cookie")
	if err != nil {
		t.Fatal(err)
	}

	u, err := url.Parse(ts.URL)
	if err != nil {
		t.Fatal(err)
	}
	for _, cookie := range jar.Cookies(u) {
		if cookie.Name == "my-cookie" {
			return
		}
	}
	t.Fatalf("Couldn't find cookie, my-cookie after request to /cookie")
}
```

Specifically, we want to test whether, a call to the `/cookie` HTTP path, sets a cookie, with the name 
`my-cookie`. We will ignore the value of the cookie for now.

Then, we write another test function to check if the handler function, `handlerWithNoCookie` is 
setting another specific cookie with the name, `my-redirect-cookie` correctly before it responds 
with a redirect:

```
func TestClientCookiesAfterRedirect(t *testing.T) {

	mux := http.NewServeMux()
	mux.HandleFunc("/cookie", handlerWithCookie)
	mux.HandleFunc("/no-cookie", handlerWithoutCookie)
	ts := httptest.NewServer(mux)
	defer ts.Close()

	jar, err := cookiejar.New(&cookiejar.Options{PublicSuffixList: publicsuffix.List})
	if err != nil {
		log.Fatal(err)
	}

	client := &http.Client{
		Jar: jar,
	}

	_, err = client.Get(ts.URL + "/no-cookie")
	if err != nil {
		t.Fatal(err)
	}

	u, err := url.Parse(ts.URL)
	if err != nil {
		t.Fatal(err)
	}
	for _, cookie := range jar.Cookies(u) {
		if cookie.Name == "my-redirect-cookie" {
			return
		}
	}
	t.Fatalf("Couldn't find cookie, my-redirect-cookie after request to /cookie")
}
```

If we run `go test` on the above test functions, we will get the following expected failures:

```
--- FAIL: TestClientCookies (0.00s)
    cookies_test.go:54: Couldn't find cookie, my-cookie after request to /cookie
--- FAIL: TestClientCookiesAfterRedirect (0.00s)
    cookies_test.go:88: Couldn't find cookie, my-redirect-cookie after request to /cookie
FAIL
exit status 1
FAIL	go-cookies	0.387s
```

Now that we have our tests failing, let's go about fixing them.

(You can find the complete source code [here](https://github.com/amitsaha/learning/tree/master/blog-posts-code/go-cookies))

## Fixing the first test

To fix the `TestClientCookies` test, we will update the `handlerWithCookies()` HTTP handler as follows:

```
func handlerWithCookie(w http.ResponseWriter, r *http.Request) {
	c := http.Cookie{
		Name: "my-cookie",
	}
	http.SetCookie(w, &c)
	fmt.Fprint(w, "You got cookies!")
}
```

After the above updated, we have one failing test now. 

```
% go test
--- FAIL: TestClientCookiesAfterRedirect (0.00s)
    cookies_test.go:92: Couldn't find cookie, my-redirect-cookie after request to /cookie
FAIL
exit status 1
FAIL	go-cookies	0.311s
```

(We will leave the failing test for now - we will come back to it soon.)

Now, we will update our test function, and add another HTTP handler function.


## Client side cookies

## Back to server side cookies


Session cookie


- https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies