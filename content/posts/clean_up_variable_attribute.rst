---
title:  Resource Acquisition Is Initialization (RAII) in C
date: 2018-01-26
categories:
-  C
aliases:
- /resource-acquisition-is-initialization-raii-in-c.html
---


GCC's C compiler allows you to define various `variable attributes
<http://gcc.gnu.org/onlinedocs/gcc/Variable-Attributes.html>`__. One
of them is the ``cleanup`` attribute (which you can also write as
``__cleanup__``) which allows you to define a function to be called when
the variable goes out of scope (for example, before returning from a
function). This is useful, for example to never forget to close a file
or freeing the memory you may have allocated. Next up is a demo
example defining this attribute on an integer variable (which
obviously has no practical value). I am using `gcc (GCC) 4.7.2
20121109` on Fedora 22.

Demo
====

The next code listing declares an integer variable, ``avar`` with the
``cleanup`` attribute set such that the function ``clean_up`` is
called before ``main()`` returns::


     # include <stdio.h>
     void clean_up(int *final_value)
     {
         printf("Cleaning up\n");
         printf("Final value: %d\n",*final_value);
     }

      int main(int argc, char **argv)
      {
          /* declare cleanup attribute along with initiliazation
          Without the cleanup attribute, this is equivalent
          to:int avar = 1;
          */
          int avar __attribute__ ((__cleanup__(clean_up))) = 1;
          avar = 5;
          return 0;
      }

The ``clean_up`` function above accepts an argument which is an
integer pointer. This is a pointer to the integer variable ``avar``
for which this function is called due to the ``__cleanup__`` attribute
being set. When you compile and execute the program, you should see
the following output::

    $ gcc -Wall cleanup_attribute_demo.c 
    $ ./a.out 
    Cleaning up
    Final value: 5

Next, I will present a hopefully more useful example. 

Cleaning up temporary files
===========================

In your programs, you may need to create one or more temporary files
for some reason. Most likely, you would want to remove them after your
program exits. Defining a ``__cleanup__`` attribute on the ``FILE *`` variable
(assuming stream I/O) and setting it to an appopriate cleanup function
sounds like something which could be put to good use. We don't have to
manually call the cleanup function.

Here is the program::


  /* Defines two cleanup functions to close and delete a temporary file
   and free a buffer
   */

   # include <stdlib.h>
   # include <stdio.h>

   # define TMP_FILE "/tmp/tmp.file"

   void free_buffer(char **buffer)
   {
     printf("Freeing buffer\n");
     free(*buffer);
   }

   void cleanup_file(FILE **fp)
   {
     printf("Closing file\n");
     fclose(*fp);

     printf("Deleting the file\n");
     remove(TMP_FILE);
   }

   int main(int argc, char **argv)
   {
     char *buffer __attribute__ ((__cleanup__(free_buffer))) = malloc(20);
     FILE *fp __attribute__ ((__cleanup__(cleanup_file)));

     fp = fopen(TMP_FILE, "w+");
     if (fp != NULL)
       fprintf(fp, "%s", "Alinewithnospaces");

    fflush(fp);
    fseek(fp, 0L, SEEK_SET);
    fscanf(fp, "%s", buffer);
    printf("%s\n", buffer);
    return 0;
    }

The above program creates a temporary file in the location specified
by ``TMP_FILE``, writes a line of text with no spaces, resets the file
pointer to the beginning and reads it back. In line no.32, I declare a
variable ``fp`` of type ``FILE*`` and define the ``__cleanup__``
attribute such that the function ``cleanup__file`` will be called upon
the return of the ``main()`` function. This function closes the file
and also deletes it from the file system. When you run your program,
you should see the following output::

    Alinewithnospaces
    Closing file
    Deleting the file
    Freeing buffer

If you check the existence of the file specified by ``TMP_FILE``, you
will see that it doesn't exist. Note how I also use define the
``__cleanup__`` attribute on the variable, ``buffer`` to automatically
free memory as well.


Resources
=========

- `Wikipedia entry on RAII <https://en.wikipedia.org/wiki/Resource_Acquisition_Is_Initialization>`__
