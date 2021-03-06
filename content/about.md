---
title: "About"
date: 2019-06-16T10:53:16+10:00
---


# This blog

This blog is generated using [Hugo](https://gohugo.io) and hosted on 
[GitHub pages](https://github.com/amitsaha/amitsaha.github.io) powered via [GitHub actions](https://github.com/amitsaha/echorand.me/blob/master/.github/workflows/main.yml). 

Basically the publishing flow for me looks like this:

1. I write my new content as a Markdown file and push a new commit with my changes
1. (1) triggers a build - a GitHub action action
1. A Docker image containing `hugo` is built using a custom [Dockerfile](https://github.com/amitsaha/echorand.me/blob/master/Dockerfile)
1. The image is then run to generate the website source
1. The generated website source is then pushed to [amitsaha.github.io](https://github.com/amitsaha/amitsaha.github.io)

# About me

Hello, My name is Amit Saha. I work as a software engineer and I [explore software](https://github.com/amitsaha)
via programming, writing [articles](../articles) and [books](../books) and giving [talks](../talks).

# Open source contributions

Over the years, I have contributed code/docs to various projects in various programming languages:

- NetBeans IDE (Java)
- SymPy (Python)
- CPython (Python)
- NLog (C sharp)
- Statsd exporter (Golang)
- Vector (Rust)
- Inspec (Ruby)

(My email address for these commits would be amitsaha.in@gmail.com or amitksaha@netbeans.org)

# Contact me

You can contact me via [email](mailto:amitsaha.in@gmail.com), [Twitter](http://twitter.com/echorand)
and on [LinkedIn](https://au.linkedin.com/in/echorand). I welcome any queries/questions you may have.
