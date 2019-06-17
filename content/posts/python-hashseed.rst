---
title:  PYTHONHASHSEED and your tests
date: 2015-11-19
categories:
-  Python
aliases:
- /pythonhashseed-and-your-tests.html
---

Recently at work, I wanted to test a string which was being created by the ``urllib.urlencode()`` function. My first attempt was simple - test my expected string with that being created by the function above using unittest's ``assertEquals()`` function. It passed all the times I ran the tests before I committed the code, but it started failing when the tests were ran as part of the deployment process. 

The input to the ``urllib.urlencode()`` function is a dictionary of key value pairs and hence the returned value can really be any of the arrangements of the key value pairs. So, for example ``{'key1':'value', 'key2':'value'}`` can result in the query string ``key1=value&key2=value`` or ``key2=value&key1=value``. We cannot know for sure and we shouldn't need to.

Thus, we cannot use ``self.assertEquals(urllib.urlencode({'key1':'value', {'key2':'value'}), 'key1=value&key2=value')`` without the possibility that it will fail eventually. The reason why we see such behaviour of course is that for dictionaries, the order in which the keys are stored is not deterministic - or known apriori. You can see this behaviour by explicitly setting the value of `PYTHONHASHSEED <https://docs.python.org/3.3/using/cmdline.html#envvar-PYTHONHASHSEED>`__ to different values.

So, how should we write such tests? Let's see one possible way which I will state as - **Instead of asserting the equality of entire objects, we should be testing for the presence of the expected constituent objects**. I demonstrate it via two similar examples: 

(Note that I have used the builtin ``assert`` statement to test here)

URL encoding via urllib.urlencode()
====================================

As our first example, let's consider the ``urllib.urlencode()`` function:

.. code::
  
   # Test for the role of PYTHONHASHSEED - urllib urlencode

  import urllib
  urlencode_input = {'param1': 'value', 'param2': 'value'}
  expected_query_string = 'param1=value&param2=value'

  # This will fail for *some* PYTHONHASHSEED
  def test_urlencode_1():
      assert urllib.urlencode(urlencode_input) == expected_query_string

  # This will not fail for *any* PYTHONHASHSEED
  def test_urlencode_2():
      query_string = urllib.urlencode(urlencode_input)
      assert 'param1=value' in query_string
      assert 'param2=value' in query_string


Run the above tests a few times each starting with a different value of ``PYTHONHASHEED`` (for. e.g on Linux/Mac OS X, ``PYTHONHASHSEED=<some integer> nosetests``) and you will be easily able to see that the first test will fail for some value, but the second test will always pass.

Joining strings from dictionaries
=================================

This is similar to the previous example. Assume a function below which basically concatenates multiple key value pairs to create the conditional part of a SQL ``WHERE`` clause:

.. code:: 

   def create_where_clause(conditions):
       where_clause = ''
       for k, v in conditions.iteritems():
           where_clause += '%s=%s AND ' % (k, v)
       # remove the last AND and a trailing space
       return where_clause[:-5]

Here are two ways of testing this function - the first will fail for some test run, where as the second will not:

.. code::

   # This will fail for *some* PYTHONHASHSEED
   def test_where_clause_1():

       where_clause = create_where_clause({'item1': 1, 'item2': 2})
       expected_where_clause = 'item1=1 AND item2=2'
       assert where_clause==expected_where_clause

   # This will not fail for *any* PYTHONHASHSEED
   def test_where_clause_2():

       where_clause = create_where_clause({'item1': 1, 'item2': 2})

       # Deconstruct the string returned into individual conditions
       conditions = [cond.strip() for cond in where_clause.split('AND')]
       assert 'item1=1' in conditions
       assert 'item2=2' in conditions

If you run the above tests with different ``PYTHONHASHSEED`` values, you will notice similar behaviour to the previous example.

If you are using `tox <https://testrun.org/tox/latest/example/basic.html#special-handling-of-pythonhashseed>`__ to run your tests, it automatically sets ``PYTHONHASHSEED`` to a random integer when it is invoked. Hence, if you have never had your tests fail so far, there is a good chance your tests do not make any assumptions of order when dealing with Python dictionaries - but that of course is no guarantee that your tests are completely free since there may be this particular random number that has not been tried yet! So, ideally you may just want to do run your tests (especially if they don't take long) for a large number of PYTHONHASHSEED values just to be more confident.

