---
title: Serialization
date: 2021-09-18
categories:
-  software
---

I always get confused between "serialization" and "deserialization". Perhaps, that is 
because I am trying to memorize what they are, and then trying to recall from memory.
Of course, it's sufficient to remember only one of them correctly.

So, here's my trick that I am going to use from now on. It is derived from this Wikipedia
article on the subject, in the Drawbacks section:

> Serialization breaks the opacity of an abstract data type by potentially exposing private implementation details. 

When I want to _*S*tore_ some data that we have in an application's memory as an object of some
*abstract data type*, we serialize it. For example, serializing a `struct` in Go to a JSON file on disk.

A [reference](https://web.archive.org/web/20150405013606/http://isocpp.org/wiki/faq/serialization#serialize-overview) from the Wikipedia 
article explains serialization in this manner:

> It lets you take an object or group of objects, put them on a disk or send them through a wire 
> or wireless transport mechanism, then later, perhaps on another computer, 
> reverse the process: resurrect the original object(s). The basic mechanisms are to flatten object(s) 
> into a one-dimensional stream of bits, and to turn that stream of bits back into the original object(s).

> Like the Transporter on Star Trek, it’s all about taking something complicated and turning it into a 
> flat sequence of 1s and 0s, then taking that sequence of 1s and 0s (possibly at another place, possibly 
> at another time) and reconstructing the original complicated “something.”

So, the understanding I obtained based on reading the Wikipedia article and the above reference, I serialized it by
writing this blog post. Or did I deserialize it? Who knows.
