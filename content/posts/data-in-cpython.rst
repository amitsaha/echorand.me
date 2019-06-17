---
title:  Data in CPython
date: 2018-01-26
categories:
-  Python
aliases:
- /data-in-cpython.html
---

When writing programs in Python (CPython), you have access to `data
types` such as a ``int``, ``str``, ``tuple``, ``list`` and a
``dict``. It is fairly obvious what each of these data types would
be used to represent: an ``int`` data type would represent an integer
and a ``list`` would represent a list of items - homeogeneous or
heterogenous. As opposed to a language like C, the Python compiler
automatically decides what type to use for your data without the need
to be explicitly specified.

For example, you create an integer in Python by simply typing in the
integer ::

    >>> 1
    1
    >>>type(1)
    <type 'int'>

As you can see, the compiler automatically knows that `1` is an
integer. Here are a couple of more examples ::

    >>> 1.1
    1.1
    >>> type(1.1)
    <type 'float'>
    >>> s='a string'
    >>> type(s)
    <type 'str'>

type()
======

``type()`` is a built-in function which returns the type of an
`object`. What does `object` have to do with a string or an integer? It so
happens that in Python, `object` is an abstraction for data. That
is, each individual data item you create in a Python program are
represented as Python objects (See `Python data model`_). To make this
clearer, you could create an integer or a string using the `usual`
notation of creating an object (as in `Object-oriented programming`). For example ::

    >>> int(1)
    1
    >>> str('a string')
    'a string'

id()
====

Now we know that every data object has a `type`. There are two other
pieces of information associated with a data object: `value` and
`identity`. The value of a data object is what is stored in it (`1.1`,
`a string`, for example). The `identity` is a way to identify the
object. In CPython, this is the memory address of the object and can
be found using the ``id()`` built-in function. For example ::

    >>> int(1)
    1
    >>> id(1)
    24672184

It is important to realize that the identity of an object is unique
during its lifetime and will never be the same as another object
existing in the same time frame.

The result returned by ``id()`` is going to be different for you, so
please keep that in mind as you work through this article. 

Binding (not copying)
=====================

So far, we have created data objects in memory, but haven't seen a way
to refer to them using an `identifier` (or what most programming
languages call `variables`). Creating an identifier to an object is
done with the ``=`` operator. For example ::

    >>> a=1
    >>> print(a)
    1
    >>> id(a)
    271516493792

The ``is`` operator can be used to check whether two identifiers refer
to the same object.

It is common to use the term `binding` to refer to the above operation
where we specify ``a=1``. We have now understood that ``1`` is an
object in memory. The ``=`` operator `binds` the identifier `a` to the
object `1`. Similarly, you can bind as many identifiers you want to
this object. However, depending whether your object is mutable or
immutable, the binding operation behaves in different ways, which we
discuss in the next section.

Mutable and Immutable data types
================================

Python categorises its data types into two categories on the basis of
its mutability: `mutable` and `immutable`. ``int``, ``str`` and
``tuple`` belong to the immutable category where as ``list`` and
``dict`` belong to the mutable category. On the surface, this seems
simple enough. However, the difference manifests itself
in the form of unexpected results in not-so-obvious places. This is especially
applicable to someone coming from a background in other programming
languages such as C, where such distinctions do not exist beyond that
enforced the ``const`` qualifier. 

Let us begin with an example of a not-so-obvious place where Python
may lead to bewilderment. Depending on whether a data is mutable or
immutable, invoking the ``=`` operator results in different
outcomes. For example ::

    >>> a=int()
    >>> b=int()
    >>> a is b
    True

We now know that ``int`` is a immutable data type. Thus, once created,
its value cannot be changed. Hence, when you
create an empty ``int`` object, and another empty ``int`` object
already exists, the new identifier simply refers to the existing
object. Hence the expression ``a is b`` returns ``True``, since both
the identifiers point to the same ``int`` object.

On the other hand, when we create an empty ``list`` object, a new
object is created everytime. This is because, a list is mutable, and
hence changes may be made to it during its lifetime. This is
illustrated below ::

    >>> a=list()
    >>> b=list()
    >>> a is b
    False

