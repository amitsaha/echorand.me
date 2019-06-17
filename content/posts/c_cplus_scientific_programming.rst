---
title:  C/C++ Scientific Programming Libraries and Tools
date: 2018-01-26
categories:
-  C
aliases:
- /cc-scientific-programming-libraries-and-tools.html
---


``math.h`` provides basic mathematical functions as part of the `C` standard library and are also usable from `C++`. However, it needs
to be supplemented with custom libraries when advanced numerical functionalities are desired. In this article, we shall take
a look at two such libraries - the GNU Scientific Library and Blitz++. In the last section of this article, we take a look
at `Ch` - a C/C++ interpreter which combines the power of C/C++ with the ease of use of an interpreter. Since we look at three
different topics - we shall be discussing the very basics of each in a hands-on fashion stressing on examples to illustrate
the features. For C/C++, we will use ``gcc`` and ``g++`` compilers respectively, on Linux.

GNU Scientific Library
======================

The `GNU Scientific Library <http://www.gnu.org/software/gsl)>`__ (GSL) is perhaps the most well-developed library for scientific computing in C/C++. It has routines
for working with vectors and matrices, support for complex numbers, calculus, interpolation, statistics, random numbers generation
and host of others. The easiest way to install the library will be via your Linux distribution's package manager. Let us now 
get started with using the library.

GSL's basic mathematical functions defines the common mathematical constants such as :math:`\pi, e`, euler's constant and provides
functions and macros for working with Infinities and Not-a-number, testing the sign of numbers and miscellaneous 
other numbers. One of the more interesting functions is the ``gsl_fcmp(double x, double y, double epsilon)`` function which is used to approximately compare
two floating point numbers, :math:`x` and :math:`y`, accounting for rounding off and truncation errors - specified by epsilon. Now, we move onto
learn about the major functionalities provided by GSL.

Our first program will demonstrate the usage of vectors in GSL (Listing 1).

::

    /*Listing-1: gsl_vector.c*/

    /* Simple demo of the vector support in GSL
     *  Also uses the random number generation feature
    */

    #include <stdio.h>
    #include <gsl/gsl_vector.h> /*For Vectors*/
    #include <gsl/gsl_rng.h> /* For Random numbers*/
     
    int main ()
    {
        int i,n;
	/* Setup the Random number generator*/
	const gsl_rng_type * T;
	gsl_rng * r;
	gsl_rng_env_setup();
	T = gsl_rng_default;
	r = gsl_rng_alloc (T);     
       
        printf("Number of elements in the vector:: ");
	scanf("%d",&n);
  
       /* Allocate the vector of the specified size*/
       gsl_vector * v = gsl_vector_alloc (n);

       /* Set the elements to a uniform random number in [0,1]*/
       for (i = 0; i < n; i++)
       {
           gsl_vector_set (v, i, gsl_rng_uniform (r));
       }
       
       /* Print the vector*/
       for (i = 0; i < n; i++)
       {
           printf ("v_%d = %g\n", i, gsl_vector_get (v, i));
       }
     
     gsl_vector_free (v);

     return 0;
    }


The code in listing 1 allocates a vector of the size specified by the user using the function ``gsl_vector_alloc()``, which
returns a pointer of gsl_vector type. Note that the default data type for the vector is a double. You can have a vector
of any of the basic `data-types <http://www.gnu.org/software/gsl/manual/html_node/Data-types.html>`_. Next, we assign
elements to this vector by using the function ``gsl_vector_set(v, i, gsl_rng_uniform(r))``, where ``v`` is the vector which we are assigning elements to,
``i`` is the position and ``gsl_uniform_random(r)`` returns a double which is assigned to the this element of the vector. 
Next, we retrieve the elements of this vector element-wise by using the ``gsl_vector_get()`` function, and finally free the
memory occupied by this vector using the ``gsl_vector_free()`` function. To compile this program, you will need to link
the GSL library (like so, ``gcc gsl_vector.c -lgsl``). You may now execute the program and you will see it asks
for the number of elements in the vector and then print out the assigned vector.

