---
title:  A demo plugin based Python code analyser
date: 2018-05-13
categories:
-  python
aliases:
- /a-demo-plugin-based-python-code-analyser.html
---

A few weeks back I wrote a analyser for [Apache Thrift IDL](https://thrift.apache.org/) in Python. We used it to enforce
some code review guidelines. When we hooked it onto [arcanist](https://secure.phabricator.com/book/phabricator/article/arcanist/) lint engine, we could give feedback to developers
at the time they were proposing a code change. The thrift parsing was done using [ptsd](https://github.com/wickman/ptsd).
The analyser was written as a single file which meant adding new rules meant changing the engine itself. I wanted to implement
a plugin based architecture for it. However, I didn't get around to do that because of other reasons.

Around the same time, I saw Nick Coghlan suggest [straight.plugin](http://straightplugin.readthedocs.io/en/latest/) to someone
else. So finally, I got around to sit with it and the result is this post and a plugin based
Python code analyser with an accompanying [git repository](https://github.com/amitsaha/py_analyser).

The final result is a program powered by two plugins which will parse a module and print any rule violations that
has been configured by the plugins:

```
2: Class hello: Class name not in CapWords
7: Class Nodocstring: No docstring found in class
10: Class Alongdocstring: Docstring is greater than 100 characters
```


Our analyser has two parts - the core engine and the plugins which can do various things with the code being analysed. For
the demo analyser, we will be focussed on Python classes. We will ignore everything else. And as far as the plugins
are concerned, they check if a certain condition or conditions are met by the class - in other words these are
`checkers`.

Please note that I am using Python 3.6 for everything.

# Core analyser engine

The core analyser engine uses the [ast](https://docs.python.org/3/library/ast.html) module to create an AST node. Checkout
this PyCon 2018 talk - [The AST and Me](https://www.youtube.com/watch?v=XhWvz4dK4ng) if you want to learn more.

Basically, we call the [parse()](https://docs.python.org/3/library/ast.html#ast.parse) function
and we get back an AST Node object which we can then use to traverse through the various nodes using the
[walk](https://docs.python.org/3/library/ast.html#ast.walk) function. Here's the code for the engine at the time of
writing:

```
# analyser/main.py
...
def analyse(file_path):
    with open(file_path) as f:
        root = ast.parse(f.read())
        for node in ast.walk(root):
            if isinstance(node, ast.ClassDef):
                check_class(node)
...
```

As we walk through the tree, we check if a `node` is a Python class via `isinstance(node, ast.ClassDef)`. If it is,
we call this function `check_class` which then invokes all the checks the analyser *knows* of. So, we can write the
`check_class` function such that we have all the rules hard-coded in there or have a way to externally load the check
rules. Externally loading the rules without having to change the core engine is where `straight.plugin` comes in.

This how the `check_class` function looks like at the time of writing:

```
# analyser/main.py
def check_class(node):
    # The call() function yields a function object
    # http://straightplugin.readthedocs.io/en/latest/api.html#straight.plugin.manager.PluginManager.call
    # Not sure why..
    for p in plugins.call('check_violation', node):
        if p:
            p()
```

`plugins` is a basically a plugin registry - `straight.plugin` calls it as `PluginManager`. The `call` method
returns function objects corresponding to the function you specified. Here, I have specified `check_violation`
which expects an argument to be passed, `node`. If it finds an valid object - i.e. it found the specified
method, we call it.

How do we create the plugin registry? We use the `load` function:

```
from straight.plugin import load
plugins = load('analyser.extensions', subclasses=BaseClassCheck)
..
```

The `load` function is called with two parameters:

- The namespace for our plugins which I have set as `analyser.extensions`
- The `subclasses` kwarg specifies that we only want to load classes which are subclasses of `BaseClassCheck`.

`BaseClassCheck` is implemented as follows:


```
# analyser/bases.py
class BaseClassCheck():

    @classmethod
    def check_violation(cls, node):
        raise NotImplementedError('Method not implemented')
    
    @classmethod
    def report_violation(cls, node, msg):
        print('{0}: Class {1}: {2}'.format(node.lineno, node.name, msg))

```

Any plugins for this engine is thus expected to subclass `BaseClassCheck` and implement the `check_violation`
method.

The `setup.py` for the core engine looks as follows:

```
from setuptools import setup


setup(
    name='analyser',
    version='1.0',
    description='',
    long_description='',
    author='Amit Saha',
    author_email='a@a.com',
    install_requires=['straight.plugin'],
    packages=['analyser'],
    zip_safe=False,
)

```

# Writing plugins

Our core engine is done, how do we write plugins? I was faced with this new thing called `namespace packages`.
Looking at the [docs](https://packaging.python.org/guides/packaging-namespace-packages/), it made complete sense.
Basically, you want your plugins to be able to shipped as different Python packages written by different people.

So, let's do that now. There are two example plugins in the `example_plugins` sub-direcotry. Each is a Python package
and has a directory structure as follows:

```
.
├── py_analyser_class_capwords
│   ├── analyser
│   │   └── extensions
│   │       └── capwords
│   │           └── __init__.py
│   └── setup.py
```

The only difference between the two is the final package name `capwords` for the above and `docstring` for the other.
The key point above is the directory structure, `analyser/extensions/capwords`. The other plugin will have the directory
structure `analyser/extensions/docstring`. This is what makes them both belong to the `analyser.extensions` namespace and
hence discoverable by `straight.plugin`. The `setup.py` for the above plugin looks as follows:

```
from setuptools import setup


setup(
    name='analyser-class-capwords',
    version='1.0',
    description='',
    long_description='',
    author='Amit Saha',
    author_email='a@a.com',
    install_requires=['analyser'],
    packages=['analyser.extensions.capwords'],
    zip_safe=False,
)

```

In a practical scenario, we will have these packages elsewhere and will just `pip install` them and the effect
will be the same.

# Trying it all out

These are the things we will need to do:

- Create a new virtual environment
- Install `analyser`
- Install both the above plugins
- Run `$ python analyser/main.py ./module_under_test.py`


But, that's all very boring and I found the tox that I love - [nox](http://nox.readthedocs.io/).
So, there is a `nox.py` file, so if you install `nox`, you can just run `nox` from the root of the respository:

```
$ nox 
...
nox > python analyser/main.py ./module_under_test.py
2: Class hello: Class name not in CapWords
7: Class Nodocstring: No docstring found in class
10: Class Alongdocstring: Docstring is greater than 100 characters
nox > Session human_testing(python_version='3.6') was successful.
...
```

The last three lines of the output is the result of running the checks implemented by the plugins.


The `nox.py` file looks as follows:

```
import nox

@nox.session
@nox.parametrize('python_version', ['3.6'])
def human_testing(session, python_version):
    session.interpreter = 'python' + python_version
    session.run('pip', 'install', '.')
    session.run('pip', 'install', './example_plugins/py_analyser_class_capwords/')
    session.run('pip', 'install', './example_plugins/py_analyser_class_docstring/')
    session.run('python', 'analyser/main.py', './module_under_test.py')
 
```
# Other learnings

Besides all the above things that I learned, I also learned something about the `issubclass` function.
I was wondering why, the below comparisions was returning False:

```
issubclass(<class 'analyser.main.BaseClassCheck'>, <class '__main__.BaseClassCheck'>)
issubclass(<class 'analyser.extensions.capwords.CheckCapwords'> <class '__main__.BaseClassCheck'>)
```

And so basically, I moved `BaseClassCheck` from `analyser/main.py` to `analyser/bases.py` which meant
the namespace of `BaseClassCheck` was always going to be the same.

# Summary

We saw how we can use `straight.plugin` to implement a plug-in architecture in  our programs. We also saw how
we can use the `ast` module to parse Python source code and analyse them and finally we learned about `nox`.

The [git repository](https://github.com/amitsaha/py_analyser) has all the code we discussed in this post.

