---
title: Getting started with Golang plugins
date: 2020-05-26
categories:
-  golang
---

# Introduction

In this post, I will share some of my learnings and explorations on [plugins in Golang](https://golang.org/pkg/plugin/).
We will write a "driver" program which will load two plugins and execute a certain function which
are present in both of them. The driver program will feed an integer into the first plugin, which will run some processing
on it. The result of the first plugin is fed into the second plugin and finally the driver program will print the result.

# Setup

Golang plugins are only supported on Linux and Mac. I am using Golang 1.14 on Linux:

```
go version go1.14.1 linux/amd64

```

Create a new directory for our first plugin and `chdir` into it:

```
$ mkdir golang-plugin-demo
$ cd $_
```

# Writing a shared package

```
$ mkdir types
$ cd types/
```

Create a new file `type.go` with the following contents:

```
package types

type InData struct {
        V int
}

type OutData struct {
        V int
}

```

# Writing the plugins

Navigate one level up in the directory tree and create a "plugin1" directory:

```
$ mkdir plugin1
$ cd plugin

```

Create a new file `plugin.go` with the following contents:

```
package main

import "../types"

var Input types.InData
var Output types.OutData
var Name string

func init() {
        Name = "plugin1"
}

func process() types.OutData {
        o := types.OutData{V: Input.V * 2}
        return o
}
func F() {
        Output = process()
}
```

Build the plugin using:

```
$ go build -buildmode=plugin
```

Navigate one level up in the directory tree and create a "plugin2" directory:

```
$ mkdir plugin2
$ cd plugin

```

Create a new file `plugin.go` with the following contents:

```
package main

import "../types"

var Input types.InData
var Output types.OutData
var Name string

func init() {
        Name = "plugin2"
}
func process() types.OutData {
        o := types.OutData{V: Input.V * 20}
        return o
}
func F() {
        Output = process()
}

```


```
$ go build -buildmode=plugin
```


# Writing the driver program

Now, create a new file `main.go` at the top-level of the directory we created with the following contents:

```
package main

import (
        "log"
        "plugin"

        "./types"
)

func LoadPlugins(plugins []string) {

        d := types.InData{V: 1}
        log.Printf("Invoking pipeline with data: %#v\n", d)
        o := types.OutData{}
        for _, p := range plugins {
                p, err := plugin.Open(p)
                if err != nil {
                        log.Fatal(err)
                }
                pName, err := p.Lookup("Name")
                if err != nil {
                        panic(err)
                }
                log.Printf("Invoking plugin: %s\n", *pName.(*string))

                input, err := p.Lookup("Input")
                if err != nil {
                        panic(err)
                }
                f, err := p.Lookup("F")
                if err != nil {
                        panic(err)
                }

                *input.(*types.InData) = d
                f.(func())()

                output, err := p.Lookup("Output")
                if err != nil {
                        panic(err)
                }
                // Feed the output to the next plugin's input
                d = types.InData{V: output.(*types.OutData).V}
                *input.(*types.InData) = d

                o = *output.(*types.OutData)
        }
        log.Printf("Final result: %#v\n", o)
}

func main() {
        plugins := []string{"plugin1/plugin1.so", "plugin2/plugin2.so"}
        LoadPlugins(plugins)
}

```

At this stage, our directory tree will look like this:

```
.
├── main.go
├── plugin1
│   ├── plugin1.so
│   └── plugin.go
├── plugin2
│   ├── plugin2.so
│   └── plugin.go
└── types
    └── type.go

 ```
 Let's now build and run our driver program:
 
 ```
$ go build
$ ./golang-plugin-demo 
2020/05/26 15:49:48 Invoking pipeline with data: types.InData{V:1}
2020/05/26 15:49:48 Invoking plugin: plugin1
2020/05/26 15:49:48 Invoking plugin: plugin2
2020/05/26 15:49:48 Final result: types.OutData{V:40}

```


# Debrief

The idea of plugins in Golang using the `plugin` package seems to quite simple. Write your plugin, export
certain symbols - functions and variables only and then use them in your driver program. A plugin must be 
in the `main` package. You do not have access to any `type` information from the plugin in your driver program.
Hence to have any kind of type inferencing which is a necessity, we can instead have a shared package
for types (like we do above with `InData` and `OutData`). There doesn't seem to be a way to "return" data
from a plugin to the driver. Hence, we make use of plugin symbol lookup to retrieve the "output" from the plugin.

# Golang plugins in the wild

- [Tyk](https://tyk.io/docs/plugins/golang-plugins/golang-plugins/) can be configured by writing Golang plugins.
- [Gosh](https://github.com/vladimirvivien/gosh) is a shell written in a way where you can write your own commands by
making use of Golang plugins.
- [Discussion on Reddit](https://www.reddit.com/r/golang/comments/b6h8qq/is_anyone_actually_using_go_plugins/) about what folks are using plugins for

