---
title: Shallow copy and Deep copy in Go
date: 2021-11-21
categories:
-  go
---

A **shallow copy** of an variable/object is a copy of an object, usually a container - for example, an array or
a struct type such that the elements in both the copy and the original object are occupying the same 
*memory addresses*.

(PS: I am not sure, but perhaps, [Rust](https://hashrust.com/blog/moves-copies-and-clones-in-rust/) does this differently
where moving a basic data type is a shallow copy? I may be completely wrong).

A **deep copy** of an variable/object is a copy of an object such that the copy and the original object
occupy different *memory addresses*.

This post is about *shallow* and *deep copy* in Go as it applies to various data types.  As it turns out,
for certain data types, a deep copy is the default, while as for others shallow copy is the default.

Let's go exploring!

- [Basic data types](#basic-data-types)
	- [Call by Value and Call by reference](#call-by-value-and-call-by-reference)
	- [Summary](#summary)
- [Slice of integers and strings](#slice-of-integers-and-strings)
	- [Call by Value and Call by reference](#call-by-value-and-call-by-reference-1)
	- [Summary](#summary-1)
- [Arrays of strings and integers](#arrays-of-strings-and-integers)
	- [Call by Value and Call by reference](#call-by-value-and-call-by-reference-2)
	- [Summary](#summary-2)
- [Elements in Maps and Struct types](#elements-in-maps-and-struct-types)
	- [Call by Value and Call by reference](#call-by-value-and-call-by-reference-3)
	- [Summary](#summary-3)
- [Conclusion](#conclusion)
- [Resources](#resources)
## Basic data types

Let's consider two of the basic data types - `int` and `string`.

Consider the following program: ([Link to Playground](https://play.golang.org/p/2HJ82Qx8prp))

```go
package main

import (
	"fmt"
)

func main() {
	var n1 int = 1
	var s1 string = "hello"

	// integers
	n2 := n1
	fmt.Printf("n1(%p)=%v n2(%p)=%v\n", &n1, n1, &n2, n2)
	n1 = 3
	n2 = 7
	fmt.Printf("n1(%p)=%v n2(%p)=%v\n", &n1, n1, &n2, n2)

	// strings
	s2 := s1

	fmt.Printf("s1(%p)=%v s2(%p)=%v\n", &s1, s1, &s2, s2)

	s1 = "world"
	s2 = "universe"

	fmt.Printf("s1(%p)=%v s2(%p)=%v\n", &s1, s1, &s2, s2)
}

```

We declare `n1` and `s1` as an integer and a string, respectively with each having an initial value.
When we write the statement, `n2 := n1`, we are creating a new integer variable, `n2`. 
Similarly, `s2 := s1` creates a new string variable. When we create these variables, their
values are the same as that referred to by `n1` and `s1`, respectively. Then, when we update the values,
the changes remain confined to the variables we are updating - i.e. updating the value of `n2` doesn't
affect the value of `n1` and vice-versa.

Hence, when we run the above code, you will see an output as follows:

```
n1(0xc0000b8000)=1 n2(0xc0000b8008)=1
n1(0xc0000b8000)=3 n2(0xc0000b8008)=7
s1(0xc00009e210)=hello s2(0xc00009e220)=hello
s1(0xc00009e210)=world s2(0xc00009e220)=universe
```

The values of the form `0x` are the *memory address* of a variable, `n1` obtained by the statement, `&n1`
and printed using the `%p` verb.

Next, let's update the code above to understand what happens when we call functions passing integers and strings
as arguments.

### Call by Value and Call by reference

Consider the following program ([Link to Playground](https://play.golang.org/p/HgtLzXfqD-7)):

```go
package main

import (
	"fmt"
	"log"
)

func callByReference(n1, n2 *int, s1, s2 *string) {
	*n1 = 3
	*n2 = 7
	fmt.Printf("n1(%p)=%v n2(%p)=%v\n", n1, *n1, n2, *n2)

	*s1 = "world"
	*s2 = "universe"

	fmt.Printf("s1(%p)=%v s2(%p)=%v\n", s1, *s1, s2, *s2)

}

func callByValue(n1, n2 int, s1, s2 string) {
	n1 = 3
	n2 = 7
	fmt.Printf("n1(%p)=%v n2(%p)=%v\n", &n1, n1, &n2, n2)

	s1 = "world"
	s2 = "universe"

	fmt.Printf("s1(%p)=%v s2(%p)=%v\n", &s1, s1, &s2, s2)
}

func main() {
	var n1 int = 1
	var s1 string = "hello"

	// integers
	n2 := n1
	fmt.Printf("n1(%p)=%v n2(%p)=%v\n", &n1, n1, &n2, n2)

	// strings
	s2 := s1

	fmt.Printf("s1(%p)=%v s2(%p)=%v\n", &s1, s1, &s2, s2)

	log.Println("Calling function callByValue")
	callByValue(n1, n2, s1, s2)
	
	log.Println("Back to main()")
	fmt.Printf("n1(%p)=%v n2(%p)=%v\n", &n1, n1, &n2, n2)
	fmt.Printf("s1(%p)=%v s2(%p)=%v\n", &s1, s1, &s2, s2)
	
	log.Println("Calling function callByReference")
	callByReference(&n1, &n2, &s1, &s2)
	
	log.Println("Back to main()")
	fmt.Printf("n1(%p)=%v n2(%p)=%v\n", &n1, n1, &n2, n2)
	fmt.Printf("s1(%p)=%v s2(%p)=%v\n", &s1, s1, &s2, s2)	

}
```

We define two functions, `callByValue()` and `callByReference()`. Both the functions accept two integers
and two strings as parameters. In each function, we then proceed to update the values of the variables
that the functions were called with. The difference is that the first function accepts the values of existing
integer and string variables, and the second function accepts the *memory address* or pointer to variables
containing integer and string values.

When we run the program, we will see the following output:

```go
n1(0xc000018030)=1 n2(0xc000018038)=1
s1(0xc000010230)=hello s2(0xc000010240)=hello

2009/11/10 23:00:00 Calling function callByValue
n1(0xc000018098)=3 n2(0xc0000180b0)=7
s1(0xc000010270)=world s2(0xc000010280)=universe

2009/11/10 23:00:00 Back to main()
n1(0xc000018030)=1 n2(0xc000018038)=1
s1(0xc000010230)=hello s2(0xc000010240)=hello

2009/11/10 23:00:00 Calling function callByReference
n1(0xc000018030)=3 n2(0xc000018038)=7
s1(0xc000010230)=world s2(0xc000010240)=universe

2009/11/10 23:00:00 Back to main()
n1(0xc000018030)=3 n2(0xc000018038)=7
s1(0xc000010230)=world s2(0xc000010240)=universe
```

The changes made in the `callByValue()` function are not visible in the `main()` function. However, 
the changes made inside the second function are. 

When we called the `callByValue()` function, we created a new set of variables containing the values of the 
existing variables. Hence, we changed the values of these new variables, the values of the existing variables 
which were defined in `main()` are not affected. On the other hand, when calling `callByReference()`, we passed
along the *memory addresses* of the variables called in `main()` function. Hence, any updations to the values
of those variables, affected the original variables, since they are manipulating the same memory address.


### Summary

When it comes to the basic types, numbers and strings, it is always *deep copy*.

There is no *shallow copy* when it comes to these types. Another way of saying that is that, when we want
a *shallow copy*, use *memory addresses* for basic data types.

Next, let's explore what happens when we have basic data types as elements in a slice.

## Slice of integers and strings

Consider the following program: ([Link to playground](https://go.dev/play/p/Wd490w3WJpU))

```go
package main

import (
	"fmt"
	"strings"
)

func main() {
	var n1 []int = []int{1, 2, 3}
	var s1 []string = []string{"hello", "world"}

	// slice of integers
	n2 := n1
	fmt.Printf("n1(%p)=%v n2(%p)=%v\n", &n1, n1, &n2, n2)

	fmt.Println("Update n2[0]")
	n2[0] = n2[0] * 10
	fmt.Printf("n1(%p)=%v n2(%p)=%v\n", &n1, n1, &n2, n2)

	fmt.Println("Assign new slice to n2")
	n2 = []int{100, 110, 120}
	fmt.Printf("n1(%p)=%v n2(%p)=%v\n", &n1, n1, &n2, n2)

	// strings
	s2 := s1
	fmt.Printf("s1(%p)=%v s2(%p)=%v\n", &s1, s1, &s2, s2)

	fmt.Println("Update s2[0]")
	s2[0] = strings.ToUpper(s2[0])
	fmt.Printf("s1(%p)=%v s2(%p)=%v\n", &s1, s1, &s2, s2)

	fmt.Println("Assign new slice to s2")
	s2 = []string{"Hi", "go play ground"}
	fmt.Printf("s1(%p)=%v s2(%p)=%v\n", &s1, s1, &s2, s2)
}
```


We define a slice, `n1` containing integers. We create a new slice, `n2` using the statement, `n2 := n1`.

We then, update the value of the first element of `n2` using `n2[0] = n2[0]*10`. 

At this stage when we print the two slices, we see that the first element of *both* the slices, `n1` and `n2`
has been updated. This is because when we created a copy of `n1`, it performed a *shallow copy*. Hence, even
though the memory addresses of `n1` and `n2` are different, as you will soon see in the output, the elements
they contain were pointing to the same underlying *memory addresses*.

Then, when we create a new slice and assign it to `n2`, we have now overwritten the elements of the slice,
`n2`. Hence, the slice, `n1` is not affected.

The same behavior is seen for the slice of strings, `s1` and `s2`.

When we run the program, you will see the following output:

```
n1(0xc00000c030)=[1 2 3] n2(0xc00000c060)=[1 2 3]
Update n2[0]
n1(0xc00000c030)=[10 2 3] n2(0xc00000c060)=[10 2 3]
Assign new slice to n2
n1(0xc00000c030)=[10 2 3] n2(0xc00000c060)=[100 110 120]
s1(0xc00000c048)=[hello world] s2(0xc00000c108)=[hello world]
Update s2[0]
s1(0xc00000c048)=[HELLO world] s2(0xc00000c108)=[HELLO world]
Assign new slice to s2
s1(0xc00000c048)=[HELLO world] s2(0xc00000c108)=[Hi go play ground]
```

How does the above translate to passing slices as function arguments?

### Call by Value and Call by reference

When it comes to a slice, we are always working with shallow copies. Hence, there is no need for a call by reference
when it comes to slices. Simply passing the slice is a call by reference. [This playground link](https://go.dev/play/p/xJElc3RhI9f)
has an example.

### Summary

When it comes to a slice of basic data types, we are by default working with a *shallow copy*. If you want to create
a *deep copy*, you will find the [copy()](https://pkg.go.dev/builtin#copy) function useful. See [here](https://stackoverflow.com/a/27056295)
for an example of creating a deep copy of a slice.

Why do we have the default behavior copying a slice as a shallow copy? The Effective Go guide has 
the [answer](https://go.dev/doc/effective_go#slices):

> Slices hold references to an underlying array, and if you assign one slice to another, both refer to the same array. If a function takes a slice argument, changes it makes to the elements of the slice will be visible to the caller, analogous to passing a pointer to the underlying array.

So, we should expect the behavior to be different when it comes to arrays then? Let's find out.

## Arrays of strings and integers

Consider the following program. Compared to the previous program, we use arrays instead
of slices ([Link to the playground](https://play.golang.org/p/7UPwSyR6628)):


```go

package main

import (
	"fmt"
	"strings"
)

func main() {
	var n1 [3]int = [3]int{1, 2, 3}
	var s1 [2]string = [2]string{"hello", "world"}

	// array of integers
	n2 := n1
	fmt.Printf("n1(%p)=%v n2(%p)=%v\n", &n1, n1, &n2, n2)
	n2[0] = n2[0] * 10
	fmt.Printf("n1(%p)=%v n2(%p)=%v\n", &n1, n1, &n2, n2)
	n2 = [3]int{100, 110, 120}
	fmt.Printf("n1(%p)=%v n2(%p)=%v\n", &n1, n1, &n2, n2)

	// array of strings
	s2 := s1
	fmt.Printf("s1(%p)=%v s2(%p)=%v\n", &s1, s1, &s2, s2)
	s2[0] = strings.ToUpper(s2[0])
	fmt.Printf("s1(%p)=%v s2(%p)=%v\n", &s1, s1, &s2, s2)
	s2 = [2]string{"Hi", "go play ground"}
	fmt.Printf("s1(%p)=%v s2(%p)=%v\n", &s1, s1, &s2, s2)
}
```

We define an array, `n1` containing integers. We create a new array, `n2` using the statement, `n2 := n1`.

We then, update the value of the first element of `n2` using `n2[0] = n2[0]*10`. 

At this stage when we print the two arrays, we see that the first element of only the second array has been updated.
`n1` hasn't been affected. Thus, we are working with a deep copy of our original array.

Then, when we create a new array and assign it to `n2`, we have now overwritten the elements of the array,
`n2`. Hence, once again the array, `n1` is not affected.

The same behavior is seen for the array of strings, `s1` and `s2`.

When we run the program, you will see the following output:


Output:

```
n1(0xc0000b8000)=[1 2 3] n2(0xc0000b8018)=[1 2 3]
n1(0xc0000b8000)=[1 2 3] n2(0xc0000b8018)=[10 2 3]
n1(0xc0000b8000)=[1 2 3] n2(0xc0000b8018)=[100 110 120]
s1(0xc0000ba000)=[hello world] s2(0xc0000ba020)=[hello world]
s1(0xc0000ba000)=[hello world] s2(0xc0000ba020)=[HELLO world]
s1(0xc0000ba000)=[hello world] s2(0xc0000ba020)=[Hi go play ground]
```

### Call by Value and Call by reference

When it comes to arrays, we are always working with deep copies. Hence, if we want to pass an array which
we want to modify in another function and want the updated result to be reflected in the original array, we
should pass the array by reference. [This playground link](https://go.dev/play/p/PDiSKXsQmtP) has an example.

It looks like this:

```
func callByReference(n1, n2 *[3]int, s1, s2 *[3]string) {
	n1[0] = 3
	n2[0] = 7
	fmt.Printf("n1(%p)=%v n2(%p)=%v\n", &n1, n1, &n2, n2)

	s1[0] = "world"
	s2[0] = "universe"

	fmt.Printf("s1(%p)=%v s2(%p)=%v\n", &s1, s1, &s2, s2)
}


callByReference(&n1, &n2, &s1, &s2)
```

In the `callByReference()` function, we can see how Go allows us to work with the individual elements
as if we are working with an array variable, n1 and not a pointer to an array, n1.

### Summary

The default behavior of copying arrays is thus, deep copy. If your intention is to have a shallow copy,
you will need to work with a pointer to an array, rather than a copy of the array, such as inside a function.

## Elements in Maps and Struct types

A `map` and `struct` types are special as their elements are either one of the basic types, or an array or a slice
of basic types. Thus, in the context of shallow and deep copy, we have two questions we want to explore:

1. What is the behavior of the `map` and `struct` type itself?
2. What is the behavior of the elements which are values of the `struct` or the `map`?


The answer for a map is described in [Effective Go](https://go.dev/doc/effective_go#maps):

> Like slices, maps hold references to an underlying data structure. If you pass a map to a function that changes the contents of the map, the changes will be visible in the caller. 

Thus, the default behavior of a `map` is a shallow copy.

A `struct` is by default deep copied. However, consider what happens to the constituent elements as
we explore our second question above next.

A `map` is by default shallow copied and hence automatically, the keys and values are shallow copied too,
irrespective of the behavior of the constituent elements.

For a value of a `struct` type, the behavior of the constituent elements is preserved as it would be when they
are not elements of a struct type. That is:

- An integer, a string and an array will be deep copied when a struct or a map is copied
- A slice will be shallow copied when a struct or a map is copied.

Consider the following code for an example ([link to playground](https://go.dev/play/p/D6hRpNroZoP)):


```go
package main

import (
	"fmt"
	"log"
	"strings"
)

type myStruct struct {
	a    string
	arr  [3]int
	arr1 []string
}

func callByValue(s myStruct) {
	s.a = strings.ToUpper(s.a)
	s.arr[0] = 100
	s.arr1[1] = "ih"
}

func callByReference(s *myStruct) {
	s.a = strings.ToUpper(s.a)
	s.arr[0] = 100
	s.arr1[1] = "ih"
}

func main() {

	s := myStruct{
		a:    "hello",
		arr:  [3]int{1, 2, 3},
		arr1: []string{"hi", "there"},
	}

	fmt.Printf("%#v\n", s)

	fmt.Println()

	log.Println("Calling function callByValue")
	callByValue(s)
	log.Println("Back to main()")
	fmt.Printf("%#v\n", s)

	fmt.Println()

	log.Println("Calling function callByReference")
	callByReference(&s)
	log.Println("Back to main()")
	fmt.Printf("%#v\n", s)
}
```

We define a `struct` type:

```
type myStruct struct {
	a    string
	arr  [3]int
	arr1 []string
}
```

Both the `callByValue()` and `callByReference()` function performs the same modifications to the struct value.
However, only the changes to the `arr1` element performed in the `callByValue()` function is reflected in `main()`.
The change to `arr` is not reflected as we would expect based on our previous discussions. Of course, when
we then invoke the `callByReference()` function, all the three changes are reflected in `main()`, as we
are working with a pointer to the struct value.

Running the above program will show the following output:

```
main.myStruct{a:"hello", arr:[3]int{1, 2, 3}, arr1:[]string{"hi", "there"}}

2009/11/10 23:00:00 Calling function callByValue
2009/11/10 23:00:00 Back to main()
main.myStruct{a:"hello", arr:[3]int{1, 2, 3}, arr1:[]string{"hi", "ih"}}

2009/11/10 23:00:00 Calling function callByReference
2009/11/10 23:00:00 Back to main()
main.myStruct{a:"HELLO", arr:[3]int{100, 2, 3}, arr1:[]string{"hi", "ih"}}
```

[This](https://alenkacz.medium.com/shallow-copy-of-a-go-struct-in-golang-is-never-a-good-idea-83be60106af8) 
article specifically discusses a bit more around why you should never shallow copy a struct type. The author
makes an interesting observation (Quoted) - "structs evolve over time". Thus, it's a better idea to
adopt deep copying from the get go than getting bugged later and adopting it.

### Call by Value and Call by reference

A `map` is by default call by reference and `struct` is by default call by value. Hence, if you want call by value
behavior:

1. `map`: Create a deep copy by creating a new map and copying the key value pairs. Be careful of also ensuring that you deep
   copy the elements themselves
2. `struct`: Create a deep copy by creating a new struct and copying the elements. Be careful of also ensuring that you deep copy 
   the elements themselves

If you want call by reference behavior:

1. `map`: Nothing special to do, passing a map is by default call by reference
2. `struct`: Pass a pointer to the struct value instead of the struct itself

### Summary

A map is shallow copied and a struct is deep copied, but the elements of the struct may be deep copied
or shallow copied depending on their own default behavior.

## Conclusion

As we have seen in this post (or let's say as I learned while writing this post), whether a value in Go is shallow
copied or deep copied varies. It has to do with the *internal* representation of the data type itself. Hence, the
Effective Go refers to values of type map, a slices or a channel as a reference to an underlying data structure.
The section [Allocation with make](https://go.dev/doc/effective_go#allocation_make) describes this behavior. We
haven't looked at channels in this post (may be in future), but they also belong to the same category
of maps and slices and hence should exhibit similar behavior. 

A "surprise" for me that I had to overlook when I was working on this post was that shallow copies had
different memory addresses, as printed by the `%p` verb. When I first came across the shallow copy
behavior in some code (the contributing cause to writing this post), I was perplexed since the
memory addresses was different. That remains an unanswered question for me, for now.

I explored the same topic in C and Python programming languages several years back:

- [Data in C](http://echorand.me/data-in-c.html)
- [Date in CPython](http://echorand.me/data-in-cpython.html)
- [Data in C and CPython](https://echorand.me/posts/data-in-c-cpython/)

## Resources

- [Effective Go](https://go.dev/doc/effective_go)
- [Basic Types](https://tour.golang.org/basics/11)
- [Understanding Data Types in Go](https://www.digitalocean.com/community/tutorials/understanding-data-types-in-go)
- [Shallow copy of a go struct in golang is never a good idea](https://alenkacz.medium.com/shallow-copy-of-a-go-struct-in-golang-is-never-a-good-idea-83be60106af8)
