---
title:  Embedding files in Go using "embed"
date: 2020-12-20
categories:
- go
draft: true
---

Go 1.16 Beta 1 was [announced](https://groups.google.com/g/golang-nuts/c/Jhs9l-mrR20) recently and the most
exciting feature for me in this release is the new "embed" package which allows you to embed a file contents
as part of the Go application binary. 

This ability so far was most easily available via using various third party packages and they worked great. 
You could also use `go generate` to roll out your own solution, if needed. However, now having this facility
in the form of a standard library package is very exciting - even more batteries included now.

Let's see how we can use it.

## Getting Go 1.16 Beta 1

If you have Go installed already, run:

```go
$ go get golang.org/dl/go1.16beta1 

# Substitute ~/go/bin with your GOBIN path if you have
# one set explicitly
$ ~/go/bin/go1.16beta1 download
...

```

After the above command finishes execution, you will now be able to access the 1.16 go tool:

```
# Substitute ~/go/bin with your GOBIN path if you have
# one set explicitly
$ ~/go/bin/go1.16beta1 version
go version go1.16beta1 darwin/amd64
```


## 