The program listings in `immut.py` and `mut.py` illustrates these
concept by binding the same data object in a function scope and a
class scope. In each case, an object of each type exists in the global
scope and any reference to the same data value binds to the same
object in case of the mutable data types. 

Listing: immut.py ::

    #!/usr/bin/env python
    from __future__ import print_function

    #immutable data types

    int(1)
    print('1: {0}'.format(id(1)))

    str('string')
    print('string: {0}'.format(id('string')))

    tuple()
    print('tuple: {0}'.format(id(tuple())))

    def func():
        a = int(1)
        s = str('string')
	t = tuple()
	print('1: {0}'.format(id(a)))
	print('string: {0}'.format(id(s)))
	print('tuple: {0}'.format(id(t)))

    class A:

        def __init__(self):
            self.a = int(1)
	    self.s = str('string')
            self.t = tuple()

            print('1: {0}'.format(id(self.a)))
            print('string: {0}'.format(id(self.s)))
            print('tuple: {0}'.format(id(self.t)))

    if __name__=='__main__':
        func()
    	a = A()
    	b = A()


The output of the above program should be similar to as follows ::

    1: 39413688
    string: 140617132563168
    tuple: 140617133121616
    1: 39413688
    string: 140617132563168
    tuple: 140617133121616
    1: 39413688
    string: 140617132563168
    tuple: 140617133121616
    1: 39413688
    string: 140617132563168
    tuple: 140617133121616

Note, how all bindings to `1` has the same identifier value and same 
for `string` and `tuple`.

In the case of mutable datatypes, every object created with the same value creates a new data
object.

Listing: mut.py ::

    #!/usr/bin/env python

    # mutable data types: dictionary, list.

    from __future__ import print_function

    dict()
    print('dict: {0}'.format(id(dict())))

    list()
    print('list: {0}'.format(id(list())))

    def func():
        d = dict()
	print('dict: {0}'.format(id(d)))
    
        l = list()
	print('list: {0}'.format(id(l)))

    class A:

        def __init__(self):
            self.d = dict()
	    self.l = list()
	    print('dict: {0}'.format(id(self.d)))
	    print('list: {0}'.format(id(self.l)))
    
    if __name__=='__main__':

        func()
	a = A()
	b = A()


On executing the above program, you will see output similar to as
follows ::


    dict: 29207184
    list: 139914951589968
    dict: 29214192
    list: 139914951590616
    dict: 29214944
    list: 139914951590760
    dict: 29216672
    list: 139914951590904

As we would expect, everytime a new ``list`` or ``dict`` object is
created, a new object in memory is created and the specified binding
established.

Function parameters
===================

The mutability of data becomes an issue to programmers who have been
exposed to function calling methods, popularly known as `call by value` and `call by
reference`. Well, Python's parameter passing belong to neither
category. It suffices to say that in Python, bindings to the actual
objects are passed by the calling code to the called
function. Depending on the nature of the data object that these
bindings are bound to, any change to their values is either propagated
to the calling code or limited to the called function.

The code listing `pass_around.py` illustrates the differences in
behavior of a string (immutable) and a list and a dictionary
(mutable).

Listing: pass_around.py ::

    #!/usr/bin/env python

    """ Passing around mutable and immutable data objects
    """

    from __future__ import print_function

    def func(alist, astr, adict):

        print('In func() before modification')

    	print('{0} : {1}'.format(astr,id(astr)))
    	print('{0} : {1}'.format(alist,id(alist)))
    	print('{0} : {1}'.format(adict,id(adict)))
    	print()

	alist.append('func')
	astr = 'b string'
	adict = dict([('python','guido')])

    	print('In func() after modification')

    	print('{0} : {1}'.format(astr,id(astr)))
    	print('{0} : {1}'.format(alist,id(alist)))
    	print('{0} : {1}'.format(adict,id(adict)))
    	print()


    if __name__ == '__main__':
        l = [1,3,4]
	d = {}
    	s = 'a string'

    	print('Before func()')

    	print('{0} : {1}'.format(s,id(s)))
    	print('{0} : {1}'.format(l,id(l)))
    	print('{0} : {1}'.format(d,id(d)))

    	print()

	func(l,s,d)

    	print('After func()')

    	print('{0} : {1}'.format(s,id(l)))
    	print('{0} : {1}'.format(l,id(l)))
	print('{0} : {1}'.format(d,id(d)))
	print()


