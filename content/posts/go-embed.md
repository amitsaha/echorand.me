---
title:  Embedding files in Go using the "embed" package
date: 2020-12-20
categories:
- go
---

Go 1.16 Release Candidate 1 was [announced](https://groups.google.com/g/golang-announce/c/U_FUHY4wuSc/m/3_Vw3oqpAgAJ) recently and the most
exciting feature for me in this release is the new "embed" package which allows you to embed a file contents
as part of the Go application binary. 

This ability so far was most easily available via using various third party packages and they worked great. 
You could also use `go generate` to roll out your own solution, if needed. However, now having this facility
in the form of a standard library package is great news.

Let's see how we can use it. I will keep this post updated as the 1.16 release
evolves.

## Getting Go 1.16 RC 1

If you have Go installed already, run:

```go
$ go get golang.org/dl/go1.16rc1

# Substitute ~/go/bin with your GOBIN path if you have
# one set explicitly
$ ~/go/bin/go1.16rc1 download 
...

```

After the above command finishes execution, you will now be able to access the 1.16 go tool:

```
# Substitute ~/go/bin with your GOBIN path if you have
# one set explicitly or GOBIN is not in your PATH
$ ~/go/bin/go1.16rc1 version
go version go1.16rc1 darwin/amd64
```


## Demo - Embedding a template

As an example of a file that we want to embed, let's consider a Go template
which generates Go source code:

```
# We want to embed this
package main

import "fmt"

func main() {
    fmt.Printf("Hello World - Welcome to {{.Name}}'s World")
}
```

The file above is stored in the directory `templates` as a file `main.go.tmpl`. 
To embed the above file contents, we would write the following code using the 
`embed` package:

```go
package main

import _ "embed"

//go:embed templates/main.go.tmpl
var tmplMainGo []byte
```

The key here is of course:

```
//go:embed templates/main.go.tmpl
var tmplMainGo []byte
```

This makes the contents of the above template available as a slice of bytes in
the `tmplMainGo` variable.

We can then access the template as follows:

```
tmpl, err := tmpl.Parse(string(tmplMainGo))
...
```

You can see the working demo [here](https://github.com/amitsaha/go-embed). Clone the repository and run the following steps:

```
# Substitute ~/go/bin with your GOBIN path if you have
# one set explicitly or GOBIN is not in your PATH

$ ~/go/bin/go1.16rc1 build

$ ./go-embed 
package main

import "fmt"

func main() {
    fmt.Printf("Hello World - Welcome to Jane's World")
}

```

## Notes

The `embed` package also currently supports embedding an file system tree via
the `embed.FS` type. See the package docs for the
[details](https://tip.golang.org/pkg/embed/).
