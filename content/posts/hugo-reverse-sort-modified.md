---
title:  Sorting pages by last modified data in Hugo
date: 2020-05-05
categories:
-  software
---

This blog is managed as a [git repository](https://github.com/amitsaha/echorand.me) and I use [Hugo](https://gohugo.io/)
as the framework for managing it. I am using the Hugo classic theme which I have tweaked slightly and store it
[along](https://github.com/amitsaha/echorand.me/tree/master/themes/hugo-classic) with the blog source. 

I wanted to modify the sorting of the blog post titles on the index page so that the most recently modified
page was displayed first. The support was [added](https://github.com/gohugoio/hugo/commit/10af906371bedb643f67d89ec370a1236c6504fd)
to Hugo 4 years back, so the following template worked for me:

```
<ul>
  {{ range (where .Data.Pages.ByLastmod.Reverse "Section" "!=" "") }}
  <li>
    <span class="date">{{ .Date.Format "2006/01/02" }}</span>
    <a href="{{ .URL }}">{{ .Title }}</a>
  </li>
  {{ end }}
</ul>
```

The key bit here is: `.Data.Pages.ByLastmod.Reverse`. My blog's config file has the following key information which
is needed for the above to work:

```
enableGitInfo = true
lastmod = ["lastmod", ":fileModTime", ":default"]
```