When you run the above program, you will see four "sets" of outputs:
`Before func()`, `In func() before modification`,  `In func() after
modification` and `After func()`. Let us first concentrate on the
first two sets of (sample) output ::

    Before func()
    a string : 140310113870784
    [1, 3, 4] : 140310113732800
    {} : 32276144

    In func() before modification
    a string : 140310113870784
    [1, 3, 4] : 140310113732800
    {} : 32276144


This is a confirmation that the bindings to the actual objects have
been passed to ``func()``.

Next, we make changes to all the three data objects. We `rebind` the
identifier ``astr`` to a new string (which effectively creates a new
string object), append an item to ``alist`` and rebind ``adict`` to a
new dictionary (which also creates a new dictionary object). This is
illustrated in the output of the next set ::

    In func() after modification
    b string : 140310113870448
    [1, 3, 4, 'func'] : 140310113732800
    {'python': 'guido'} : 32245584

As you can see, the identifiers of the string and the dictionary are
now different - as expected. The identifier of the list remains the
same, even though a new item is now present in the list.

The final set of output shows the values of the three objects after
returning from ``func()`` ::

    After func()
    a string : 140310113732800
    [1, 3, 4, 'func'] : 140310113732800
    {} : 32276144

As you can see, the changes to the string and the dictionary haven't
been propagated back, whereas the list now contains the item that was
added in ``func()``. Couple of points to note here:

- For immutable data types, modification to the value is not possible
  by definition. If you want change to be propagated back, return the
  new value from the function (as we see later).

- In the called function, any changes to mutable data types will
  propagate back to the calling function, such as we saw with the
  ``list`` above. In the case of the dictionary, we did not `change`
  ``adict``, but we `rebound` it to a new dictionary. Hence, the
  change was not propagated back.

In the rest of this article, I will discuss a few recipes related to
working with passing data objects to functions and propagating the
changes back to the calling code.

Recipes
=======

In the first recipe, we want that the changes made to the mutable data
object should be propagated back. As you can guess, this is simple and
the `default` behavior.

Listing: mod_mut_parameter.py ::

    #!/usr/bin/env python

    """ Passing mutable data objects
    and returning a modified version.
    """

    from __future__ import print_function

    def func(alist):

        print('In func() before modification')
	print('{0} : {1}'.format(alist,id(alist)))
	print()

	astr = alist.append('new item')

    	print('In func() after modification')
    	print('{0} : {1}'.format(alist,id(alist)))
    	print()

    if __name__ == '__main__':
        l = [1,2,3]

	print('Before func()')

	print('{0} : {1}'.format(l,id(l)))
	print()

	# since l is a mutable object, any changes
	# are automatically propagated to all other bindings
	func(l)

	print('After func()')

	print('{0} : {1}'.format(l,id(l)))
	print()


Now, let's say that you don't want any change to the mutable data
object in ``func()`` to be propagated back to any other copy of that
object. Python's ``copy`` module comes into picture here. Using the
``copy()`` function of this module, you can create a real copy of a
data object with the same value as the original one, but is actually a
different memory object. The next listing demonstrates this.

Listing: nomod_mut_parameter.py ::

    #!/usr/bin/env python

    """ Passing mutable data objects
    so that the changes are not propagated
    """

    from __future__ import print_function
    import copy

    def func(alist):

        print('In func() before modification')
	print('{0} : {1}'.format(alist,id(alist)))
    	print()

	astr = alist.append('new item')

	print('In func() after modification')
    	print('{0} : {1}'.format(alist,id(alist)))
    	print()

    if __name__ == '__main__':
        l = [1,2,3]

	print('Before func()')

	print('{0} : {1}'.format(l,id(l)))
    	print()

	# since l is a mutable object, any changes
	# are automatically propagated to all other bindings
    	# hence, we create a *real* copy and send it
	func(copy.copy(l))

	print('After func()')

	print('{0} : {1}'.format(l,id(l)))
	print()


