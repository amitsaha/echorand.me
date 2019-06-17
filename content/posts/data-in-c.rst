---
title:  Data in C
date: 2018-01-26
categories:
-  C
aliases:
- /data-in-c.html
---

In C, the data you use in your programs will usually fall into one of the three
basic categories: ``int``, ``char`` and ``float``. Data in C has no
existence without an associated memory location labeled by an
``identifier``, usually referred to as a `variable` (the term variable
is a bit misleading, since it essentially means that it must always
vary, but you can have `constant variables` - i.e. variables whose
values do not vary). Considering this and C's requirement for `static
typing`, a `variable declaration` statement is required before data
can be stored in a variable. This declaration statement usually takes the
form of ``data-type var-name [= value]``, where the `=value` part may
or may not be present. For example, the statement ``int a=1;``
declares a variable ``a`` which will store integer data and stores
``1`` in it. What this statment basically tells the C compiler is
that it should allocate a block of memory large enough to store an
integer and it will referred to as ``a``. It is possible to obtain the
address of this memory location using the ``&`` operator.


Listing: address.c ::

    #include <stdio.h>
    int main(int argc, char **argv)
    {
        int a=1;

	printf("Address of a:: %p, Data in a:: %d\n", &a, a);

	return 0;
    }

When you compile and run the above program, you should see an output
similar to the following:
::

    Address of a:: 0x7fff0cadd1ac, Data in a:: 1


You should note that the exact value of this address is immaterial
for us and it will definitely be different for you. Once you have this
address, it is possibly to refer to this memory location without using
the variable, `a`, by making use of the `dereferencing` operator,
``*``.

Listing dereferencing.c ::

    #include <stdio.h>

    int main(int argc, char **argv)
    {
        int a=1;
    	int *ptr;
    
        printf("Address of a:: %p, Data in a:: %d\n", &a, a);

    	ptr = &a;
	*ptr = 2;

	printf("Address of a:: %p, Data in a:: %d\n", ptr, a);
    	
        return 0;
    }


When you compile and execute the above program,  you will see an
output similar to the following::

    Address of a:: 0x7fff85a7f134, Data in a:: 1
    Address of a:: 0x7fff85a7f134, Data in a:: 2

In the above program, we store the address of the variable ``a`` in
the variable ``ptr`` (declared as an integer pointer variable) in the
statement ``ptr=&a``. Next, we use the dereferencing operator to change
the integer stored at memory location to ``2``. Now, when we retrieve
the data stored at ``a``, we get back the new integer.

Pointers are variables themselves and hence you could use the
``&`` and ``*`` operators on them as well. For the purpose of this
article, we will just be needing pointers to non-pointer
variables.

Assignment
==========

The declaration statement ``int a=1`` also includes an optional
`assignment` operation. It is not mandatory to assign a value while
declaring a variable. Thus, the above statement can be broken down to
two statements::

    int a;
    a=1;

The second statement is an assignment statement and the ``=`` is known
as the assignment operator. In C's terminology, the term on the left
hand side is called the `lvalue` and the term on the right hand-side
is called the `rvalue`. The `lvalue` must itself be a memory location
or an identifier identifying a valid memory location and must be
capable of storing new data. Thus, a variable initially declared
as a ``const`` cannot be used as a `lvalue`. The `rvalue` should
itself be data of the same type as the `lvalue` or an `expression` which
evaluates to it. (I hope to discuss `lvalue` and `rvalue` will be
discussed in a later article.)

The main point to note here is that assignment is simply the copying
of data on the right hand side into the memory location pointed to by
the left hand side (either using a variable name or using the direct
memory location  by using the dereferencing operator). You can use the
assignment operator on variables which store numbers and single
characters. For arrays, except during declaration, you have to use
specialized functions (in case of strings) or assign each a value to
each element individually.

The next code listing illustrates assignment operation and presents a
few other related ideas.

Listing: mut_data.c 
::

    /* Variables are by default mutable.

       Two variables occupy different locations in memory even if
       they may be storing the same data.

    */
    # include <stdio.h>

    int a = 1;

    int main(int argc, char **argv)
    {
        int b;

        /*Copy the value stored in a to b*/
	b = a;

	/* A no-op operation*/
	2;

	/* The & operator expects an 'lvalue' as an operand, and hence
	the following statement will result in a compilation error. 
	*/
	/*printf("Address of 2 %p\n", &2);*/

	printf("Address of a: %p, Address of b: %p\n", &a, &b);
	printf("a = %d b = %d \n",a,b);

	/* Change value stored in the memory location identified as a.
	*/
	a = 2;

	printf("Address of a: %p, Address of b: %p\n", &a, &b);
	printf("a = %d b = %d \n",a,b);

	return 0;
    }

In the above program, we declare ``a`` as an integer variable and
store the integer ``1`` in it. Next, we declare another integer
variable ``b`` and assign it to ``a`` in a separate statement. As
mentioned earlier, what this operation does is simply copy the
contents of ``a`` into ``b``. The data stored in ``a`` and ``b`` is
now ``1``. The next statement in our program is ``2;`` - is a valid
primary expression, but since the `result` of this evaluation is not
being stored, there is no way you are going to be able to refer to
this particular ``2`` anywhere else in this program. Hence an attemp
to retrieve the `address` of this particular ``2`` will result in
compilation errors, because only lvalues have addresses. Next, we
print the addresses of the variables ``a`` and ``b``. As expected,
each has a different address in memory, even though they have the same
memory contents. Sample output:

::

    Address of a: 0x601034, Address of b: 0x7fffb3a8565c
    a = 1 b = 1 

Next, we change the value stored in ``a`` to ``2`` which is visible in
the next part of the output:

::

    Address of a: 0x601034, Address of b: 0x7fffb3a8565c
    a = 2 b = 1

The above output establishes that even though, ``b`` was originally a
copy of ``a`` (storing the same data), in case of any changes to the
"original" variable, any of its copies do not see the changes. Each of
these variables are completely isolated from each other. With this
idea, we proceed to discuss the semantics of `call by value` and `call
by reference` while passing data as function parameters. However,
before we can discuss this, we will learn about the `base address` of
an array.

Base address of an array
========================

An array (say, declared as ``int a[10]``) is an instruction to the
compiler that a block of memory for storing 10 integers should be
allocated and identified by ``a``, with individual items being
addressed as ``a[0], a[1]...a[9]`` (and ``0,1,..`` known as the
indices). The operation, ``&a[0]`` returns the address of the first
element of this array.

Now, what does the compiler understand when we simply ask it do
something like this ``printf("%d", *a)``? In case of an array
variable, when we use only the variable name (without an index), it
refers to the address of the the element, ``a[0]``. That is,
``&a[0]``. Thus ``printf("%d", *a)`` is actually ``printf("%d",
*(&a[0]))``. We will refer to the address of the first element of an
array as its `base address` to aid the rest of the discussion.


Function parameters
===================

Consider the next listing: nomod_parameter.c:

::

    # include <string.h>
    # include <stdio.h>

    void func(int a, char string1[], char string2[])
    {

        char string3[15];

	/* Create a copy of string2 in string3*/
	strcpy(string3, string2);

	printf("Before modification in func()\n");
	printf("Address of a: %p \n", &a);
	printf("Address of string1: %p \n", &string1[0]);
	printf("Address of string2: %p \n", &string2[0]);
	printf("Address of string3: %p \n", &string3[0]);

	printf("a = %d \nstring1 = %s \nstring2 = %s\n",a, string1,
	string3);

	/* Make modifications */
	a = a+1;
	string1[0] = string1[0] + 5;
	string3[0] = string3[0] + 5;

	printf("After modification in func()\n");

	printf("Address of a: %p \n", &a);
	printf("Address of string1: %p \n", &string1[0]);
	printf("Address of string2: %p \n", &string2[0]);
	printf("Address of string3: %p \n", &string3[0]);

	printf("a = %d \nstring1 = %s \nstring2 = %s\n",a, string1,
	string3);

	return;
    }

    int main(int argc, char **argv)
    {

        int a = 5;
	char string1[] = "A String";
	char string2[] = "B String";

	printf("Before call to func()\n");

	printf("Address of a: %p \n", &a);
	printf("Address of string1: %p \n", &string1[0]);
	printf("Address of string2: %p \n", &string2[0]);

	printf("a = %d \nstring1 = %s \nstring2 = %s\n",a, string1,
	string2);

	func(a, string1, string2);

	printf("After call to func()\n");

	printf("Address of a: %p \n", &a);
	printf("Address of string1: %p \n", &string1[0]);
	printf("Address of string2: %p \n", &string2[0]);

	printf("a = %d \nstring1 = %s \nstring2 = %s\n",a, string1,
	string2);
	
	return 0;
    }


In the ``main()`` function, we declare an integer variable, ``a`` and
two character arrays (strings), ``string1`` and ``string2``. When you
compile and run this program, you will see four "sets" of output:
`Before call to func()`, `Before modification in func()`, `After
modification in func()` and `After call to func()`. First, I will
discuss the first two sets:

::
 
    Before call to func()
    Address of a: 0x7fff6549ad7c 
    Address of string1: 0x7fff6549ad70 
    Address of string2: 0x7fff6549ad60 
    a = 5 
    string1 = A String 
    string2 = B String

    Before modification in func()
    Address of a: 0x7fff6549ad2c 
    Address of string1: 0x7fff6549ad70 
    Address of string2: 0x7fff6549ad60 
    Address of string3: 0x7fff6549ad30 
    a = 5 
    string1 = A String 
    string2 = B String


The key thing to note in the above output is the addresses of the
three variables. (We discuss ``string3`` a little later on, so ignore
it for now).

You can see that the address of ``a`` is different in
``main()`` and in ``func()`` functions. This is because, the function
``func()`` is creating a new variable ``a`` to store the value being
passed to it from the ``main()`` function (it is immaterial that we
are using the same variable name in both the same functions - each of
these variables are local variables, having no existence beyond the
functions themselves). This is what is referred to as `call by
value` - a copy of the value in a variable is passed from the calling
function to the called function.

The addresses of the two character array variables are however the
same in both the functions. This automatically follows from the
discussion on `base address of an array`. When the function ``func()``
is called from ``main()``, passing the array variables, ``string1``
and ``string2`` mean that we are passing the base address of each
these arrays to the function, ``func()``. Hence, the two variables
``string1`` and ``string2`` in ``func()``, actually refer to the same
memory location as ``string1`` and ``string2`` in ``main()`` (Once
again, the same variable names is irrelevant). 

Now, we consider the next set of output:

::

    After modification in func()
    Address of a: 0x7fff6549ad2c 
    Address of string1: 0x7fff6549ad70 
    Address of string2: 0x7fff6549ad60 
    Address of string3: 0x7fff6549ad30 
    a = 6 
    string1 = F String 
    string2 = G String

We make some changes to the data stored in each of the three variables and
this is reflected in their changed values. 


Finally, consider the last set of output:
::

    After call to func()
    Address of a: 0x7fff6549ad7c 
    Address of string1: 0x7fff6549ad70 
    Address of string2: 0x7fff6549ad60 
    a = 5 
    string1 = F String 
    string2 = B String

In the ``main()`` function, the data stored in ``a`` is the same as
it was before the call to ``func()``, the data stored in ``string1``
is same as after the modification in ``func()`` and that of
``string2``, the same as it was before calling ``func()``.

From the first set of output, we know that the variable ``a`` in
``func()`` was a separate variable from the ``a`` in ``main()`` and
thus any changes made to the data stored in former will not be
reflected in the latter. From the same set of output, we also know
that ``string1`` in ``func()`` pointed to the same ``string1`` in
``main()`` and hence any changes made to it is reflected in the
latter. So, what's happening with ``string2()``? The reasoning about
``string1`` should also apply to ``string2``, and it does. However,
the difference in the output is due to the statement:
``strcpy(string3, string2)`` in ``func()``. In this statement, we are creating a
copy of the data in ``string2`` and storing it in a new variable
``string3``. Since ``string3`` is a new variable (as demonstrated by
the different address) as seen in the above sets of output, any
changes to the value of ``string3`` is not reflected in
``string2``. In fact, you may call this as cheating when I printed the
data in ``string3`` and as that in ``string2``. I did this to
demonstrate a use case where you may need to change the value of an
array parameter without changing the original array. 

This form of calling a function where the addresses (or references) to
the parameters are sent from the calling function to the called
function is referred to as `call by reference`. Thus, we can conclude
that when arrays are passed, it is by default a `call by reference`,
where as for data types such as ``int``, ``char`` and ``value``, it is
`call by value`. 


Explicit call by reference
~~~~~~~~~~~~~~~~~~~~~~~~~~

As we have seen, we get `call by reference` for free in the case of
arrays. How do accomplish this for `int`, for example? The key is to
pass the address of the variable from the calling function to the
called function. The next code listing demonstrates this.

::

    # include <string.h>
    # include <stdio.h>

    void func(int *a, char *string)
    {

        printf("In func()\n");

	printf("Address of a: %p \n", a);
  	printf("Address of string: %p \n", &string[0]);

  	printf("a = %d string = %s\n\n",*a, string);

	/* Make modifications */
	*a = *a+1;
	string[0] = string[0] + 5;

	printf("After modification in func()\n");
	printf("a = %d string = %s\n\n",*a, string);

	return;
    }
	
    int main(int argc, char **argv)
    {
	
	int a = 5;
	char string[] = "A String";

	printf("In main() before func()\n");

	printf("Address of a: %p \n", &a);
	printf("Address of string: %p \n", &string[0]);

	printf("a = %d string = %s\n\n",a, string);

	func(&a, string);

	printf("In main() after func()\n");

	printf("a = %d string = %s\n\n",a, string);
	return 0;
    }


When you compile and execute the above program, you will see an output
similar to the following :
::

    In main() before func()
    Address of a: 0x7fff22e7c25c 
    Address of string: 0x7fff22e7c250 
    a = 5 string = A String

    In func()
    Address of a: 0x7fff22e7c25c 
    Address of string: 0x7fff22e7c250 
    a = 5 string = A String

    After modification in func()
    a = 6 string = F String

    In main() after func()
    a = 6 string = F String

As the output shows, the pointer variable ``a`` in ``fun()`` stores
the location of the variable ``a`` in ``main()``. Hence, any changes
to the data stored at that location in ``func()`` is reflected back in
the ``main()`` function.

Call by value for an array
~~~~~~~~~~~~~~~~~~~~~~~~~~

We have now understood that arrays are by default `call by
reference`. In the earlier program, we created an explicit copy of the 
string to prevent modifications to the `original` copy of the
string. This strategy can also be followed for non-char arrays, such
as an integer array where you can create a new array with the contents
of the array being passed from another function.

However, a well-known generic strategy to accomplish this from the `calling`
function itself is to make the array variable a member of a `structure`
and then passing this structure member to the called function. The
following code listing shows this.

Listing: call_value_array.c

::

    # include <string.h>
    # include <stdio.h>

    struct string_wrapper{
      char string[10];
    };

    void func(char string[])
    {
  
        /* Make modifications */
	string[0] = string[0] + 5;
    	printf("String: %s\n", string);

    	return;
    }

    int main(int argc, char **argv)
    {
        struct string_wrapper string;

	char astring[] = "A String";
  	strcpy(string.string, astring);

	printf("String: %s\n", astring);

	func(string.string);

	printf("String: %s\n", astring);
	
	return 0;
    }


In the above code listing, we first define a structure
``string_wrapper`` with a character array as a member. This is because
we plan to use this structure to wrap a string. If we wanted to use
this for wrapping an integer array, we would have an integer array as
the structure member. In the ``main()`` function, we copy the data in
string variable ``astring`` to the structure member, ``string`` using
``strcpy()``. Next, we call ``func()`` using this structure member
instead of the string variable. This allows us to pass the data in
``astring``, instead of the variable itself. 

When you compile and execute the above program, you should see the
following output:

::

    String: A String
    String: F String
    String: A String



Immutable data
==============

If you want to enforce the restriction that the data stored in one or
more of your variables shouldn't be changed from what was assigned
during `declaration` of the variable, use the ``const`` keyword during
declaring the variable. For example, ``const int a=1`` declares an
integer variable ``a`` and stores ``1`` in it. If you attempt to make
any changes to it in the rest of the ``main()`` function, your
compiler will not compile your program, telling you that this is not
allowed. It is important to note that you have to store the data
during declaration itself. The next code listing demonstrates this.

Listing: immut_data.c
::

    # include <stdio.h>

    int main(int argc, char **argv)
    {
        int a = 1;
	const int b = a;

	/* This is not allowed as well
       const c;
       c=1;
       */

      /* Even though this is the same value as already stored in a,
         this is not known to the compiler at compile time. Hence, the
         following statement will result in a compile time error*/
      /*b = a;*/

      printf("Address of a: %p, Address of b: %p\n", &a, &b);
      printf("a = %d b = %d \n",a,b);

      return 0;
    }


Conclusion
==========

In this article, we have taken a look at the basics of how data in C
has no identity if not stored in memory locations identified by
identifiers. We also learnt about `call by value` and `call by
reference` and how different data types behave differently when passed
as function parameters.

If you are familiar with Python, you may be interested in my article
on `data in CPython <http://echorand.me/data-in-cpython.html>`__. In my next article, I will summarize these two
articles highlighting the differences between the two. 
