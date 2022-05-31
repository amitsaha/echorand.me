---
title:  PyCon US 2022 Talk - Implementing Shared Functionality Using Middleware
date: 2022-06-01
categories:
-  Python
---

I delivered a talk at the recently concluded [PyCon US 2022 conference](https://us.pycon.org/2022/). 

Amazing conference, great work by the organizers and everybody involved. This was my third time
at PyCon US and my first time participating in the post conference sprints. I contributed
to the Pyodide project during the sprints, and was a great experience to work with the core
developers during the sprints and for a couple of days after the sprints. I also had a great
time speaking to so many people, discussing my talk, my book, their talks, and their work.

This is a [great recap](https://ehmatthes.com/blog/pycon_2022_highlights/) by another attendee
as they experienced the conference themselves. 

## My talk 

My talk was titled "Implementing Shared Functionality Using Middleware". 

While preparing this talk, I went on a journey that taught me so much about
WSGI applications, ASGI applications and how the different frameworks implement
middleware internally. 

Some of my biggest insights which I had and implemented myself are: 

- Writing a WSGI middleware allows one write a framework independent middleware
- Using WSGI middleware, we can run a Flask and Django application in the same app server
- Using a middleware it is possible to run WSGI and ASGI applications in the same
  appserver

I hope I was able to communicate all my own learnings effectively via my talk. 

The video is now available [here](https://www.youtube.com/watch?v=_t7GxTbKocc). 

Slides and Demo code are available [here](https://github.com/prod-python/pycon-us-2022).

I want to take a moment to acknowledge PyCon providing a free service for speakers
to have a session with a speaking coach. That was really very helpful in improving
my own talk delivery and presentatition.