---
title:  Notes on Go
date:  2019-08-07
categories:
-  go
---


## Repeating the same argument to Printf

If we wanted to repeat the same argument to a call to `fmt.Printf()`, we can make use of "indexed" arguments.
That is, instead of writing `fmt.Printf("%s %s", "Hello", "Hello")`, we can write `fmt.Printf("%[1]s %[1]s", "Hello")`.
Learn about it in the [docs](https://golang.org/pkg/fmt/).

## Multi-line strings

Things are hassle free on the multi-line strings front:

```
package main

import (
	"fmt"
)

func main() {

	s := `Multi line strings
are easy. So are strings with "double quotes"
and 'single quotes'`
	fmt.Print(s)

}

```


## Maps with values as maps

First, we define the map:

```
var clusters = make(map[int]map[string]int)
```


Then, we assign a value which is another map, that we create:

```
clusters[clusterNum] = map[string]int{
				"a": 1,
				"b": 1,
}

```

We can then modify the map defined as the value, like so:

```
clusters[1]["a"] = 5
```

## Check if a key is present in a map

Here we can make use of the multiple return value from the map query statement:

```
// The ok variable will be true if key present
// else false
if _, ok := flatMap[tblName]; !ok {
     // not present
} else {
    // present
}
```


## Reading data from a database into structs

The following snippet can be used to read the rows of a table from a SQL db into structure variables:

```
package main

import "fmt"

type Node struct {
	data1 string
	data2 string
}

func main() {

	//..

	rows, err := db.Query(q)
	var results []Node

	if err != nil {
		fmt.Printf("Error querying: %v\n", err.Error())
	} else {
		defer rows.Close()

		for rows.Next() {
			var n Node
			err = rows.Scan(&n.data1, &n.data2)
			if err != nil {
				fmt.Printf("Error serializing data into variable: %v\n", err)
			}
			results = append(results, n)
		}
	}
}

```

## Check if a string starts with another string

```
// Does the value in `variable` start with "prefix"
strings.HasPrefix(variable, "prefix")
```


## Genearate a random integer in [0,n)

```
fmt.Printf("Random integer between 0-100: %v\n", rand.Intn(100))
```

## Quotient and Modulus

```
fmt.Printf("1/2 - Modulus: %v Quotient: %v", 1%2, 1/2)
```


## Walking a directory tree

Let's say we want to walk a directory tree and only list/perform operation on files of a certain extension:

```
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func main() {

	// Walk the directory tree starting at os.Args[1]
	err := filepath.Walk(os.Args[1], func(path string, info os.FileInfo, err error) error {
		if err != nil {
			panic(err)
		}
		if info.IsDir() {
			return nil
		}
		if filepath.Ext(path) == ".go" {
			// Extract just the "filename" part of "filename.go"
			fName := filepath.Base(path)
			filename := strings.TrimSuffix(fName, filepath.Ext(path))
			fmt.Printf("path: %s filename: %s\n", path, filename)

		}
		return nil
	})
	if err != nil {
		panic(err)
	}

}

```

## Reading structure tags

```
package main

import (
	"fmt"
	"reflect"
)

type node struct {
	Rule string `metadata1:"value1" metadata2:"value2"`
	Name string `metadata2:"value3"`
}

func main() {

	n := node{
		Rule: "A rule",
		Name: "A name",
	}
	// Reflect example  code from
	// https://gist.github.com/drewolson/4771479
	val := reflect.ValueOf(&n).Elem()
	for i := 0; i < val.NumField(); i++ {
		valueField := val.Field(i)
		typeField := val.Type().Field(i)
		tag := typeField.Tag
		metadataOneAttribute := tag.Get("metadata1")
		metadataTwoAttribute := tag.Get("metadata2")

		fmt.Printf("%v (metadata1: %v metadata2: %v)\n", valueField.Interface(), metadataOneAttribute, metadataTwoAttribute)

	}
}

```


## Dot imports in Go

When you import a package as `import . "path/to/pkg"`, you don't have to use
`pkg.ExportedSymbol` to refer to the `ExportedSymbol` in `pkg` any more. You
can just use `ExportedSymbol`.

Learn more about it
[here](https://stackoverflow.com/questions/6478962/what-does-the-dot-or-period-in-a-go-import-statement-do).
Of course, it is not a feature that's well liked by everyone in the community
and there is a proposal to remove it from [Go
2](https://stackoverflow.com/questions/6478962/what-does-the-dot-or-period-in-a-go-import-statement-do).

I first learned about it in this [podcast](https://changelog.com/gotime/155).
