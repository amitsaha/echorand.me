---
title:  Python Using specific git commits of third party packages
date: 2018-02-16
categories:
-  Python
aliases:
- /python-using-specific-git-commits-of-third-party-packages.html
---

After a fair number of furious impatient attempts to try and use specific git commits
of third party packages in my Python software, I finally have been able to make it work.
I went back to the drawing board - basically reading 
[setup-vs-requirement](https://caremad.io/posts/2013/07/setup-vs-requirement/).


# Applications

This is what I did:

- If you have a `setup.py`, add the library name to `setup.py` (abstract dependency)
- Add the git URL in a `requirements.txt` file (concrete dependency)
- When you create your deployment artifact, do `pip install -r requirements.txt`.

An example requirements.txt file would look like:

```
git+https://<git repo>@master
..

```

You can replace the `master` by a specific commit/git tag.

# Libraries/End-user focused tools

Now, let's say you are publishing a package to PyPI and this package has a dependency on
a version of a package which is not in PyPi or in a git repo. This is what we do:

In our `setup.py`, we add the package name in `install_requires` and add `dependency_links`
as follows:

```
 dependency_links=['git+https://<git-repo>@4ed6231457c244b8459037ee2224b0ef430cf766#egg=<package-name>-0'],
```

 
However if the third party package is already in `pypi`, we have a problem. So, we fool `pip` like, so:

```
# I fool `pip` by specifying the version number which
# is greater than the one released in PyPi and force
# it to look at the dependency_links where i wrongly specify
# that i have a version which is greater than 0.1.2
install_requires='fire>0.1.2',
dependency_links=[
    'git+https://github.com/google/python-fire.git@9bff9d01ce16589201f57ffef27ea84744951c11#egg=fire-0.1.2.1',
],

```

See an [example project](https://github.com/amitsaha/python-git-dependency-demo/tree/master/application)

Now, if we install `pip install . --process-dependency-links`, we will see:

```
Could not find a tag or branch '9bff9d01ce16589201f57ffef27ea84744951c11', assuming commit.
  Requested fire>0.1.2 from git+https://github.com/google/python-fire.git@9bff9d01ce16589201f57ffef27ea84744951c11#egg=fire-0.1.2.1 (from my-awesome-cli==0.1), but installing version None
```
 
 To then distribute this to  PyPI, we need to make sure that we distribute this as a source tarball, [not a wheel](https://github.com/pypa/pip/issues/3172):
 
```
 $ python setup.py sdist
 $ TWINE_REPOSITORY_URL=https://test.pypi.org/legacy/ TWINE_USERNAME=echorand TWINE_PASSWORD="secret" twine upload dist/*
```
 
 Once we have done that, we can install it, like so:
 
```
$ pip install my-awesome-cli==0.2 --process-dependency-links -i https://test.pypi.org/simple/
...
DEPRECATION: Dependency Links processing has been deprecated and will be removed in a future release.
Collecting fire>0.1.2 (from my-awesome-cli==0.2)
  Cloning https://github.com/google/python-fire.git (to 9bff9d01ce16589201f57ffef27ea84744951c11) to /tmp/pip-build-SykxjY/fire
  Could not find a tag or branch '9bff9d01ce16589201f57ffef27ea84744951c11', assuming commit.
  Requested fire>0.1.2 from git+https://github.com/google/python-fire.git@9bff9d01ce16589201f57ffef27ea84744951c11#egg=fire-0.1.2.1 (from my-awesome-cli==0.2), but installing version None
Collecting six (from fire>0.1.2->my-awesome-cli==0.2)
...

Successfully installed fire-0.1.2 my-awesome-cli-0.2 six-1.10.0
```

We can then run our application:

```
$ my-awesome-cli
Type:        Calculator
String form: <my_awesome_cli.main.Calculator object at 0x7feecae69850>
Docstring:   A simple calculator class.

Usage:       my-awesome-cli
             my-awesome-cli double

```

# Helpful links

- [setup-vs-requirement](https://caremad.io/posts/2013/07/setup-vs-requirement/)
- [pip install specific git commit](https://yuji.wordpress.com/2011/04/11/pip-install-specific-commit-from-git-repository/)