You can copy one vector to another, swap the elements, add/subtract/multiple/divide two vectors, scale them and other operations.
The next program (Listing 2) demonstrates couple of these operations.

::

    /*Listing-2: gsl_vector_ops.c*/

    /* Vector operations in GSL
     * Also uses the random number generation feature
    */

    # include <stdio.h>
    # include <gsl/gsl_vector.h> /*For Vectors*/
    # include <gsl/gsl_rng.h> /* For Random numbers*/
     
    int main ()
    {
        int i,n;

      	/* Setup the Random number generator*/
	const gsl_rng_type * T;
	gsl_rng * r;
	gsl_rng_env_setup();
	T = gsl_rng_default;
	r = gsl_rng_alloc (T);     
	
	printf("Number of elements in the vector:: ");
	scanf("%d",&n);
	
	/* Allocate the vectors of the specified size*/
	gsl_vector * v1 = gsl_vector_alloc (n);
	gsl_vector * v2 = gsl_vector_alloc (n);

	/* Set the elements to a uniform random number in [0,1]*/
	for (i = 0; i < n; i++)
	{
	    gsl_vector_set (v1, i, gsl_rng_uniform (r));
      	    gsl_vector_set (v2, i, gsl_rng_uniform (r));
	}
       
        /* Print the vector*/
        printf("V1:: ");
        for (i = 0; i < n; i++)
        {
            printf ("%g ", gsl_vector_get (v1, i));
        }
      	printf("\n");

	printf("V2:: ");
      	for (i = 0; i < n; i++)
      	{
            printf ("%g ", gsl_vector_get (v2, i));
        }

        printf("\n\n");
        printf(">>> Vector Operations >>> \n\n");

        /* v1+v2 gets stored in v1*/
        gsl_vector_add(v1,v2);

        printf("V1+V2:: ");
        for (i = 0; i < n; i++)
        {
            printf ("%g ", gsl_vector_get (v1, i));
        }
        printf("\n");

        /* v1-v2 gets stored in v1*/
        gsl_vector_sub(v1,v2);

     	printf("V1-V2:: ");
     	for (i = 0; i < n; i++)
     	{
            printf ("%g ", gsl_vector_get(v1, i));
     	}
     	printf("\n");
  
        gsl_vector_free (v1);
     	gsl_vector_free (v2);
     
        return 0;
   }


On executing the above code, you should see an output similar to::

    Number of elements in the vector:: 5
    V1:: 0.999742 0.282618 0.231657 0.957477 0.540044 
    V2:: 0.16291 0.947201 0.484974 0.744305 0.739953 

    >>> Vector Operations >>> 

    V1+V2:: 1.16265 1.22982 0.71663 1.70178 1.28 
    V1-V2:: 0.999742 0.282618 0.231657 0.957477 0.540044 

GSL provides support for `two-dimensional matrices <http://www.gnu.org/software/gsl/manual/html_node/Matrices.html>`_ and has an interface similar
to the GSL vectors. Matrices provide the foundation for the GSL's `linear algebra` functions.

GSL's sorting functions provides facilities for sorting an array (C-style), a vector and finding the k smallest or largest functions.
Listing 3 demonstrates a simple usage for a couple of these.

