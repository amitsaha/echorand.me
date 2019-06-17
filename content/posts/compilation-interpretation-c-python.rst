---
title:  Compilation and Interpretation in C and CPython
date: 2018-01-05
categories:
-  python
aliases:
- /compilation-and-interpretation-in-c-and-cpython.html
---

It is common knowledge that programs written in high level languages
have to be translated into a low level language using programs
referred to as `translators`. This low level language is either in a `native` form, in the sense that it
is understood by the operating system itself, or in an `intermediate`
form which is understood by an intermediate program such as the `bytecode
interpreter`. It is also known that C is a compiled language, whereas
CPython is both first compiled `and` then interpreted.

In this article, I will try to illustrate the difference between the
two languages by carrying out some simple experiments (on Linux).

Consider a program, `helloworld.c`::


   # include<stdio.h>

   int main(int argc, char **argv)
   {
      printf("Hello World!\n");
      return 0;
   }
 
We can compile and execute this program as follows:

.. code-block:: c

    $ gcc -o helloworld helloworld.c
    $ ./helloworld
    Hello World

The executable file `helloworld` is the low level language
equivalent of the high level language program, `helloworld.c`. This is
what the operating system on your computer understands and hence when it
is executed, it prints `Hello World` on the screen. This process
of converting `helloworld.c` to `helloworld` represents the
*translation* process. In the case of C, this translation process is
performed by the compiler, `gcc` (this translation process is really a
process pipeline and involves two other processes `preprocessing` and `linking`, which
are carried out by separate programs, automatically invoked by
`gcc`). Nevertheless, `compilation` is at the core of the translation
process of C programs and is responsible for converting a high level
language to its low level equivalent - a version readily executable by
the operating system on your computer. It is important to note that
this executable file is composed of the instructions you wrote in your C
program, along with a other details which are necessary to
execute your program. These details are specific to the architecture
and operating system you created the executable file on and hence if you copy a executable file
you created on a computer with an Intel processor, it will not work at
all on a computer which has an ARM processor, for example. Hence, you
will have to recompile the program on the new computer before you can
execute it. Note that your C program still remains the same, but the
low level machine language equivalent is different and `gcc` takes
care of this translation.

Now, let us consider our first CPython program::

    # Print Hello world
    if __name__=='__main__':
        print 'Hello World!'

You executed this program as follows ::

    $ python helloworld.py
    Hello World!

