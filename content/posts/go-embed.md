---
title:  Embedding files in Go using the "embed" package
date: 2020-12-20
categories:
- go
---

- [Demo - Embedding a template](#demo---embedding-a-template)
- [Demo - Serving files from a directory](#demo---serving-files-from-a-directory)
- [Learn more](#learn-more)


The most exciting feature for me in the Go 1.16 release is the new ["embed"](https://golang.org/pkg/embed/)
package which allows you to embed a file contents as part of the Go application binary. 

This ability so far was most easily available via using various third party packages and they worked great. 
You could also use `go generate` to roll out your own solution, if needed. However, now having this facility
in the form of a standard library package is great news.

Let's see how we can use it. 

First of course, download and install Go as per the [instructions](https://golang.org/dl/)


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
$ cd simple-template
$ go build

$ ./go-embed 
package main

import "fmt"

func main() {
    fmt.Printf("Hello World - Welcome to Jane's World")
}

```

## Demo - Serving files from a directory

Say, you have a directory of files, `htmx-static` containing two files:

- `htmx.js`
- `response-targets.js`

To embed the files and then make them accessible via a HTTP server, you would do something like this:

```go
import (
	"embed"
	"net/http"
	
)

// the go:embed directive which specifies the directory which we want
// to embed so we use the embed.FS type

//go:embed htmx-static
var htmxAssets embed.FS


func main() {

	mux := http.NewServeMux()
	mux.Handle("/htmx-static/", http.FileServer(http.FS(htmxAssets)))

	
	log.Fatal(http.ListenAndServe(":8080", mux))

}
```

Once you have that, any requests to your server for the path, `/htmx-static/` will be served from
the file server created from the embedded `htmxAssets` directory.

For example, when we have a request for `http://localhost:8080/htmx-static/htmx.js`, the file, `htmx.js`
will be looked up *inside* the `htmx-static` directory you embedded.

You can find the demo [here](https://github.com/amitsaha/go-embed) inside the `simple-directory`
directory.

## Learn more

See the package docs for the [details](https://golang.org/pkg/embed/).