::

    /*Listing-3: gsl_sort.c*/

    /* Demonstration of GSL's sorting functions
    * Also uses the random number generation feature
    */

    #include <stdio.h>
    #include <gsl/gsl_vector.h> /*For Vectors*/
    #include <gsl/gsl_rng.h> /* For Random numbers*/
     
    int main ()
    {
        int i,n;

      	/* Setup the Random number generator*/
	const gsl_rng_type * T;
	gsl_rng * r;
	gsl_rng_env_setup();
	T = gsl_rng_default;
	r = gsl_rng_alloc (T);     
	
  
	printf("Number of elements in the vector:: ");
	scanf("%d",&n);
	
	/* Allocate the vector of the specified size*/
	gsl_vector * v = gsl_vector_alloc (n);

	/* Set the elements to a uniform random number in [0,1]*/
	for (i = 0; i < n; i++)
	{
            gsl_vector_set (v, i, gsl_rng_uniform (r));
	}
	
	/* Print the vector*/
	printf("(Hopefully) Unsorted Vector:: ");
	for (i = 0; i < n; i++)
	{
	    printf ("%g ", gsl_vector_get (v, i));
	}

	printf("\n");

	/* Sort the vector*/
	gsl_sort_vector(v);

	/* Print the sorted vector*/
	printf("Sorted Vector::               ");
	for (i = 0; i < n; i++)
	{
            printf ("%g ", gsl_vector_get (v, i));
	}
	printf("\n");

	/* Allocate a large vector*/
	gsl_vector * v_large = gsl_vector_alloc (10000);
	
	/* Set the elements to a uniform random number in [0,1]*/
	for (i = 0; i < 10000; i++)
	{
            gsl_vector_set (v_large, i, gsl_rng_uniform (r));
	}
	
	/* Find the 10 largest numbers from the above vector*/
	double *largest = malloc(10*sizeof(double));
	gsl_sort_vector_largest (largest, 10, v_large);

	printf("\n\n10 largest numbers:: \n\n");
	
	/* Print the 10 largest*/
	for (i = 0; i < 10; i++)
	    printf("%g ",largest[i]);
	printf("\n\n");

  	gsl_vector_free (v);
  	free(largest);
	
	return 0;
    }

The ``gsl_sort_vector()`` function carries out an in-place sorting on the specified vector, and the ``gsl_sort_vector_largest()`` is used to find
the k largest numbers. In the above listing, a vector is initialized with ``10000`` random numbers and the top ``10`` is chosen using the latter function.
On execution of the above code, you should see an output similar to this::

    Number of elements in the vector:: 5
    (Hopefully) Unsorted Vector:: 0.999742 0.16291 0.282618 0.947201 0.231657 
    Sorted Vector::               0.16291 0.231657 0.282618 0.947201 0.999742 

    10 largest numbers:: 

    0.999979 0.999973 0.999927 0.999785 0.999723 0.999678 0.999525 0.999496 0.999481 0.999009


In your application, you might have a need for finding the original indices of the elements in sorted order - ``gsl_sort_vector_index()``
and the ``gsl_sort_largest_index()`` correspond to the two functions we used in Listing 3.

Next, we use GSL's function minimizing capabilities to find the minimum of a simple one-dimensional function: :math:`2x^2 + 4x`, which has a minimum
at ``x=-1`` (Listing 4) (This program has been built upon the example in the GSL documentation).

::

    /*Listing-4: gsl_fmin.c*/
    /* Demonstration of using the function minimizing features
    in GSL */

    #include <stdio.h>
    #include <gsl/gsl_errno.h>
    #include <gsl/gsl_math.h>
    #include <gsl/gsl_min.h>
     
    /* Function: 2x^2 + 4x having a minimum at x=-1*/
    double fn_1 (double x, void * params)
    {
        return 2*x*x + 4*x;
    }
     
    int main ()
    {
        int status;
	int iter = 0, max_iter = 100; /*Max. number of iterations*/
	const gsl_min_fminimizer_type *T;
	gsl_min_fminimizer *s;
	double m = 0.7; /* Starting point for the search*/
	double a = -4.0, b = 1.0; /* The interval in which the minimum lies*/
	gsl_function F;
	
	F.function = &fn_1; /* Function to Minimize*/
	F.params = 0;
	
	T = gsl_min_fminimizer_goldensection; /*Set the minimization algorithm - Uses Golden Section*/
	s = gsl_min_fminimizer_alloc (T); /* Initialize the minimizer*/
	gsl_min_fminimizer_set (s, &F, m, a, b); /*Set up the minimizer*/
	
	printf ("Using %s method\n", gsl_min_fminimizer_name (s));
	printf ("%5s [%9s, %9s] %9s \n","iter", "lower", "upper", "min", "err", "err(est)");
	printf ("%5d [%.7f, %.7f] %.7f \n",  iter, a, b, m);

	/* Set up the iterative minimization procedure*/
     
        do
     	{
      	    iter++;
      	    status = gsl_min_fminimizer_iterate(s);
     
	    m = gsl_min_fminimizer_x_minimum (s);
	    a = gsl_min_fminimizer_x_lower (s);
	    b = gsl_min_fminimizer_x_upper (s);
	    
	    status = gsl_min_test_interval (a, b, 0.001, 0.0);
	    
	    if (status == GSL_SUCCESS)
	    printf ("Converged:\n");
	    
	    printf ("%5d [%.7f, %.7f] %.7f\n",iter, a, b, m);
        } while (status == GSL_CONTINUE && iter < max_iter);
     
        gsl_min_fminimizer_free (s);
     
        return status;
    }

