---
title:  tempfile.NamedTemporaryFile() in Python
date: 2016-01-20
categories:
-  Python
aliases:
- /tempfilenamedtemporaryfile-in-python.html
---

In Python, when you need to create a temporary file with a filename
associated to it on disk, `NamedTemporaryFile
<https://docs.python.org/2/library/tempfile.html#tempfile.TemporaryFile>`__
function in the ``tempfile`` module is the goto function. Here are some use
cases that I think one might use it for.

*Case #1: You simply need a named empty temporary file*

You just want a file object (pointing to an *empty* file) which has a
filename associated to it and hence you cannot use a `StringIO
<https://docs.python.org/2/library/stringio.html>`__ object:

.. code::

   from tempfile import NamedTemporaryFile
   f = NamedTemporaryFile()

   # use f
   ..


Once ``f`` is garbage collected, or closed explicitly, the file will automatically be
removed from disk.

*Case #2: You need a empty temporary file with a custom name*

You need a temporary file, but want to change the filename to
something you need:

.. code::

   from tempfile import NamedTemporaryFile
   f = NamedTemporaryFile()

   # Change the file name to something
   f.name = 'myfilename.myextension'

   # use f


Since you change the name of the file, this file will automatically
*not* be removed from disk when you close the file or the file object is
garbage collected. Hence, you will need to do so yourself:

.. code::


   from tempfile import NamedTemporaryFile
   f = NamedTemporaryFile()

   # Save original name (the "name" actually is the absolute path)
   original_path = f.name

   # Change the file name to something
   f.name = 'myfilename.myextension'

   # use f

   ..

   # Remove the file
   os.unlink(original_path)
   assert not os.path.exists(original_path)


*Case #3: You need a temporary file, write some contents, read from it later*

This use case is where you need a temporary file, but you want to work
with it like a "normal" file on disk - write something to it and
later, read it from it. In other words, you just want to control when
the file gets removed from disk.


.. code::


   from tempfile import NamedTemporaryFile
   # When delete=False is specified, this file will not be
   # removed from disk automatically upon close/garbage collection
   f = NamedTemporaryFile(delete=False)

   # Save the file path
   path = f.name

   # Write something to it
   f.write('Some random data')

   # You can now close the file and later
   # open and read it again
   f.close()
   data = open(path).read()

   # do some work with the data

   # Or, make a seek(0) call on the file object and read from it
   # The file mode is by default "w+" which means, you can read from
   # and write to it.
   f.seek(0)
   data = f.read()

   # Close the file
   f.close()

   ..

   # Remove the file
   os.unlink(path)
   assert not os.path.exists(path)



By default ``delete`` is set to ``True`` when calling
``NamedTemporaryFile()``, and thus setting it to ``False`` gives more
control on when the file gets removed from disk.
