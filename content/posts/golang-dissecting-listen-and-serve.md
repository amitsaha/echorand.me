---
title:  Dissecting golang's HandlerFunc, Handle and DefaultServeMux
date: 2017-04-26
categories:
-  golang
aliases:
- /dissecting-golangs-handlerfunc-handle-and-defaultservemux.html
---

# Introduction

My aim in this post is to discuss three "concepts" in Golang that I come across while writing HTTP servers. Through this
post, my aim to get rid of my own lack of understanding (at least to a certain degree) about these. Hopefully, it will
be of use to others too. The code references are from `src/net/http/server.go <https://golang.org/src/net/http/server.go>`__. 

The [http.ListenAndServe(..)](https://golang.org/pkg/net/http/#ListenAndServe>) function is the most straightforward 
approach to start a HTTP 1.1 server. The following code does just that:

``` 
   package main
   
   import (
   	"log"
   	"net/http"
   )
   
   func main() {
   	log.Fatal(http.ListenAndServe(":8080", nil))
   }
```

What is the `nil` second argument above? The documentation states that the second argument to the function should be a 
"handler" and if it is specified as `nil`, it defaults to `DefaultServeMux`.


# What is `DefaultServeMux`?


If we run our server above via ``go run server1.go``, and send a couple of HTTP GET requests, we will see the following:

```
   
   $ curl localhost:8080
   404 page not found
   
   $ curl localhost:8080/status/
   404 page not found
```

This is because, we haven't specified how our server should handle requests to GET the root ("/") - our first request or 
requests to GET the "/status/" resource - our second request. Before we see how we could fix that, let's understand 
*how* the error message "404 page not found" is generated.

The error message is generated from the function below in `src/net/http/server.go` specifically the `NotFoundHandler()` 
"handler" function:

```

   // handler is the main implementation of Handler.
   // The path is known to be in canonical form, except for CONNECT methods.
   func (mux *ServeMux) handler(host, path string) (h Handler, pattern string) {
   	mux.mu.RLock()
   	defer mux.mu.RUnlock()
   
   	// Host-specific pattern takes precedence over generic ones
   	if mux.hosts {
   		h, pattern = mux.match(host + path)
   	}
   	if h == nil {
   		h, pattern = mux.match(path)
   	}
   	if h == nil {
   		h, pattern = NotFoundHandler(), ""
   	}
   	return
   }
   
 ```  


Now, let's roughly see how our GET request above reaches the above function. 

Let us consider the function signature of the above handler function: `func (mux *ServeMux) handler(host, path string) (h Handler, pattern string)`. This function is a method belonging to the type `ServeMux`:

```

   // ServeMux also takes care of sanitizing the URL request path,
   // redirecting any request containing . or .. elements or repeated slashes
   // to an equivalent, cleaner URL.
   type ServeMux struct {
   	mu    sync.RWMutex
   	m     map[string]muxEntry
   	hosts bool // whether any patterns contain hostnames
   }
   
   type muxEntry struct {
   	explicit bool
   	h        Handler
   	pattern  string
   }
   
   // NewServeMux allocates and returns a new ServeMux.
   func NewServeMux() *ServeMux { return new(ServeMux) }
   
   // DefaultServeMux is the default ServeMux used by Serve.
   var DefaultServeMux = &defaultServeMux
   
   var defaultServeMux ServeMux
    
```

So, how does `DefaultServeMux` get set when the second argument to `ListenAndServe()` is `nil`? The following code 
snippet has the answer:

```

   func (sh serverHandler) ServeHTTP(rw ResponseWriter, req *Request) {
   	handler := sh.srv.Handler
   	if handler == nil {
   		handler = DefaultServeMux
   	}
   	if req.RequestURI == "*" && req.Method == "OPTIONS" {
   		handler = globalOptionsHandler{}
   	}
   	handler.ServeHTTP(rw, req)
   }
  ```  


The above call to `ServeHTTP()` calls the following implementation of `ServeHTTP()`:

```

   // ServeHTTP dispatches the request to the handler whose
   // pattern most closely matches the request URL.
   func (mux *ServeMux) ServeHTTP(w ResponseWriter, r *Request) {
   	if r.RequestURI == "*" {
   		if r.ProtoAtLeast(1, 1) {
   			w.Header().Set("Connection", "close")
   		}
   		w.WriteHeader(StatusBadRequest)
   		return
   	}
   	h, _ := mux.Handler(r)
   	h.ServeHTTP(w, r)
   }
 ```

The call to `Handler()` function then calls the following implementation:

```

   // If there is no registered handler that applies to the request,
   // Handler returns a ``page not found'' handler and an empty pattern.
   func (mux *ServeMux) Handler(r *Request) (h Handler, pattern string) {
   	if r.Method != "CONNECT" {
   		if p := cleanPath(r.URL.Path); p != r.URL.Path {
   			_, pattern = mux.handler(r.Host, p)
   			url := *r.URL
   			url.Path = p
   			return RedirectHandler(url.String(), StatusMovedPermanently), pattern
   		}
   	}
   
   	return mux.handler(r.Host, r.URL.Path)
   }
   
   // handler is the main implementation of Handler.
   // The path is known to be in canonical form, except for CONNECT methods.
   func (mux *ServeMux) handler(host, path string) (h Handler, pattern string) {
   	mux.mu.RLock()
   	defer mux.mu.RUnlock()
   
   	// Host-specific pattern takes precedence over generic ones
   	if mux.hosts {
   		h, pattern = mux.match(host + path)
   	}
   	if h == nil {
   		h, pattern = mux.match(path)
   	}
   	if h == nil {
   		h, pattern = NotFoundHandler(), ""
   	}
   	return
   }
   
   ``` 


Now, when we make a request to "/" or "/status/", no match is found by the `mux.match()` call above and hence the 
handler returned is the `NotFoundHandler` whose `ServeHTTP()` function is then called to return the "404 page not found" 
error message:

```

   // NotFound replies to the request with an HTTP 404 not found error.
   func NotFound(w ResponseWriter, r *Request) { Error(w, "404 page not found", StatusNotFound) }
   
   // NotFoundHandler returns a simple request handler
   // that replies to each request with a ``404 page not found'' reply.
   func NotFoundHandler() Handler { return HandlerFunc(NotFound) }
  ``` 
    

We will discuss how this "magic" happens in the next section.

# Registering handlers

Let's now update our server code to handle "/" and "/status/":

```

   package main
   
   import "net/http"
   import "fmt"
   
   type mytype struct{}
   
   func (t *mytype) ServeHTTP(w http.ResponseWriter, r *http.Request) {
   	fmt.Fprintf(w, "Hello there from mytype")
   }
   
   
   func StatusHandler(w http.ResponseWriter, r *http.Request) {
   	fmt.Fprintf(w, "OK")
   }
   
   func main() {
   
   	t := new(mytype)
   	http.Handle("/", t)
   	
   	http.HandleFunc("/status/", StatusHandler)
           
   	http.ListenAndServe(":8080", nil)
   }
```    

If we run the server and send the two requests above, we will see the following responses:

```

   $ curl localhost:8080
   Hello there from mytype 

   $ curl localhost:8080/status/
   OK
```


Let's now revisit how the right handler function gets called. In a code snippet above, we saw a call to the ``match()`` function which given a path returns the most appropriate registered handler for the path:


```

   // Find a handler on a handler map given a path string
   // Most-specific (longest) pattern wins
   func (mux *ServeMux) match(path string) (h Handler, pattern string) {
   	var n = 0
   	for k, v := range mux.m {
   		if !pathMatch(k, path) {
   			continue
   		}
   		if h == nil || len(k) > n {
   			n = len(k)
   			h = v.h
   			pattern = v.pattern
   		}
   	}
   	return
   }
 ```   

``mux.m`` is a a ``map`` data structure defined in the ``ServeMux`` structure (snippet earlier in the post) which stores a mapping of a path and the handler we have registered for it.

## The HandleFunc() type

Let's go back to the idea of "converting" any function with the signature ``func aFunction(w http.ResponseWriter, r *http.Request)`` to the type "HandlerFunc". 

Any type which has a ServeHTTP() method is said to implement the ``Handler`` interface:

```

    type HandlerFunc func(ResponseWriter, *Request)

    // ServeHTTP calls f(w, req).
    func (f HandlerFunc) ServeHTTP(w ResponseWriter, req *Request) {
        f(w, req)
    }

```

Going back to the previous version of our server, we see how we do that:


```

    type mytype struct{}

    func (t *mytype) ServeHTTP(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, "Hello there from mytype")
    }
```
The ``ServeHTTP()`` method of a Handler is invoked when it has been registered as handling a particular path.

Let's look at what the call to `Handle()` function does:

```

   
   // Handle registers the handler for the given pattern
   // in the DefaultServeMux.
   // The documentation for ServeMux explains how patterns are matched.
   func Handle(pattern string, handler Handler) { DefaultServeMux.Handle(pattern, handler) }
   
   // Handle registers the handler for the given pattern.
   // If a handler already exists for pattern, Handle panics.
   func (mux *ServeMux) Handle(pattern string, handler Handler) {
   	mux.mu.Lock()
   	defer mux.mu.Unlock()
   
   	if pattern == "" {
   		panic("http: invalid pattern " + pattern)
   	}
   	if handler == nil {
   		panic("http: nil handler")
   	}
   	if mux.m[pattern].explicit {
   		panic("http: multiple registrations for " + pattern)
   	}
   
   	if mux.m == nil {
   		mux.m = make(map[string]muxEntry)
   	}
   	mux.m[pattern] = muxEntry{explicit: true, h: handler, pattern: pattern}
   
   	if pattern[0] != '/' {
   		mux.hosts = true
   	}
   
   	// Helpful behavior:
   	// If pattern is /tree/, insert an implicit permanent redirect for /tree.
   	// It can be overridden by an explicit registration.
   	n := len(pattern)
   	if n > 0 && pattern[n-1] == '/' && !mux.m[pattern[0:n-1]].explicit {
   		// If pattern contains a host name, strip it and use remaining
   		// path for redirect.
   		path := pattern
   		if pattern[0] != '/' {
   			// In pattern, at least the last character is a '/', so
   			// strings.Index can't be -1.
   			path = pattern[strings.Index(pattern, "/"):]
   		}
   		url := &url.URL{Path: path}
   		mux.m[pattern[0:n-1]] = muxEntry{h: RedirectHandler(url.String(), StatusMovedPermanently), pattern: pattern}
   	}
   }
    
```

It can feel cumbersome to define a type implementing the ``Handler`` interface for every path we want to register a handler for. Hence, a convenience function, ``HandleFunc()`` is provided to register any function which has a specified signature as a Handler function. For example:

```
    http.HandleFunc("/status/", StatusHandler)
```
Now, let's look at what the call to `HandleFunc()` function does:

```
   
   // HandleFunc registers the handler function for the given pattern
   // in the DefaultServeMux.
   // The documentation for ServeMux explains how patterns are matched.
   func HandleFunc(pattern string, handler func(ResponseWriter, *Request)) {
   	DefaultServeMux.HandleFunc(pattern, handler)
   }
   
   
   // HandleFunc registers the handler function for the given pattern.
   func (mux *ServeMux) HandleFunc(pattern string, handler func(ResponseWriter, *Request)) {
   	mux.Handle(pattern, HandlerFunc(handler))
   }
   
   // The HandlerFunc type is an adapter to allow the use of
   // ordinary functions as HTTP handlers.  If f is a function
   // with the appropriate signature, HandlerFunc(f) is a
   // Handler object that calls f.
   type HandlerFunc func(ResponseWriter, *Request)
   
   // ServeHTTP calls f(w, req).
   func (f HandlerFunc) ServeHTTP(w ResponseWriter, req *Request) {
       f(w, req)
   }
  ``` 
   
   
   
    

The call to the ``http.HandleFunc()`` function "converts" the provided function to the ``HandleFunc()`` type and then calls the ``(mux *ServeMux) Handle()`` function similar to what happens when we call the ``Handle()`` function. The idea of this conversion is explained in the [Effective Go guide](https://golang.org/doc/effective_go.html#interface_methods) and 
this [blog post](http://jordanorelli.com/post/42369331748/function-types-in-go-golang).



# Using your own Handler with ListenAndServe()


Earlier in this post, we saw how passsing ``nil`` to ``ListenAndServe()`` function sets the handler to 
``DefaultServeMux``. The handlers we register via ``Handle()`` and ``HandleFunc()`` are then added to this 
object. Hence, we could without changing any functionality rewrite our server as follows:

```

   package main
   
   import "net/http"
   import "fmt"
   
   type mytype struct{}
   
   func (t *mytype) ServeHTTP(w http.ResponseWriter, r *http.Request) {
   	fmt.Fprintf(w, "Hello there from mytype")
   }
   
   func StatusHandler(w http.ResponseWriter, r *http.Request) {
   	fmt.Fprintf(w, "OK")
   }
   
   func main() {
   
   	mux := http.NewServeMux()
   
   	t := new(mytype)
   	mux.Handle("/", t)
   	mux.HandleFunc("/status/", StatusHandler)
   
   	http.ListenAndServe(":8080", mux)
   }
```    

We create an object of type ``ServeMux`` via ``mux := http.NewServeMux()``, register our handlers calling the same two functions, but those that are defined for the ``ServeMux`` object we created.

The reason we may want to use our own Handler with ``ListenAndServe()`` is demonstrated in the next section.


# Writing Middleware


In our latest version of the server, we have specified our own handler to ``ListenAndServe()``. One reason for doing so is when you want to execute some code for *every* request. That is:

1. Server gets a request for "/path/"
2. Execute some code
3. Handler for "/path/" gets called
4. Execute some code
5. Return the response to the client

Either of steps 2 or 4 or both may occur and this is where "middleware" comes in. Our next version of the server demonstrates how we may implement this:

```

   package main
   
   import "net/http"
   import "fmt"
   import "log"
   
   type mytype struct{}
   
   func (t *mytype) ServeHTTP(w http.ResponseWriter, r *http.Request) {
   	fmt.Fprintf(w, "Hello there from mytype")
   }
   
   func StatusHandler(w http.ResponseWriter, r *http.Request) {
   	fmt.Fprintf(w, "OK")
   }
   
   func RunSomeCode(handler http.Handler) http.Handler {
   	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
   		log.Printf("Got a %s request for: %v", r.Method, r.URL)
   		handler.ServeHTTP(w, r)
   		// At this stage, our handler has "handled" the request
   		// but we can still write to the client there
   		// but we won't do that
   		// XXX: We have the HTTP status here, but we cannot access
   		// it directly here
   		// See next example (server5.go)
   		log.Println("Handler finished processing request")
   	})
   }
   
   func main() {
   
   	mux := http.NewServeMux()
   
   	t := new(mytype)
   	mux.Handle("/", t)
   	mux.HandleFunc("/status/", StatusHandler)
   
   	WrappedMux := RunSomeCode(mux)
   	http.ListenAndServe(":8080", WrappedMux)
   }
  ```  

When we run the server and send it a couple of requests as above, we will see:

```

    2017/04/24 17:53:03 Got a GET request for: /
    2017/04/24 17:53:03 Handler finished processing request
    2017/04/24 17:53:05 Got a GET request for: /status
    2017/04/24 17:53:05 Handler finished processing request
```

What we are doing above is we are "wrapping" our actual handler in another function ``RunSomeCode(handler http.Handler) http.Handler`` which satisfies the ``Handler`` interface. In this function, we print a log message, then call the ``ServeHTTP()`` method of our original
handler, ``mux``. Once it returns from there, we are then printing another log message.

As part of this middleware writing exercise, I also wanted to be able to print the HTTP status of the response that we are sending but as the comment in the code states, there is no direct way to get the status via the ``ResponseWriter`` object. Our next server example will fix this.

# Rewrapping ``http.ResponseWriter``


It took me a while to write the next version of the server, and after reading through some mailing list postings and example code, 
i have a version which achieves what I wanted to be able to do via my middleware:

```

   package main
   
   import "net/http"
   import "fmt"
   import "log"
   
   type MyResponseWriter struct {
   	http.ResponseWriter
   	code int
   }
   
   
   func (mw *MyResponseWriter) WriteHeader(code int) {
   	mw.code = code
   	mw.ResponseWriter.WriteHeader(code)
   }
   
   type mytype struct{}
   
   func (t *mytype) ServeHTTP(w http.ResponseWriter, r *http.Request) {
   	w.WriteHeader(http.StatusOK)
   	fmt.Fprintf(w, "Hello there from mytype")
   }
   
   func StatusHandler(w http.ResponseWriter, r *http.Request) {
   	w.WriteHeader(http.StatusOK)
   	fmt.Fprintf(w, "OK")
   }
   
   func RunSomeCode(handler http.Handler) http.Handler {
   	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
   		log.Printf("Got a %s request for: %v", r.Method, r.URL)
   		myrw := &MyResponseWriter{ResponseWriter: w, code: -1}
   		handler.ServeHTTP(myrw, r)
   		log.Println("Response status: ", myrw.code)
   	})
   }
   
   func main() {
   
   	mux := http.NewServeMux()
   
   	t := new(mytype)
   	mux.Handle("/", t)
   	mux.HandleFunc("/status/", StatusHandler)
   
   	WrappedMux := RunSomeCode(mux)
   	log.Fatal(http.ListenAndServe(":8080", WrappedMux))
   }
    
```

In the example above, I define a new type ``MyResponseWriter`` which wraps the ``http.ResponseWriter`` type and adds
a new field, `code` to store the HTTP status code and implements a ``WriteHeader()`` method. Then, in ``RunSomeCode()``, 
instead of using the standard ``http.ResponseWriter()`` object that it was passed, I wrap it in a ``MyResponseWriter`` type as
follows:

```
    
    myrw := &MyResponseWriter{ResponseWriter: w, code: -1}
    handler.ServeHTTP(myrw, r)
```

Now, if we run the server, we will see log messages on the server as follows when we send it HTTP get requests:

```

    2017/04/25 17:33:06 Got a GET request for: /status/
    2017/04/25 17:33:06 Response status:  200
    2017/04/25 17:33:07 Got a GET request for: /status
    2017/04/25 17:33:07 Response status:  301
    2017/04/25 17:33:10 Got a GET request for: /
    2017/04/25 17:33:10 Response status:  200
```

I will end this post with a question and perhaps the possible explanation:

As I write above, it took me a while to figure out how to wrap ``http.ResponseWriter`` correctly so that I could get access
to the HTTP status that was being set. It looks like there may be a [way](https://github.com/golang/go/issues/18997)
to get the HTTP response status.


# References


The following links helped me understand the above and write this post:

- http://jordanorelli.com/post/42369331748/function-types-in-go-golang
- https://golang.org/doc/effective_go.html#interface_methods
- https://gocodecloud.com/blog/2016/11/15/simple-golang-http-request-context-example/
- https://www.slideshare.net/blinkingsquirrel/customising-your-own-web-framework-in-go
