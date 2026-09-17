---
title: Software development as a learning activity
date: 2026-09-15
categories:
-  software
---

[R.D.Laing](https://en.wikipedia.org/wiki/R._D._Laing) apparently said that we are all entitled to our thoughts. So,
like you, i also have a lot of thoughts. This post is about some self-reflective thoughts i have been having, and finally
i have i think come closer to what i have been feeling about the way AI a.k.a. our agents have taken over software
development.

I recently had a chance to reflect on my relationship with software development as a thing I do and as a career. I will refer
to both of them as computer programming for the rest of this post.

I will leave out all the career trajectory, progression, junior, senior, principal, senior, architect, promotions, etc 
out of this post, since i don't have much to say about them. May be one thing - it was a game i never could get myself to 
play - i have worked with a few people who can, and hey, good on them. I tried for a bit, and i didn't like who I needed
to become to play that game. At some point it was how many lines of code, today it might be the number of tokens, it's
all fake currency that gets exchanged for some real currency - but at some point there is a diminishing returns for some
of us. I digress.

## Introduction

So, computer programming. I have been programming in one form or another since 1995. My first program that i can remember
that really clicked it for me was to simulate a physics experiment around convex/concave lenses, and refraction using
GW Basic. Then, I picked up a few languages. But overall, it was essentially, an act of manual typing by hand, reading
from books, learning from books, or a teacher, and then writing by hand literally on paper, and then on a computer.
One of my favorite stories for myself is i read a book on HTML (HTML complete) on one night, and i knew all i needed
to know about html. I loved the beautiy of learnings like those. Similarly, I wrote lots of TSRs in C, and wrote Kernel modeules, compiled Linux from scratch for adding bluetooth support! What fun.

Things have mostly been the same for me and I have kept doing it since i have enjoyed the process of problem solving.
A specific type of problem solving. Features don't interest me, they bore me, soon-ish. But, give me a bug, and then i
will get so stuck on it that everything else goes out of the window. That was what prompted me to switch from software
engineering roles to DevOps/SRE roles because I would then be responsible for writing tools/frameworks for spotting
those bugs. But that became boring too after a while. However, i could see myself doing that for a longer period of time
than working on features. Sure, i have not worked or didn't have it in me to work for all the advanced software companies
out there, so I don't know if i would have liked to work on features for those companies. Either way, i do feel that
features essentially will become boring for me at some point, cause it is really the happy path of things.

Now, what kind of a programmer have i been? I am the kind of programmer who loves the problem solving aspects of the craft.
That it is a tool to solve problems. Hence, if you ask me to solve leet code, i will suck, i have sucked for as long as
i have programmed. I couldn't code a quicksort for you, or a merge sort or those large number arrays, etc basically, 
i cannot and haven't made it through a lot of programming interviews. Hence, code quality - the design patterns, or writing
amazing code, has never been my focus. I love unit testing, and i would definitely want to practice TDD if i wanted to. 
I prefer typed languages like C, Java, and Go over Python or typescript (not a typed language, something that is trying
to transpile to a untyped language) - the latter two are all i code in these days, but i am flexible. And so i have worked
with a few people who have been so nerdy about their type requirements that i have either hated them or felt very inferior
to them, often a mix of both. 

Overall, to summarize, it's fair to say, problem solving has been the reason i have been programming since i first learned
about it. Types, code quality, good design, they are all nice to haves, but i am not gonna debate anyone over your way or my
way. It's the act of writing code, building up an understanding of a system - however small it is, and then knowing
how it works, the next time i come back to it, that's what I love about computer progrmaming. It is also an act of 
mindfulness for me, i zone in when i am coding by hand. The noise of the brain goes away. I am developing an understanding
of what i am writing. I am feeling involved. I am part of the solution designing.

That leads me nicely to my relationship with a few things:

1. Third party libraries
2. Auto completion and configuring tools to make programming easier
3. AI based Inline code assistance and auto generation
4. Agentic development

Concurrently, interleaved with my software engineering "career", i have also been writing 
articles in various publications (since early 2006/7), giving talks at conferences and 
writing books as another track to develop my understanding. As I have shared in another post on this blog,
that has been how I have been able to develop a understanding of a lot of things. The friction involved in
an often implicit and assumed understanding and translating that to a form for someone else to make sense of,
has resulted in a lot of pleasure for me - the revised, often fuller understanding of things that came out of
any of those exercises gave me a lot of pleasure. And I only realize it when I stop doing it. For example, this
blog itself - there was a two year gap where I didn't post anything here.


## Third party libraries

I started my programming with GW Basic. We will ignore it for the rest of the post as it is not relevant.

C, C++ and Java were the first languages I coded in for the first few years of my programming life. I learned
them all and wrote various programs. I coded in Java to contribute to NetBeans IDE. I wrote C/C++ during my time
at Red Hat contributing to `lshw` and wrote some Linux kernel modules, tried to write to MySQL storage engines
during my time at Sun Microsystems, etc. The key aspect that is relevant in this context was, all my programs were
all in most cases, using the standard libraries - `glibc`, `libstdc++`, JDK and perhaps a few very standard
third party libraries, may be `stl`. 

However, around the 2005/06's I started hearing about the Python programming language. I jumped into it.
Working on various projects to learn a new language. It is with Python, that i first started noticing that
third party libraries were a big requirement. In fact, as the years progressed, i could see various shiny
open source projects coming up, libraries for Python. And that's where I first i think felt like why do I need
to use this another random library to do the work I need to do. Despite Python saying batteries included and I
actually liked what it already had, the wider world appears to be gravitating towards third party libraries.

And that was when I first felt this pang of, "What am I gonna do?" - just put these things together and build
the application?

And then fast forward a few years later, I discovered Go and loved it for its standard library. And as my book
will show, or the projects i created for Manning, the usage of third party libraries are minimal - by a conscious
choice. My goal is to teach things, and how they work, not to build applications.

I will not do this section justice if I don't talk about abstractions in this context.

So, when i felt that pang of "what am i gonna do?" in the context of third party libraries. What I am realling feeling
is that, "don't abstract things away from me". However, by using a high level programming language, I am accepting
an abstraction - whether over the JVM, or the assembler, or the Python bytecode compiler. I feel Ok about that choice.
As much as I love working for my results, there is a limit to my love for working hard and also achieving outcomes.

So, accepting abstractions are i believe a necessary choice to live in this world and for sure in the world of computer
programming. At some point, i have desired to write my own programming language etc, but I got bored with the idea of
inventing my own syntax. I also tried to write my own operating system back in the day, but never made it past booting
a desktop from a floppy disk. 

## Autocompletion, snippets etc


## AI and Inline code suggestions


## Agentic software development

---

## Writing books and creating teaching materials

## Conclusion

The turbulence started with me being angry about anyone telling me to use AI to write my applications. 

Then, I wanted to give my own anger a moral - societal voice - so i made it (in my head, of course) about
other people who are juniors starting in the industry. That they paid money to become software developers and 
now suddenly everything has changed. I even created a nice story too for myself - i was like one of these software 
developers 15 years back, etc. And I wanted to do something for them. So I wanted to write a book to help them.

I felt justified and righteous. What an amazing mix! 

And then finally, I chose to come back to myself - this self that has witnessed and only knows about what's happening 
for me. I wanted to write this post to help me clarify my own emotions. 

I feel quite surely at this point, as much as all of that is true, and I don't know if i will do anything at all to solve
that particular problem to help other people, but it is/was really me mourning the learning involved in 
software development/computer programming as I experienced it. And yet, the reality is all these resourceful 
software engineers, the ones who are right now in the middle of it all - they will discover themselves and 
what they like to do - are they builders? Business persons? Or do they love the problem solving aspects of it? It's their journey.

Now, what is my relationship going to be with software development/computer programming when the practicalities of
life knock on my door? I will find out. I am less righteous about it and bringing the whole problem home - what am 
I gonna do about it? Perhaps that's a better way to tackle this problem (a very personal problem) than from anger.

_This post is in progress_ (Last Updated: 17 September, 2026 AEST)