The three key statements in the above code is are::

    T = gsl_min_fminimizer_goldensection; /*Set the minimization algorithm - Uses Golden Section*/
    s = gsl_min_fminimizer_alloc (T); /* Initialize the minimizer*/
    gsl_min_fminimizer_set (s, &F, m, a, b); /*Set up the minimizer*/
  
The first statement sets the minimization algorithm, here we set to an
algorithm which is not known for fast convergence - the `Golden
Section algorithm
<http://www.gnu.org/software/gsl/manual/html_node/Minimization-Algorithms.html>`_. The
second statement initializes the minimizer and the third statement
specifies the function to minimize, F the initial point,m and the
search bounds - a and b. The next step is to set the iteration for the
minimization exercise using gsl_min_fminimizer_iterate() function. At
every iteration, the convergence of the procedure is tested using the
gsl_min_test_interval() function. The maximum number of iterations
here  is set to 100 via the max_iter variable. When you compile and
execute the above code, you should see that the minimization routine
progressively zooms in on the minimum of the function,
-1. Multi-dimensional minimization and root-finding routines are also available in GSL.

We end our discussion on GSL for the purpose of this article. The resources section at the end has references to the
extensive documentation which will help you explore the other advanced
capabilities of GSL.

A look at Blitz++
=================

`Blitz++ <http://www.oonumerics.org/blitz/>`__ is a C++ class library for scientific computing. The project page reports performance
on part with Fortran 77/90 and currently has support for arrays, vectors, matrices and random number generators. To install this
library, either use your distribution's package manager or you may
download the source from `here <http://sourceforge.net/projects/blitz/files>`__.

Let us now write our first program using Blitz++ where we learn about
using the Array class (Listing 5).
:: 

    /*Listing-5: array_demo.cc*/

    /* Simple demonstration of using Array 
    in Blitz++*/

    #include <blitz/array.h>

    using namespace blitz;

    int main()
    {

        cout << ">>>> 1-D Array Demonstration >>>>" << endl << endl;

  	Array<float,1> a(5);
	a=1,2,3,4,5;
	cout << "a = " << a <<endl << endl;

	Array<float,1> b(5);
	b=2,1,3,4,1;
	cout << "b = " << b <<endl << endl;

	cout << " >> Basic Arithmetic Operations >>" << endl << endl;

	Array<float,1> c(5);
	c = a+b;
	cout << "c = a+b = " << c <<endl << endl;

  	c = a*b;
  	cout << "c = a*b = " << c <<endl << endl;
  
	c = a/b;
	cout << "c = a/b = " << c <<endl << endl;

	cout << ">>>> 2-D Array Demonstration >>>>" << endl << endl;

	Array<float,2> A(3,3);
	A = 1, 2, 3,
	3, 5, 1,
	1, 1, 4;

	cout << "A = " << A << endl;

	Array<float,2> B(3,3);
	B = 1, 2, 3,
	3, 5, 1,
	1, 1, 4;

	cout << "B = " << B << endl; 

	cout << " >> Basic Arithmetic Operations >>" << endl << endl;

	Array<float,2> C(3,3);
	C = A+B;
	cout << "C = A+B = " << C <<endl << endl;

	C = A*B;
	cout << "C = A*B = " << C <<endl << endl;
	
	C = A/B;
	cout << "c = A/B = " << C <<endl << endl;

	return 0;
    }