The output of the above listing (and comparing it to the earlier one)
shows the difference between the two ::

    Before func()
    [1, 2, 3] : 139700653598552

    In func() before modification
    [1, 2, 3] : 139700653651728

    In func() after modification
    [1, 2, 3, 'new item'] : 139700653651728

    After func()
    [1, 2, 3] : 139700653598552


The final recipe demonstrates how you can propagate changes to mutable
data objects using the ``return`` statement.

Listing: mod_immut_parameter.py ::

    #!/usr/bin/env python

    """ Passing immutable data objects
    and returning a modified version.
    """

    from __future__ import print_function

    def func(astr):

        print('In func() before modification')
    	print('{0} : {1}'.format(astr,id(astr)))
    	print()

    	astr = astr.replace('a','b')

    	print('In func() after modification')
    	print('{0} : {1}'.format(astr,id(astr)))
    	print()

    	# return the new string
    	return astr

    if __name__ == '__main__':
        s = str('a string')

	print('Before func()')

	print('{0} : {1}'.format(s,id(s)))
	print()

	# since s is an immutbale object, modifications 
	# are not possible without creating a new object
	# with the modified string
	# recieve the modified string back as the
	# return value
	s = func(s)

	print('After func()')
	
	print('{0} : {1}'.format(s,id(s)))
	print()

When else to use copy()?
========================

The ``copy`` module is useful in other situations where you want a
real copy of a data object instead of another binding to the same
object. The next listing demonstrates this.

Listing: when_copy.py ::

    #!/usr/bin/env python

    from __future__ import print_function
    import copy

    # Immutable object
    a = 1
    b = a

    # At this stage, a and b both are bound to 1.
    # This changes in the next step, since I am now changing the 
    # value of b and int is immutable.
    b = b**2+5

    print(a,b)
    print()

    # Mutable object
    alist = [1,2,3]
    blist = alist

    # At this stage, alist and blist both are bound to [1,2,3]
    # Since a list is mutable, and hence any change to blist is 
    # also reflected back in alist

    blist.append(4)

    print(alist,blist)

    # We need to rebind alist, since it has been modified 
    # in the append operation above
    alist = [1,2,3]

    # create a real copy
    blist = copy.copy(alist)

    # only blist is modified.
    blist.append(4)

    print(alist,blist)


When you run the above code, you should see the following output ::

    1 6
    
    [1, 2, 3, 4] [1, 2, 3, 4]
    [1, 2, 3] [1, 2, 3, 4]

The above example also illustrates another aspect of immutable data
objects. When an immutable data object has multiple bindings, changes
to the value of one binding is not propagated to other bindings, since
a new object is created with the new value. For example :: 

    >>> a=1
    >>> b=a
    >>> a is b
    True
    >>> a=5
    >>> a is b
    False
    >>> a
    5
    >>> b
    1

Thus we can loosely say that in case of immutable data objects, the
``=`` operation does indeed behave like a copy operation in a language
like C.

This is different from mutable data objects where the change in one
binding is propagated to all others ::

    >>> a=[]
    >>> b=a
    >>> c=a
    >>> a.append(1)
    >>> a
    [1]
    >>> b
    [1]
    >>> c
    [1]

Conclusion
==========

While writing the experimental code for this article and the article
itself, I taught myself an area of Python which often left me stumped.
I have certainly gained quite a bit of insight into mutable
and immutable data types and this will enable me to think a little
more about working with data objects during passing them to functions
and creating a copy to modify (such as in multiple threads).

In a next article, I plan to write on variables, data representation
and passing parameters to functions in C highlighting the differences
from Python.

.. _Python data model: http://docs.python.org/2/reference/datamodel.html#objects-values-and-types
.. _me: http://echorand.me
.. _@echorand: https://twitter.com/echorand
.. _here: https://github.com/amitsaha/notes/tree/master/data_python_c
..

Resources and References
========================

- `Strings and Immutability <http://stackoverflow.com/questions/2123925/when-does-python-allocate-new-memory-for-identical-strings>`_
- `copy module <http://docs.python.org/2/library/copy.html>`_
- `id() <http://docs.python.org/2/library/functions.html#id>`_
- `type() <http://docs.python.org/2/library/functions.html#type>`_

