---
title:  Examples of consuming data in Golang templates
date: 2018-09-18
categories:
-  golang
aliases:
- /examples-of-consuming-data-in-golang-templates.html
---

While working on creating a template file for a Golang project, I wanted to better understand how to work
with data in Golang templates as available via the `html/template` package. In this post, I discuss
a few use cases that may arise.

## Accessing a variable

Let's consider our first program:

```
package main

import (
	"html/template"
	"log"
	"os"
)

func main() {

	var names = []string{"Tabby", "Jill"}

	tmpl := template.New("test")

	tmpl, err := tmpl.Parse("Array contents: {{.}}")
	if err != nil {
		log.Fatal("Error Parsing template: ", err)
		return
	}
	err1 := tmpl.Execute(os.Stdout, names)
	if err1 != nil {
		log.Fatal("Error executing template: ", err1)

	}
}

```

When we run the above program [Go playground link](https://play.golang.org/p/St0g-6_G8_1), the output we get is:

```
Array contents: [Tabby Jill]
```

There are three main stages to working with templates in general that we see in the program above:

- Create a new `Template` object: `tmpl := template.New("test")`
- Parse a template string: `tmpl, err := tmpl.Parse("Array contents: {{.}}")`
- Execute the template: `err1 := tmpl.Execute(os.Stdout, names)` passing data in the `names` variable

Anything within `{{ }}` inside the template string is where we do _something_ with the data that we pass in 
when executing the template. This _something_ can be just displaying the data, or performing certain operations
with it. 

The `.` (dot) refers to the data that is passed in. In the above example, the 
entire array contents of `names` is the value of `.`. Hence, the output has the entire array including the surrounding
`[]`. This also means that `names` could have been of another type - a struct for [example](https://play.golang.org/p/vAmNzNFg8LR) like so:

```
..

type Test struct {
	name string
}

func main() {

	..

	//parse some content and generate a template
	tmpl, err := tmpl.Parse("Variable contents: {{.}}")
	if err != nil {
		log.Fatal("Error Parsing template: ", err)
		return
	}
	..
}

```

The output now would be:

```
Variable contents: {Tabby}
```

## Accessing structure members

Now, let's consider that our structure has multiple members and we want to access the individual members in our
template. Here's how we can do so (Golang playground)[https://play.golang.org/p/8BSiYJ_7Mfd]:

```
package main

import (
	"html/template"
	"log"
	"os"
)

type Person struct {
	Name string
	Age  int
}

func main() {

	p := Person{Name: "Tabby", Age: 21}

	tmpl := template.New("test")

	//parse some content and generate a template
	tmpl, err := tmpl.Parse("{{.Name}} is {{.Age}} years old")
	if err != nil {
		log.Fatal("Error Parsing template: ", err)
		return
	}
	err1 := tmpl.Execute(os.Stdout, p)
	if err1 != nil {
		log.Fatal("Error executing template: ", err1)

	}
}
```

The `dot` operator referes to the structure object, `p` and then inside the template, we just specify the
field name, like so, `.<Field>`. The output will be:

```
Tabby is 21 years old
```

## Do something with array elements

Going back to our first example, how do we access the individual array elements? Let's see how we can do so. 

The complete example can be found [here](https://play.golang.org/p/v2qP49qaJp5), but the only change is in the template
string:

```
tmpl, err := tmpl.Parse("{{range .}}Hello {{.}}\n{{end}} ")
```

I find it easy when I read the above template string as:

```
for _, item := range names {       // corresponding to {{range .}}
    fmt.Printf("Hello %s\n", item) // corresponding to Hello {{.}}\n
}                                 // corresponding to {{end}}
```
`range` can be used to iterate over arrays, slice, map or a channel. 

## Arrays of structure objects

Combining the two previous examples, we can access array elements which are structure objects, like so:

```
...
var names = []Person{
		Person{Name: "Tabby", Age: 21},
		Person{Name: "Jill", Age: 19},
}

tmpl := template.New("test")

tmpl, err := tmpl.Parse("{{range .}}{{.Name}} is {{.Age}} years old\n{{end}} ")
err1 := tmpl.Execute(os.Stdout, names)
...
```

The complete program is [here](https://play.golang.org/p/NseTCXCyjF7) and the output from this program is:

```
Tabby is 21 years old
Jill is 19 years old

```
## Calling user defined functions and Chaining

Our next example demonstrates two new things:

- Invoking user-defined functions
- Chaining

The complete example is available [here](https://play.golang.org/p/cksPYVt3RUg) and the output is:

```
Tabby has an odd name 
Jill has an even name 
```

The two main changes from our previous program are:

### Adding a `FuncMap`

```
funcMap := template.FuncMap{  
    "oddOrEven": oddOrEven,
}

tmpl := template.New("test").Funcs(funcMap)
```

A `FuncMap` is how we add our functions to a template's "context" and then invoke them. There are few
rules around the semantics of functions we can add which you can learn [here](https://golang.org/pkg/text/template/#FuncMap).
My favorite is if I return a non-nil error, the template execution will halt without me having to do any
extra checks.

### Chaining

Chaining is how we perform an action and feed it's output to another action via the `|` (pipe) operator:

```
tmpl, err := tmpl.Parse("{{range .}}{{.Name}} has an {{len .Name | oddOrEven}} name \n{{end}}")
```

Here, we invoke the in-built `len` function to calculate the length of `Name` and then call the `oddOrEven` function.

## Controlling output using template strings

My first encounter with Golang templates was when working with [docker](https://docs.docker.com/config/formatting/) output
formatting which allowed controlling what I get as output. Let's see how we can implement something like that
for our program. The entire program is [here](https://github.com/amitsaha/golang-templates-demo/blob/master/format-output/test.go). 

When we run it without passing any arguments:

```
$ go run test.go
Tabby 21 odd
Jill 19 even
```

If however we pass it a format string as the first command line argument, we can control the output:

```
$ go run test.go "{{ .Age }} {{ OddOrEven .Name}}"
21 odd
19 even
```

The two main changes are:

```
func OddOrEven(s string) string {

        if len(s)%2 == 0 {
                return "even"
        } else {
                return "odd"
        }

}
```

The format string is now obtained via a function call:

```
func getFormatString() string {
        placeHolderFormat := "{{range .}}%s\n{{end}}"
        defaultFormatString := "{{.Name}} {{.Age}} {{ OddOrEven .Name}}"
        if len(os.Args) == 2 {
                return fmt.Sprintf(placeHolderFormat, os.Args[1])
        } else {
                return fmt.Sprintf(placeHolderFormat, defaultFormatString)
        }
}
```
We can of course define any arbitrary functions and make them available to be invoked in the context of our templates.

## Rendering an arbitrary template file using arbitrary values

Our next program will take a template string in a file, like so:

```
$ cat cluster.tmpl
Cluster Name: {{.clusterName}}
Max Nodes: {{.maxNodes}}
Nodes: {{range .nodeNames}}
- {{.}}
{{- end}}
```

The data will be provided as an YAML file, like so:

```
$ cat values.yml
clusterName: "test.local"
maxNodes: 10
nodeNames:
- Node 1
- Node 2
```

And our program will print:

```
Cluster Name: test.local
Max Nodes: 10
Nodes:
- Node 1
- Node 2
```

We will take advantage of a third-party package [ghodss/yaml](https://github.com/ghodss/yaml) to parse our YAML
file and the complete program is [here](https://github.com/amitsaha/golang-templates-demo/blob/master/render-arbitrary-template/main.go).

The key bit in the program was to create a map of type `[string]interface` from the provided YAML file. We will run
the program as:

```
$ go run main.go cluster.tmpl values.yml
Cluster Name: test.local
Max Nodes: 10
Nodes:
- Node 1
- Node 2
```

As a side note, note the dash in `{{- end}}`? That is to prevent newlines and spaces. I still don't quite get it,
but it seems like a hit and trial thing!

## Accessing a map object

Complete example [here](https://play.golang.org/p/4kz3Ji_56s9). You will see that by default `range .` iterates
over the map's values, rather than keys (opposite of what we see in the Golang language).


## Explore

There's a lot more to explore in Golang templates. Check out:

- [Golang documentation on template](https://golang.org/pkg/text/template/)
- [sprig](http://masterminds.github.io/sprig/)
