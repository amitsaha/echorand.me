---
title:  Replacing boto S3 mocks using moto in Python
date: 2016-01-25
categories:
-  Python
aliases:
- /replacing-boto-s3-mocks-using-moto-in-python.html
---

Let's say you have some Python application code which connects to Amazon S3 which
retrieves the keys in a bucket. Very likely, the application would be
using `boto <http://boto.cloudhackers.com/en/latest/s3_tut.html>`__
and the code would like this:

.. code::

   import boto

   def get_s3_conn():
       return boto.connect_s3('<aws-access-key', '<aws-secret-key>')

   def list_keys():
       s3_conn = get_s3_conn()
       b = s3_conn.get_bucket('bucket_name')
       keys = b.list()
       return keys

The corresponding test would presumably use some `mocks and patching
<mock.readthedocs.org>`__. Here is one way to write a test for the
above code:

.. code::

   # Assume the code above is in a module list_keys
   # in a function list_keys

   from list_keys import list_keys

   from mock import patch, Mock

   def test_list_keys():
      mocked_keys = [Mock(key='mykey1'), Mock(key='key2')]
      mocked_connection = Mock()
      # Start with patching connect_s3
      with patch('boto.connect_s3', Mock(return_value=mocked_connection)):
          mocked_bucket = Mock()
          # Mock get_bucket() call
          mocked_connection.get_bucket = Mock(return_value=mocked_bucket)
          # Mock the list() call to return the keys you want
          mocked_bucket.list = Mock(return_value=mocked_keys)
          keys = list_keys()

          assert keys == mocked_keys

I thought I really had no other way to get around mocks and patches if
I wanted to test this part of my application. But, I discovered `moto
<https://github.com/spulec/moto>`__. Then life became easier.

Using moto's S3 support, I don't need to worry about the mocking and
patching the boto calls any more. Here is the same test above, but
using moto:

.. code::

   from list_keys import get_s3_conn, list_keys
   from moto import mock_s3

   def test_list_keys():

       expected_keys = ['key1', 'key2']

       moto = mock_s3()
       # We enter "moto" mode using this
       moto.start()

       # Get the connection object
       conn = get_s3_conn()

       # Set up S3 as we expect it to be
       conn.create_bucket('bucket_name')
       for name in expected_keys:
           k = conn.get_bucket('bucket_name').new_key(name)
           k.set_contents_from_string('abcdedsd')

       # Now call the actual function
       keys = list_keys()
       assert expected_keys == [k.name for k in keys]

       # get out of moto mode
       moto.stop()


Unless it is obvious, here are two major differences from the previous
test:

*We don't mock or patch anything*

The point #1 above is the direct reason I would consider using moto
for testing S3 interactions rather than setting up mocks. This helps us in
the scenario in which this section of the code lies in another
package, not the one you are writing tests for currently. You can
actually call this section of the code and let the interaction with S3
happen as if it were interacting directly with Amazon S3. I think this
allows deeper penetration of your tests and as a result your code's
interactions with others.

*The test code has to explicitly first setup the expected state*

This may seem like more work, but I think it still outweighs the
benefits as mentioned previously.

Please checkout `moto <https://github.com/spulec/moto>`__ here.

If you like this post, please follow `PythonTestTips
<https://twitter.com/PythonTestTips>`__ on Twitter.
