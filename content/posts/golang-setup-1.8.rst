---
title:  Setup Go 1.8 and gb on Fedora (and other Linux distributions)
date: 2017-03-01
categories:
-  go
aliases:
- /setup-golang-18-and-gb-on-fedora-and-other-linux-distributions.html
---

This guide will be how I usually setup and get started with Go development environment on Linux. By the end of this document, we will have seen how to:

- Install the Go 1.8 compiler and other tools (``gofmt``, for eaxmple), collectively referred to as go tools
- Install `gb <http://getgb.io>`__ and the ``vendor`` plugin
- Vendoring third party packages

Installing Go tools
===================

We can follow the official `install guide <https://golang.org/doc/install>`__ to get the latest stable version of the Go tools:

- Download the Linux binary tarball from the `Downloads page <https://golang.org/dl/>`__
- ``sudo tar -C /usr/local -xzf <filename-from-above>``
- ``export PATH=$PATH:/usr/local/go/bin`` in your ``.bashrc`` or similar file.

When we now open a new terminal session, we should be able to type in `go version` and get the version we installed:

.. code::
   
   $ go version
   go version go1.8 linux/amd64

If we see this, we are all set to go to the next stage.

Golang expects us to structure our source code in a certain way. You can read all about it 
in this `document <https://golang.org/doc/code.html>`__. The summarized version is that:

- All our go code (including those of packages we use) in a single directory
- The environment variable ``GOPATH`` points to this single directory
- This single directory has three sub-directories: ``src``, ``bin``, ``pkg``
- It is in the ``src`` sub-directory where all our Go code will live

Prior to version 1.8, we needed to setup a Go workspace and set the ``GOPATH`` environment variable before we could
start working with golang. Golang 1.8 will automatically use ``$HOME/go`` as the GOPATH if one is not set:

.. code::

   $ go env GOPATH
   /home/user/go

If you are happy with the selection, you can skip the next step. You can learn more about 
GOPATH `here <https://golang.org/cmd/go/#hdr-GOPATH_environment_variable>`__.


Setting up the Go workspace
===========================

Let's say you want to set the ``GOPATH`` to ``$HOME/work/golang``:

.. code::

   $ mkdir -p $HOME/work/golang
   $ mkdir -p $HOME/work/golang/src $HOME/work/golang/bin $HOME/work/golang/pkg
   
At this stage, our $GOPATH directory tree looks like this:

.. code::

   $ tree -L 1 work/golang/
   work/golang/
   ├── bin
   ├── pkg
   └── src


Next, we will add the line ``export GOPATH=$HOME/work/golang`` in the ``.bashrc`` (or another similar file). If we now start a new terminal session, we should see that ``GOPATH`` is now setup to this path.

.. code::
   
   $ go env GOPATH
   /home/asaha/work/golang


Writing our first program
=========================


There are two types of Golang programs we can write - one is an application program (output is an executable program) and the other is a package which is meant to be used in other programs. We will first write a program which will be compiled to an executable. 

First, create a directory tree in ``$GOPATH/src`` for our package:

.. code::

   $ mkdir -p $GOPATH/src/github.com/amitsaha/golang_gettingstarted
   
Our package name for the above directory tree becomes ``github.com/amitsaha/golang_gettingstarted``. Then, type in the following in ``$GOPATH/src/github.com/amitsaha/golang_gettingstarted/main.go``:

.. code::

   package main

   import (
	    "fmt"
   )

   func main() {
	    fmt.Printf("Hello World\n")
   }


Next, build and run the program as follows:

.. code::

   $ go run $GOPATH/src/github.com/amitsaha/golang_gettingstarted/main.go 
   Hello World

Great! Our program compiled and ran successfully. Our workspace at this stage only has a single file - the one we created above:

.. code::

   $ tree
   .
   ├── bin
   ├── pkg
   └── src
            └── github.com
                    └── amitsaha
                            └── golang_gettingstarted
                                └── main.go

Installing Go applications
==========================

Now, let's say that the program above was actually a utility we wrote and we want to use it regularly. Where as we could execute ``go run`` as above, but the more convenient approach is to install the program. ``go install`` command is used to build and install Go packages. Let's try it on our package:

.. code::
    
    $ go install github.com/amitsaha/golang_gettingstarted/

You can execute this command from anywhere on your filesystem. Go will figure out the path to the package from GOPATH we set above. Now, you will see that there is a ``golang_gettingstarted`` executable file in the ``$GOPATH/bin`` directory:

.. code::

   $ tree work/golang/
   work/golang/
   ├── bin
   │   └── golang_gettingstarted
   ├── pkg
   └── src
        └── github.com
            └── amitsaha
                   └── golang_gettingstarted
                            └── main.go

We can try executing the command:

.. code::

   $ ./work/golang/bin/golang_gettingstarted 
   Hello World


As a shortcut, we can just execute ``$GOPATH/bin/golang_gettingstarted``. But, you wouldn't need to even do that if ``$GOPATH/bin`` is in your ``$PATH``. So, if you want, you can do that and then you could just specify ``golang_gettingstarted`` and the program would be executed.


Working with third-party packages
=================================

