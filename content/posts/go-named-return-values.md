---
title:  Named return values in Go
date: 2021-07-05
categories:
-  go
---

In Go, there are a couple of ways to return values from a function.

## Non-named return values

Until today, I had been exclusively using the following style of what i am going
to refer to as "Non-named return values":

```go
func myFunc() (int, error) {
        return 1, errors.New("An error")
}
```

You declare in the function signature that you will be returning an `int` and and an `error`.
Then in your code, you return those values.

## Named return values

Using the "named return values" approach, the above function would be written as:

```go
func myFunc() (i int, e error) {
        i = 1
        e = errors.New("An error")
        return
}
```

The updated function signature essentially does two things:

1. It says that the function will return an `int` and an `error`
2. Declares two variables - `i` of type `int` and `e` of type `error`

Now, when a `return` statement is encountered, the latest value stored in `i`
and `e` are the returned values from this function. The above is meant
to be a demonstration of using named values, but let's consider for a moment
if there is any reason to prefer this over the "non-named" version.

I will list the pros first:

1. I do like declaring the variables along with the function signature, automatically giving the variables a function scope
2. Returning from the function is, simply writing `return`

And the cons are:

1. `return` is also valid in a function when it returns no values, so code reading can be an ambiguous exercise
2. What if i mistakenly used one of the variables that i want to return for some temporary calculation forgetting that
its value will be returned
3. I have also got used to writing "explicit" return statements, so it helps my code readability

(They aren't very well defined, as I am still sort of thinking about it)

So, as of this post, i have only found one reason to use named return values - primarily because it's the only way.

## Why would I use Named return values?

Today I was writing gRPC interceptors for my book and i wanted to use `recover()` to "handle" `panic()` 
in a deferred function call. I came across the usefulness of named return values while going through some 
[examples](https://github.com/grpc-ecosystem/go-grpc-middleware). 

This technique is well described in the [Defer, Panic, and Recover](https://blog.golang.org/defer-panic-and-recover) blog
post as - "Deferred functions may read and assign to the returning function's named return values."

Let's consider an updated `myFunc()`:

```go

func myFunc(msg string) (i int, e error) {
	i = 1
	defer func() {
		if r := recover(); r != nil {
			e = fmt.Errorf("Error recovered: %v", r)
		}

	}()
	if msg == "panic" {
		panic("Panicked!")
	}
	i = 2
	return
}
```

We setup a deferred function call where in we call `recover()` and set the error value, `e`
to the recovered error.

If the string argument, `msg` is equal to `panic`, we call the `panic()` function. 

Else, we set the value of `i` to 2 and call `return`.

([Go playground link](https://play.golang.org/p/D4g877Ft2_i))

Now, if we call the function as `i, e := myFunc("don't panic")`, the output will be:
```
I: 2 
Err: <nil>
```

If we call the function as `i, e = myFunc("panic")`, the output will be:

```
I: 1 
Err: Error recovered: Panicked!
```

We need to use named return values technique here, because of one primary reason:
*return* values from a `defer`-red function call are discarded. If you update
`myFunc()` to be as follows: ([Playground link](https://play.golang.org/p/vTTZzuvzVgw))

```go

func myFunc(msg string) (int, error) {
	var i int
	var e error
	i = 1
	defer func() (int, error) {
		if r := recover(); r != nil {
			e = fmt.Errorf("Error recovered: %v", r)
			return i, e
		}
		return i, e

	}()
	if msg == "panic" {
		panic("Panicked!")
	}
	i = 2
	return i, e
}
```

The output of the same two function calls will be:

```
I: 2 
Err: <nil>

I: 0 
Err: <nil>
```

In the second case, the values returned are the `nil` values of the `int` and `error` types - `0`
and `nil` respectively. 

The way I see it, for this use-case named return values give the application authors chance to set 
desired safe/default values that are eventually returned from the function that encountered the 
panic.

Her's a link to a [discussion](
https://stackoverflow.com/questions/15089726/why-should-return-parameters-be-named) on this topic.

## Also check these out

- [Demystifying 'defer'](https://bitfieldconsulting.com/golang/defer)