To compile this file correctly, you will need to link the blitz library: ``g++ array_blitz.cc -lblitz``. In case you run into
errors in the linking of libraries, append this: ``pkg-config blitz --libs --cflags`` to the compilation statement. 

This program demonstrates working with arrays of one and two dimensions. An array is declared by creating an object of 
the Array  using: Array<T_Numtype, N_rank> obj_name(m1,m2..mN), where T_numtype can be an integer type, floating point,
complex or any user defined data type, N_rank is the dimension of the
array, obj_name is the variable name and m1, m2 .. mN are the number
of elements in each dimension. As you can see, once the arrays have
been declared you can carry out basic arithmetic functions on them
just like scalars. (Please see the manual pages `here <http://www.oonumerics.org/blitz/manual/blitz02.html>`__ and `here <http://www.oonumerics.org/blitz/manual/blitz03.html#l67>`__ to learn
more). 

The above code assumes that you already know the number of elements you want to store in the array. What if you don't? 
In the next program, we see how you allocate the array at run-time by
using the ``resize()`` member function (Listing 6).

::

    /*Listing-6: array_blitz.cc*/

    /* Dynamic Array objects using Blitz++ */

    #include <blitz/array.h>
    using namespace blitz;

    int main()
    {   
        int n;
	cout << ">>>> Dynamic 1-D Array Demonstration >>>>" << endl << endl;

  	Array<float,1> a;
  	cout << "Enter the number of elements:: ";
	cin >> n;

  	/* Resize the array */
  	a.resize(n);

  	/* Input the array*/
  	for(int i=0;i<n;i++)
    	    cin >> a(i); /* uses the  () operator to refer each element*/
  
        cout << "a = " << a <<endl << endl;

  	cout << ">>>> Dynamic 2-D Array Demonstration >>>>" << endl << endl;

  	Array<float,2> A;
	cout << "Enter the number of elements in the two dimensions:: ";
	int r,c;
	cin >> r >> c;

	/* Resize the matrix */
	A.resize(r,c);

	/* Input the array*/
	for(int i=0;i<r;i++)
	{
	    for(int j=0;j<c;j++)
	        cin >> A(i,j); /* uses the  () operator to refer each element*/
	}
	
	cout << "A = " << A <<endl << endl;
	return 0;
    }


In the above listing, the array objects ``a`` and ``A`` are declared without specifying the size, and hence no memory
is allocated. Then, in each case we ask the user for the number of
elements in the array and then use the ``resize()`` method to resize the array.
Then, we use the ``()`` operator to index individual element of the array where we store the input data. Note, that this is in
contrast to the indexing of C-style arrays (where we index using
``[]``) and the details of the operator () can be seen `here
<http://www.oonumerics.org/blitz/manual/blitz02.html#l45>`__ . The Array class support features like sub-arrays, splicing, Range
objects and custom storage orders and the detailed reference is
available `here <http://www.oonumerics.org/blitz/manual/blitz02.html#l27>`__.

Besides the arithmetic operations, you may also carry out the familiar math operations: ``abs(), cos(), floor()``, etc which are carried
out in an element-wise fashion. For example, consider two array objects, ``A`` and ``B`` declared as ``Array<float,1> A(10),B(10)``. A statement
such as ``B=sin(A)``, will result in assigning the individual ``sin`` values of the elements in ``A`` to ``B``. You may also compare two
array objects. For further information on this, please refer to the
project documentation `here <http://www.oonumerics.org/blitz/manual/blitz03.html#l64>`__.

Next, we take a look at the random number generators facility. Blitz++ supports uniform, discrete uniform, normal, exponential, beta, gamma
and F distributions. Let us try out the normal random number generation facility (Listing 7).