Let's now replace the ``main.go`` file above by the example code from the package `pb <https://github.com/cheggaaa/pb>`__ which lets us create nice progress bars:

.. code::

    package main

    import (
        "gopkg.in/cheggaaa/pb.v1"
        "time"
    )

    func main() {
	count := 100000
	bar := pb.StartNew(count)
	for i := 0; i < count; i++ {
	    bar.Increment()
	    time.Sleep(time.Millisecond)
	}
	bar.FinishPrint("The End!")
    }

Let's try and install this package:

.. code::

   $ go install github.com/amitsaha/golang_gettingstarted
   golang/src/github.com/amitsaha/golang_gettingstarted/main.go:6:5: cannot find package "gopkg.in/cheggaaa/pb.v1" in any of:
	/usr/lib/golang/src/gopkg.in/cheggaaa/pb.v1 (from $GOROOT)
	/home/asaha/work/golang/src/gopkg.in/cheggaaa/pb.v1 (from $GOPATH)

Basically, this tells us that Go compiler is not able to find the package ``gopkg.in/cheggaaa/pb.v1``. So, let's get it:

.. code::
 
   $ go get  gopkg.in/cheggaaa/pb.v1
  
This will download the package and place it in ``$GOPATH/src``:
 
 .. code::
 
    $ tree -L 3 $GOPATH/src/
     /home/asaha/work/golang/src/
     ├── github.com
             │   └── amitsaha
             │       └── golang_gettingstarted
     └── gopkg.in
             └── cheggaaa
                    └── pb.v1

 
If we now install our package again, it will build correctly and an executable ``golang_gettingstarted`` 
will be placed in ``$GOPATH/bin``:

.. code::

   $ go install github.com/amitsaha/golang_gettingstarted
   $ $GOPATH/bin/golang_gettingstarted 
    100000 / 100000 [======================================================================================================]100.00% 1m49s
    The End!

Golang package objects
======================

If we now display the directory contents of ``$GOPATH``, we will see:

.. code::

   $ tree -L 2 golang/
   golang/
       ├── bin
       │    └── golang_gettingstarted
       ├── pkg
       │   └── linux_amd64
       └── src
           ├── github.com
           └── gopkg.in
           

The contents in ``pkg`` sub-directory are referred to as `package objects` - basically built Golang packages. This is the difference from application programs (programs having ``package main``). This question from a while back on the golang-nuts group may be `interesting <https://groups.google.com/forum/m/#!topic/golang-nuts/RSd3B5_rIFE>`__ to read.

Using gb to manage projects
===========================

`gb <https://getgb.io>`__ is Go build tool which works with the idea of projects. For me it has two features
for which I use it:

- It doesn't require my project to be in ``$GOPATH/src``
- It allows me to vendor and manage thrird party packages easily

The disadvantage of using ``gb`` to manage your project is that your project is not "go gettable". But, let's ignore
it for now.

Installing gb
~~~~~~~~~~~~~

The following will fetch and install ``gb`` in ``$GOPATH/bin``:

.. code::

   $ go get github.com/constabulary/gb/...

If not already done, please add ``$GOPATH/bin`` to your ``$PATH`` environment variable and start
a new shell session and type in ``gb``:

.. code::

   $ gb
   gb, a project based build tool for the Go programming language.

   Usage:

        gb command [arguments]

We will next install the ``gb-vendor`` `plugin <https://godoc.org/github.com/constabulary/gb/cmd/gb-vendor>`__:

.. code::

   $ go get github.com/constabulary/gb/cmd/gb-vendor


Let's now setup the above project, but now as a ``gb`` project. Create a directory ``pb_demo`` anywhere
in your ``$HOME`` and create a sub-directory ``src`` under it. Inside ``src``, we will create another 
subirectory ``demo`` inside it - ``demo`` is our project name, and place ``main.go`` above in it.

The resulting directory structure will look like this:

.. code::

   $ tree pb-demo/
   pb-demo/
   `-- src
       `-- demo
           `-- main.go

The ``pb-demo`` directory is now a valid ``gb`` project. Let's fetch the dependency:

.. code::

   $ cd pb-demo
   $ gb vendor fetch gopkg.in/cheggaaa/pb.v1
   fetching recursive dependency github.com/mattn/go-runewidth

You will now see a new sub-directory ``vendor`` inside ``pb-demo``. We can now go ahead and build our project:

.. code::

   $ cd pb-demo/
   $ gb build
   github.com/mattn/go-runewidth
   gopkg.in/cheggaaa/pb.v1
   demo


And finally run it:

.. code::
   
   $ ./bin/main
   ..

Couple of points to summarize here:

- The third party package(s) are now in the ``vendor`` sub-directory along with your package's source
- The ``vendor/manifest`` file allows you to make sure that your dependencies are pinned to a certain version
- You don't need to worry about having your project in ``$GOPATH``




If you are to keen to learn more:

- The `How to Write Go Code <https://golang.org/doc/code.html>`__ document covers all I have discussed above and more
- Others in my `repository <https://github.com/amitsaha/linux_voice_1>`__ for an article I wrote on Go.
- Learn about `gb <https://getgb.io/docs/project/>`__. 

That's all for now, you can find the simple source code above `here <https://github.com/amitsaha/golang_gettingstarted>`__.
