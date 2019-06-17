---
title:  Mock objects and non-existent attributes/methods in Python
date: 2016-01-11
categories:
-  Python
aliases:
- /mock-objects-and-non-existent-attributesmethods-in-python.html
---

*Updated*: Fixed typo in the last paragraph.

Today, I was curious to see this behavior of ``Mock()`` objects when using `mock <https://github.com/testing-cabal/mock>`__:

.. code::

  >>> from mock import Mock
  >>> m = Mock()
  >>> m.i_dont_exist
  <Mock name='mock.i_dont_exist' id='139841609578768'>
  >>> m.i_dont_exist()
  <Mock name='mock.i_dont_exist()' id='139841609106896'>
  
The above is expected, since I have not declared a spec when creating the ``Mock()`` object, so even when you call a non-existent method or get/set a non-existent attribute, you will not get a ``AttributeError``. 

However, I was suprised by the following:

.. code::
  
  >>> m.assert_not_calledd
  Traceback (most recent call last):
   File "<stdin>", line 1, in <module>
  File "/home/asaha/.local/share/virtualenvs/606fc8723c1a01b/lib/python2.7/site-packages/mock/mock.py", line 721, in _    _getattr__
     raise AttributeError(name)
   AttributeError: assert_not_calledd
   
And the following as well:

.. code::

  >>> m.assert_foo
  Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "/home/asaha/.local/share/virtualenvs/606fc8723c1a01b/lib/python2.7/site-packages/mock/mock.py", line 721, in __getattr__
    raise AttributeError(name)
    AttributeError: assert_foo

I guessed that there is likely a check explicitly for **non-existent
attributes** starting with ``assert``, and if it finds so, it will
raise a ``AttributeError``.  If you look at the `__getattr__
<https://github.com/testing-cabal/mock/blob/master/mock/mock.py#L708>`__
method in ``mock.py``, you will see that this is pretty much what is
happening. The exact lines are below: 

.. code::
    
    if not self._mock_unsafe: # self._mock_unsafe is by default False 
        if name.startswith(('assert', 'assret')): # It comes here and an AttributeError is raised
            raise AttributeError(name)

This is certainly a good thing, since I have often seen
`assert_called_once
<http://engineeringblog.yelp.com/2015/02/assert_called_once-threat-or-menace.html>`__
in codebases, and is fairly easy to overlook.
