---
title:  A virtualenv first approach to Python projects
date: 2015-11-30
categories:
-  Python
aliases:
- /a-virtualenv-first-approach-to-python-projects.html
---

I have until the last few months (of my ~4 years of working with
Python) always worked without virtualenv for all my Python
projects. Why? I think I found the whole idea of having to do the
following two steps before I work on something cumbersome:

* Remember the exact virtualenv name, and then
* Activate it

That said, I was very much aware that it was certainly a good thing
to do and would cause me less headaches someday. That someday finally
came, and I ran into conflicting package requirements for applications
which needed to run simultaneously. This forced me to start using
virtualenvs. I think I also found the tool which will make me  keep
using them even when I don't *need* to. The tool is `pew
<https://github.com/berdario/pew>`__. 

Installation and Basics
=======================

The home page lists various options of installing ``pew``. The most
straightforward is of course to just use ``pip install pew``. Once you
have it installed, typing ``pew`` lists the various sub-commands, such
as ``new``, ``workon``, ``ls`` and others. Eac of the sub-commands is
accompanied by a summary of they will do.

So far, I have been mostly working with the above sub-commands. Here
is how we can create a new virtualenv:

.. code::

   $ pew new flask-graphql-demo
   New python executable in flask-graphql-demo/bin/python2
   Also creating executable in flask-graphql-demo/bin/python
   Installing setuptools, pip...done.
   Launching subshell in virtual environment. Type 'exit' or 'Ctrl+D' to return.
   flask-graphql-demo $ 

Our virtualenv ``flask-graphql-demo`` is created and we are in it, which we can check:

.. code::

   $ which pip
   ~/.local/share/virtualenvs/flask-graphql-demo/bin/pip

We can do all our usual work now (installing other packages, running
our applications) and once done, we can simply ``exit`` and we will be
out of the virtualenv. 

Now, if I want to resume work on this particular project, I can first
use ``pew ls`` to list the currently created virtualenvs:

.. code::

   $ pew ls
   flask-graphql-demo

and then use ``pew workon flask-graphql-demo`` to start working on it
again. On Linux, ``pew workon`` also gives me all the available
virtualenvs as suggestions automatically.

Conclusion
==========

As you may have already seen, ``pew`` has a number of other features
which should make working with ``virtualenvs`` really easy. It has
definitely made me change my approach to working on Python projects.
