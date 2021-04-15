---
title:  Check Go Module Path Validity
date: 2021-04-15
categories:
-  go
---

The Go module path enforces certain restrictions as expected on what constitutes a valid path.
Try running `go mod init https://foo.bar/baz` for example. 

Now, what if you as a Go programmer needed to run this check yourself? That's where the 
[golang.org/x/mod/](https://pkg.go.dev/golang.org/x/mod/module) package comes in.
It has a number of functions, one of them being the [CheckPath](https://pkg.go.dev/golang.org/x/mod/module#Check)
function, which you can use as follows:

```
// Using Go 1.16
package main

import (
	"fmt"
	"golang.org/x/mod/module"
)

func main() {
	err := module.CheckPath("https://github.com/foo/bar")
	fmt.Printf("%v\n", err)
}
```

Running the above will print an error as the module path is invalid:

```
malformed module path "https/github.com/foo/bar": missing dot in first path element
```

Here's a [Playground link](https://play.golang.org/p/PNDgARMYLrZ).

Initially i thought, it was just because `https://` was a protocol specifier, but the restrictions
are broader, so always great to be able to do that using the [golang.org/x/mod/](https://pkg.go.dev/golang.org/x/mod/module) package.