Unlike C, where you compiled the program first to get a separate
executable file and then executed it (a two step process), here you
executed the program in a single step - your program is directly executed on-the-fly. This
is how traditionally `interpreters` (interpreted languages) worked. However, modern day
interpreted languages like CPython (and others) also involve a compilation
step. Your program `helloworld.py` is first converted to an intermediate
representation which is a low level equivalent of your high level
language program. The difference from C is that the instructions in
these low level language equivalents are not meant to be executed by a
*real* computer, but a *process virtual machine* [#]_. In the case of CPython, the intermediate
representation is known as `bytecodes` and the virtual machine referred
to as the `bytecode interpreter` or the CPython virtual machine.
Hence, the CPython code is first converted into its bytecode equivalent
which is then executed by the bytecode interpreter. When you run a
CPython program using `python helloworld.py`, both these steps happen in
the background.

While discussing the section on C compilation I mentioned that the
executable you create on an Intel computer will not run on an ARM
computer, because of the architecture specific instructions embedded
into the executable required for executing the program. In the case of
CPython the bytecodes (result of compilation of the CPython program) are
executed by the CPython virtual machine, instead of the real
computer. This extra layer of abstraction allows
you to execute the same bytecodes (without recompiling) on an Intel computer and an
ARM computer, for example.

Let us understand this better with a real example. I will use two
computers for the experiments: System1 and System2, with both running
Fedora Linux. However, System1's instruction set architecture is x86_64 (Intel) where as
System2 is a `RaspberryPi <http://www.raspberrypi.org>`_ with an armv6l (ARM) instruction set. 

C
~

First, I will the consider the ``helloworld.c`` program. I will compile this
program on System1::

    $ arch
    x86_64
    $ gcc -o helloworld helloworld.c
    $ file ./helloworld
    ./helloworld: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked (uses shared libs), for GNU/Linux 2.6.32,
    BuildID[sha1]=0xc50d74290927cb25ef9e34055af6c437e89ed5eb, not stripped

    
The ``file`` command shows the type of a file [#]_ and from the above
output, the key information for us is that the file ``helloworld`` is
a `ELF 64-bit LSB executable, x86-64, version 1 (SYSV)`. You can
of course execute the program as we have done earlier using
``./helloworld``.

Now, copy the file, ``helloworld`` to System2, and try to execute the
object file::

    $ arch
    armv6l
    $ file helloworld
    helloworld: ELF 64-bit LSB executable, x86-64, version 1 (SYSV),
    dynamically linked (uses shared libs), for GNU/Linux 2.6.32,
    BuildID[sha1]=0xc50d74290927cb25ef9e34055af6c437e89ed5eb, not stripped
    $ ./helloworld 
    -bash: ./helloworld: cannot execute binary file

It is clear from the above error message, that ``helloworld`` could
not be executed on System2. Now, transfer the ``helloworld.c`` file to
System2 and compile and execute the file as on System1::

    $ gcc -o helloworld helloworld.c
    $ file helloworld
    helloworld: ELF 32-bit LSB executable, ARM, version 1 (SYSV),
    dynamically linked (uses shared libs), for GNU/Linux 2.6.32,
    BuildID[sha1]=0xba57691af19ff94f894645398e66e263c8f57a9b, not stripped
    $ ./helloworld 
    Hello World!

As you can see, the file format of ``helloworld`` is different on
System2 as expected and hence it had to be recreated to execute it.


CPython
~~~~~~~

On System1, create the `compiled` version of ``helloworld.py`` using the following
code [#]_::

    $ python -c "import py_compile;py_compile.compile('helloworld.py')"

Or, the cleaner version: ``$ python -m py_compile helloworld.py``.
This will create a ``helloworld.pyc`` file in your directory. Once
again, we can use the ``file`` command to see the file type of ``helloworld.pyc``::

    $ file helloworld.pyc 
    helloworld.pyc: python 2.7 byte-compiled

To execute the compiled file, simply invoke the ``python`` interpreter
with the ``helloworld.pyc`` file as an argument, rather than the
source file: ``python helloworld.pyc``.

Now, copy the file ``helloworld.pyc`` to System2 and try to execute
it::

    $ arch
    armv6l
    $ file helloworld.pyc 
    helloworld.pyc: python 2.7 byte-compiled
    $ python helloworld.pyc 
    Hello World!

To summarize, the compiled ``helloworld.pyc`` could be executed
without being re-created from its source file, ``helloworld.py`` on
two systems with different instruction set architecture. This was made
possible by the ``python`` bytecode interpreter on the two systems,
which created an abstraction between the bytecodes and the native
instruction set architecture [#]_. I should mention here that if your
CPython application has anything to do beyond pure CPython code (C
extension, for example), the results of the experiments here will not
be applicable.


``python``

The CPython executable, ``python`` is nothing but a ELF file (similar to your ``helloworld``
but obviously created from a more complicated set of C source
files). The almost magical behavior of CPython bytecodes that we saw
in the previous section is made possible by ``python`` taking care of
the steps necessary to execute the bytecodes on systems with
different instruction set architecture. To understand this better,
consider the following two commands, the first on System1 and the
second on System2::

    $ file /usr/bin/python2.7
    /usr/bin/python2.7: ELF 64-bit LSB executable, x86-64, version 1
    (SYSV), dynamically linked (uses shared libs), for GNU/Linux 2.6.32,
    BuildID[sha1]=0x9d8a414b778ff11ec075995248c43cdf5b67f17a, stripped

    $ file /usr/bin/python2.7
    /usr/bin/python2.7: ELF 32-bit LSB executable, ARM, version 1 (SYSV),
    dynamically linked (uses shared libs), for GNU/Linux 2.6.32,
    BuildID[sha1]=0x63fd81d3591769d6be0619b7273935ab9521010c, stripped

As is clear from the above output, the file ``/usr/bin/python2.7``
(``/usr/bin/python`` is symlinked to ``/usr/bin/python2``, which is in
turn symlinked to ``/usr/bin/python2.7`` in reality), is an ELF
executable and it has obviously been compiled separately on both these
systems (thus showing the different ELF file formats).


Conclusion
~~~~~~~~~~

The above experiments have hopefully shed some light on C being a
compiled language and CPython being a compiled and interpreted
language - this design leads to its interoperability between different
architectures.

However, it is important that I mention a language is not compiled or
interpreted. That is, it is not technically 100% accurate to say that C is a
compiled language. A language implementation, rather than the language
is compiled or interpreted. There are interpreters for the C language
which interpret your C programs and there are CPython implementations
which are compiled (The water gets murkier in the case of CPython,
and the boundary between being compiled and interpreted not always
clear).

Footnotes
~~~~~~~~~

.. [#] Note that, there are two kinds of virtual machines that can be
   implemented in software: `system virtual machine` and `process
   virtual machine`. Here, I am referring to the process virtual
   machine. See the `Wikipedia article <http://en.wikipedia.org/wiki/Virtual_machine>`_ on Virtual Machine
   to learn more.
.. [#] http://linux.die.net/man/1/file
.. [#] The ``py_compile`` module can be used to compile a CPython
   program into its bytecode equivalent. This is the version of your
   program that is executed the CPython bytecode interpreter. See:
   `<http://docs.python.org/2/library/py_compile.html>`_.
.. [#] Actually, to be more accurate, the ``python`` executable takes
   care of the interfacing with the operating system kernel (Linux
   Kernel), which is once again different on systems with different
   instruction set architecture.


See also
~~~~~~~~

- `List of readings on Compilers and Interpreters <http://readlists.com/f2bd0b33>`_
- `Instruction Set Architecture
  <http://en.wikipedia.org/wiki/Instruction_set_architecture>`_