::

    /*Listing-7: normal_demo.c*/

    /* Using the Uniform Random number Generator*/

    #include <random/normal.h>
    #include <blitz/array.h>

    using namespace blitz;
    using namespace ranlib;

    Array<double,1> randompool_unform(int n);

    /* Returns a pool of n uniformly distributed random numbers*/
    Array<double,1> randompool_uniform(int n)
    {
        /* Uniform Normal distribution with mean 0 and standarad deviation 1*/
    	Normal<double> rnd_normal(0,1);

	/* Setup the seed*/
	rnd_normal.seed((unsigned int)time(0));

	/* Declare an array and create the pool*/
	Array<double,1> rnd_array(n);
	for(int i=0;i<n;i++)
	    rnd_array(i) = rnd_normal.random();   

	/* return */
	return rnd_array;
    }


    int main()
    {
        int n;
    	cout << "Number of unifromly distributed random integers? :: " ;
	cin >> n;

	Array<double,1> rnd_array;
	rnd_array.resize(n);

	/* Call the random pool*/
	rnd_array = randompool_uniform(n);
	
	/* print each element individually to facilitate
	plotting*/
	for(int i=0;i<n;i++)
	    cout << rnd_array(i) << endl;
	return 0;  
	
    }

The generators provided can only return a single random number drawn
from the specified distribution via the method ``random()``. So, what we
have done in the above program is use our knowledge of Arrays to
create a helper function ``randompool_uniform()`` to return an array
of a certain specified random numbers. You may extend this function to
include the facility to return an array of any dimension. You can
redirect the output of the above program to  a file, and then plot a
histogram of the data. If you generate a pool of about 10000,  you
should be able to see a near perfect bell-type curve.

.. figure:: misc/histogram.png
   :scale: 60 %
   :alt: alternate text
   :align: center

   Histogram of the random pool

In this section, we have taken a very generic look at Blitz++, learning about the basic building block of using Blitz++, i.e. Arrays
and then using them in a small utility for creating a random pool. There is a large number of other features in Blitz++, which you can learn from 
the project website: http://www.oonumerics.org/blitz/. Please refer to the resources section at the end for relevant pointers.

A look at Ch
============

If you are familiar with MATLAB, Mathematica or Python (with appropriate libraries), you definitely appreciate the quick
prototyping abilities that these tools give you. You can simply fire up the appropriate interpreter and try out short numerical
tasks without having to go through the program file creation, compilation and execution cycle in C/C++ as you have seen over the past
couple of sections. Ch changes that. Ch is a very high-level language environment and is a C/C++ interpreter and scripting language
environment. It is a superset of C, hence also referred to as C+. Ch programs are interpreted, as opposed to compiled. However,
you can also compile Ch programs in a native C compiler. Here, we shall mostly be looking at the Ch's capabilities as an interpreter, thus
allowing us to use C/C++ for quick prototyping and trying out code snippets. 

