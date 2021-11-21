---
title:  Go - Shallow copy, Deep copy, Values and references
date: 2021-11-21
categories:
-  go
draft: true
---

## Numbers and Strings

Basic types

[Play](https://play.golang.org/p/2HJ82Qx8prp)

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

Output:

```
n1(0xc0000b8000)=1 n2(0xc0000b8008)=1
n1(0xc0000b8000)=3 n2(0xc0000b8008)=7
s1(0xc00009e210)=hello s2(0xc00009e220)=hello
s1(0xc00009e210)=world s2(0xc00009e220)=universe
```


### Call by Value and Call by reference

[Play](https://play.golang.org/p/HgtLzXfqD-7)


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

Output:

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


## Arrays and Slices

### Shallow and Deep Copy

### Call by Value and Call by reference

## Maps and Structs

- integers and strings
- Slices as members

## Summary


## Resources

- [Shallow copy of a go struct in golang is never a good idea](https://alenkacz.medium.com/shallow-copy-of-a-go-struct-in-golang-is-never-a-good-idea-83be60106af8)
- 
