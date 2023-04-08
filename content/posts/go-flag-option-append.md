---
title: Go - Append behavior in option values using flag package
date: 2021-11-13
categories:
-  go
---

While working on the solutions to exercises for my soon to be published book [Practical Go](https://practicalgobook.net/), 
I needed to implement a way to implement an option in my command line application which could be specified multiple times.
The result would be that all the values specified would form a list of the values. To make that concrete, consider that
you are writing a command line HTTP client application. You want to add one or more headers to an outgoing request, so this is 
the user interface that you want for your application:

```
$ my-command-line-app -header key1:value1 -header key2:value2 https://www.example.com
```

Next, I show how you can achieve the above using the Go standard library's [flag](https://pkg.go.dev/flag#Func) package.

## The Func() function

The [Func()](https://pkg.go.dev/flag#Func) function allows you to define a function that will be called everytime
the flag parsing machinery encounters a specific option. This is how our solution to the above problem
may look like:

```
type httpConfig struct {
	headers         []string
}

func myFunc() {
  c := httpConfig{}
  fs := flag.NewFlagSet("http", flag.ContinueOnError)	
  // define your other flags

  // define a header option that can be specified multiple
  // times and the values will be appended 
  headerOptionFunc := func(v string) error {
		c.headers = append(c.headers, v)
		return nil
	}
  fs.Func("header", "Add one or more headers to the outgoing request (key=value)", headerOptionFunc)
  
  # other stuff..
}
```

`headerOptionFunc` gets calld everytime the `flag.Parse()` function encounters `-header`. Here, we append it to a list `headers` which
is a field we have defined in the `httpConfig` struct.

This is another of those moments, where I thought - how do i solve this using the standard library? 
(Yes i hear you, didn't you think of that when you wrote the exercise? I may have, or i may not have, 
who knows). 

And the standard library delivered, yet again.