Ch is not Open Source. Binary installers are available for download from the company website, where there are various
editions (http://www.softintegration.com/download/) of the product. The professional edition which has all that Ch has to offer is available for
a free trial use for 30 days, and you can download it after a simple registration (However, the standard edition is freeware, so is the student edition. 
A feature-wise comparison of the various editions can be found at http://www.softintegration.com/products/features.html).
The installer is made available in the form of a gzipped tarball, and if you do a system-wide install, it will be ready to use immediately after the install. 
(If you install it in a custom location, you will need to update your $PATH accordingly).

Type Ch at the shell prompt to start the interpreter::

    $ ch
    Ch 
    Evaluation edition, version 7.0.0.15151 
    Copyright (C) SoftIntegration, Inc. 2001-2011
    http://www.softintegration.com
    /home/gene/temp_work/C_Scientific/chprofessional-7.0.0.linux2.4.20.intel> cd
    /home/gene> 

Before we go into the details, let us try out a few things based on what we know and would expect from a C interpreter::

    > 1*3+1
    4 

    > sin(45)
    0.8509 


    > pow(5,4)
    625.0000 

    > int x=4;
    > float y=6.53;
    > x*y+1
    27.12 

    > printf("Hello World")
    Hello World 

    > string_t s="I am a String"
    > printf(s)
    I am a String 


As you can see, its the good old C minus the additional baggage. The math library functions are already available and hence you can straightaway
use them. Let us now look into some of the salient features Ch offers for scientific and numerical computing. Arrays are first class objects in 
Ch. That is, you can work with them similar to the way you can work with other data types. Let us see a few examples::

    > array int a[5]={1,2,3,4,5}; /*define an integer array*/
    > array float b[5]={4.1,1.2,4.2,5.1,9.1}; /*define a float array*/

    > a
    1 2 3 4 5 
    > b
    4.10 1.20 4.20 5.10 9.10 

    > double array c[5];
    > c=a+b
    5.1000 3.2000 7.2000 9.1000 14.1000 

    > c=a.*b
    4.1000 2.4000 12.6000 20.4000 45.5000 


    > array double a[2][3]={4.1,4.2,1.3,6.1,4.1,1.3}; /*define a 2x3 matrix*/
    > array double b[2][3]={1.2,3.1,4.1,6.3,4.1,6.3}; /*define a 2x3 matrix*/

    > a+b
    5.3000 7.3000 5.4000 
    12.4000 8.2000 7.6000 

    > a.*b
    4.9200 13.0200 5.3300 
    38.4300 16.8100 8.1900 

    > a*transpose(b) /*product of a and the transpose of b*/
    23.2700 51.2400 
    25.3600 63.4300 

    > array double matrix[2][2] = {1.1,0.53,1.44,9.1};
    > inverse(matrix) /* find the inverse of matrix*/
    0.9841 -0.0573 
    -0.1557 0.1190

In the code snippets above, we have defined vectors and matrices of array data type and we have added them, multiplied them like we would
multiply scalars. To be more technical, these operators have been overloaded in Ch to handle arrays. Hence, you can use the same addition
operator to add two vectors or matrices, which you used to handle an integer or a floating point number. 

The .* operator is used for element-wise multiplication and the * is used for the matrix multiplication. The function transpose() returns
the transpose of a matrix and inverse() returns the inverse of a square matrix. Consider a system of linear equations:
2x+3y=5, -4x+4y=6 which can be expressed as AX=B, where A,X and B are defined as follows::

    > array double a[2][2]={2,3,-4,4}; /*define A*/
    > array double x[2][1]; /*declare X*/
    > array double b[2][1]={5,6}; /*define b*/

The solution of this system of equations is given by X=inverse(A)*B::

    > x=inverse(a)*b
    0.1000 
    1.6000 

Besides these basic operations, Ch has support for a large number of matrix analysis functions such as the decomposition of matrices, finding 
the eigen values and vectors, and support for generic array operations such as finding the sum, norm and related functions. The Ch professional
edition also includes bindings for the LAPACK libraries. 

Next, we shall use arrays to represent polynomials. Consider a cubic polynomial: 5x^3+2x^2+3x+5. To represent this polynomial, we shall use 
a double array to store its co-efficients::

    > array double poly[4]={5,2,3,5}; /*define the array to specify the above polynomial*/

Now, we shall use a Ch function, called polyder() to find the first order derivative of this polynomial::

    > array double poly_der[3]; /*polyder() will store the derivative in this array*/
    > polyder(poly_der,poly) /*polyder() returns 0 on success, -1 on failure*/
    0 
    > poly_der /*print the coefficients of the derivative polynomial*/
    15.0000 4.0000 3.0000 

Hence, the derivative of this function is: 15x^2+4x+3.  Other functions available for working with polynomials include the polyeval() family of
functions for evaluating the polynomial at an unknown point. 

Support for calculus functions in Ch include support for differentiation, integration and solving ordinary differential equations. Ch includes
functions for interpolation - interp(), curve-fitting and polynomial fitting - curvefit() and polyfit(), and root finding - fsolve(),fzero() and 
fminimum(). 

Ch includes the basic functions for statistical analysis: corrcoef() for finding correlation co-efficients, covariance() for finding the covariance,
and functions for finding the mean and median. Ch, however comes with the NAG statistics toolkit, which provides a large number of other functionalities.

The 2D and 3D plotting functions in Ch are based on bindings to the popular gnuplot program and provides functions such as plotxy(), plotxyz(), 
fplotxy() and fplotxyz() for plotting 2D and 3D data. 

Miscellaneous other facilities available in Ch include pseudo-random number generation functions - rand() and urand(), functions for combinatorial
analysis - combination() and functions for evaluating Fast Fourier Transforms.

All the code we have written so far in Ch have been on the command interpreter and are best for prototyping. If you want to write reusable programs,
you should write a Ch script. A Ch script begins with the line #!/bin/ch and the rest of it can contain any valid Ch statement. You can execute it
by typing its name at the Ch interpreter. Unlike C/C++ programs, a Ch script need not have a main() function.

For a C/C++ programmer, the interesting take home is that Ch is a superset of C and hence existing C codes can now be run via the Ch interpreter, which
also means taking the benefits of Ch in legacy C codes. For example, consider the following code snippet - save it in a file chdemo.c::

    #!/bin/ch
    #include<stdio.h>
    #include<numeric.h>

    int main(int argc, char **argv)
    {
    array double a[5]={1.4,1.5,9.1,1.3,4.1};

    printf(a);
    printf("\n");
    return 0;
    }

As you can see, the program begins with a statement alien to C/C++ programs - a #! which is the location of the Ch interpreter. After that its good old C
but using the benefits of Ch - such as using the array data type, which is defined in the file numeric.h. Once you make this code executable using the
chmod command, you can execute it::

    $ ./chdemo.c 
    1.4000 1.5000 9.1000 1.3000 4.1000 

As we have seen, Ch changes the whole ball game by bringing in rapid protoyping abilities to the tried and tested programming languages-C and C++. You can 
make use of Ch's numerical functionalities to implement more functional C programs fast. The resources section at the end has more information on finding your
way through Ch. 


For Future Exploration
======================

There are couple more projects which I would like to draw your attention to in this area: Armadillo - a C++ Linear Algebra library 
(http://arma.sourceforge.net/) and the GNU Multi-precision library (http://gmplib.org/). 

Please refer to the resources section to explore more on the topics we
discussed in this article.


Resources
=========

Math.h

- `C mathematical functions <http://en.wikipedia.org/wiki/C_mathematical_functions>`_

GSL

- `GSL Homepage <http://www.gnu.org/software/gsl/>`_
- `GSL Vectors and Matrices <http://www.gnu.org/software/gsl/manual/html_node/Vectors-and-Matrices.html>`_
- `GSL Sorting functions <http://www.gnu.org/software/gsl/manual/html_node/Sorting.html>`_
- `GSL One-dimensional Minimization functions <http://www.gnu.org/software/gsl/manual/html_node/One-dimensional-Minimization.html>`_
- `GSL Concept Index <http://www.gnu.org/software/gsl/manual/html_node/Concept-Index.html>`_
- `GSL Reference Manual <http://www.gnu.org/software/gsl/manual/html_node/index.html>`_
- `GSL Shell <http://www.nongnu.org/gsl-shell/doc/>`_

Blitz++

- `Blitz++ Homepage <http://www.oonumerics.org/blitz/>`_
- `Papers and resources <http://www.oonumerics.org/blitz/papers/>`_
- `Sourceforge page <http://sourceforge.net/projects/blitz/>`_
- `SciPy, Weave and Blitz+ <http://docs.scipy.org/doc/scipy/reference/tutorial/weave.html#blitz>`_

Ch

- `Ch Homepage <http://www.softintegration.com/>`_
- `Introduction to the Ch Language Environment <http://www.softintegration.com/docs/ch/>`_
- `Ch User's Guide and Reference guide <http://www.softintegration.com/docs/>`_
- `Ch Web-based Numeric Analysis demo <http://www.softintegration.com/chhtml/lang/demos/lib/libch/numeric/>`_
- `Ch plotting <http://www.softintegration.com/docs/ch/plot/>`_
- `Ch IDE <http://www.softintegration.com/docs/ch/chide/>`_
- `C for Engineers and Scientists: An Interpretive Approach <http://iel.ucdavis.edu/cfores/>`_
- `Ch's CGI Capabilities <http://www.softintegration.com/docs/ch/cgi/>`_
