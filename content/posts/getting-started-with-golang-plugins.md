---
title: Getting started with Golang plugins
date: 2020-05-26
categories:
-  golang
draft: true
---

# Introduction

In this post, I will share some of my learnings and explorations on [plugins in Golang](https://golang.org/pkg/plugin/).
Our first program will write a "driver" program which will load two plugins and execute a certain function which
are present in both of them. The driver program will feed an integer into the first plugin, which will run some processing
on it. The result of the first plugin is fed into the second plugin and finally the driver program will print the result.

# Writing a shared package

# Writing the plugins

# Writing the driver program

