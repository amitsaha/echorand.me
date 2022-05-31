---
title:  Cookies in Go
date: 2022-06-01
categories:
-  go
draft: true
---

I am working on a new *Manning Live Project* (check out the ones I have created so far [here](https://echorand.me/writings-trainings/)).
In this project, I will guide the learner through a project which among few other things, requires us to work with
[HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies). 

This was the first time I was working with cookies in Go, as it didn't make it to the topics in 
my book [Practical Go](https://practicalgobook.net/). It turned out to be a great learning experience and I 
even ended up contributing a [relevant fix](https://go.dev/cl/407654) to the Go standard library.

This post describes the learning experience. Let's dive in!

## Key packages

First off, the relevant packages we will be working with. 

When you want to set or read cookies on the *server* side, the functionality is available as part of the [net/http](https://pkg.go.dev/net/http)
package.

When you want to set cookies on the *client* side, the functionality is available as part of the [net/http/cookiejar](https://pkg.go.dev/net/http/cookiejar) package.

## Tests

Let's consider a a test file, `cookies_test.go`  defining two HTTP handler functions:

```
func handlerWithCookie(w http.ResponseWriter, r *http.Request) {
	fmt.Fprint(w, "You got cookies!")
}

func handlerWithoutCookie(w http.ResponseWriter, r *http.Request) {
	fmt.Fprint(w, "No cookies!")
}

```

Then, we write a test function to check if the handler function, `handlerWithCookie` is 
setting a specific cookie correctly:

```
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

Then, we write another test function to check if the handler function, `handlerWithNoCookie` is 
setting a specific cookie correctly before it responds with a redirect:

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

# Server side cookies



# Client side cookies