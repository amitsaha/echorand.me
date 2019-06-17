---
title:  Linux System Mining with Python
date: 2018-01-22
categories:
-  Python
aliases:
- /linux-system-mining-with-python.html
---


In this article, we will explore the Python programming language as a tool
to retrieve various information about a system running Linux. Let's get started.

Which Python?
=============

When I refer to Python, I am referring to `CPython
<http://python.org>`__  2 (2.7 to be exact). I will mention it
explicitly when the same code won't work with CPython 3 (3.3) and
provide the alternative code, explaining the differences. Just to make
sure that you have CPython installed, type ``python`` or ``python3``
from the terminal and you should see the Python prompt displayed in
your terminal.

.. note::

   Please note that all the programs have their first line as
   ``#!/usr/bin/env python`` meaning that, we want the Python
   interpreter to execute these scripts. Hence, if you make your
   script executable using ``chmod +x your-script.py``, you can
   execute it using ``./your-script.py`` (which is what you will see
   in this article).

Exploring the `platform` module
=================================

The `platform` module in the standard library has a number of functions which
allow us to retrieve various system information. Let 
us start the Python interpreter and explore some of them, starting
with the ``platform.uname()`` function::

    >>> import platform
    >>> platform.uname()
    ('Linux', 'fedora.echorand', '3.7.4-204.fc18.x86_64', '#1 SMP Wed Jan 23 16:44:29 UTC 2013', 'x86_64') 

If you are aware of the ``uname`` command on Linux, you will recognize
that this function is an interface of sorts to this command. On Python
2, it returns a tuple consisting of the system type (or Kernel type),
hostname, version, release, machine hardware and processor
information. You can access individual attributes using indices, like so::

    >>> platform.uname()[0]
    'Linux'

On Python 3, the function returns a named tuple::

    >>> platform.uname()

    uname_result(system='Linux', node='fedora.echorand',
    release='3.7.4-204.fc18.x86_64', version='#1 SMP Wed Jan 23 16:44:29
    UTC 2013', machine='x86_64', processor='x86_64')

Since the returned result is a named tuple, this makes it easy to
refer to individual attributes by name rather than having to remember
the indices, like so::

    >>> platform.uname().system
    'Linux'

The `platform` module also has direct interfaces to some of
the above attributes, like so::

    >>> platform.system()
    'Linux'

    >>> platform.release()
    '3.7.4-204.fc18.x86_64'

The ``linux_distribution()`` function returns details about the
Linux distribution you are on. For example, on a Fedora 18 system,
this command returns the following information::

    >>> platform.linux_distribution()
    ('Fedora', '18', 'Spherical Cow')

The result is returned as a tuple consisting of the distribution name,
version and the code name. The distributions supported by your
particular Python version can be obtained by printing the value of the
``_supported_dists`` attribute::

    >>> platform._supported_dists
    ('SuSE', 'debian', 'fedora', 'redhat', 'centos', 'mandrake',
    'mandriva', 'rocks', 'slackware', 'yellowdog', 'gentoo',
    'UnitedLinux', 'turbolinux')

If your Linux distribution is not one of these (or a derivative of
one of these), then you will likely not see any useful information
from the above function call.

The final function from the `platform` module, we will look at is
the ``architecture()`` function. When you call the function without
any arguments, this function returns a tuple consisting of the bit
architecture and the executable format of the Python executable, like
so::

    >>> platform.architecture()
    ('64bit', 'ELF')

On a 32-bit Linux system, you would see::

    >>> platform.architecture()
    ('32bit', 'ELF')

You will get similar results if you specify any other executable on the system, like so::

    >>> platform.architecture(executable='/usr/bin/ls')
    ('64bit', 'ELF')

You are encouraged to explore other functions of the `platform`
module which among others, allow you to find the current Python version you are
running. If you are keen to know how this module retrieves this
information, the `Lib/platform.py` file in the Python source
directory is where you should look into.

The `os` and `sys` modules are also of interest to retrieve
certain system attributes such as the native byteorder. Next, we move beyond
the Python standard library modules to explore some generic
approaches to access the information on a Linux system made available
via the `proc` and `sysfs` file systems. It is to be noted
that the information made available via these filesystems will vary
between various hardware architectures and hence you should keep that in mind while
reading this article and also writing scripts which attempt to
retrieve information from these files.


CPU Information
===============

The file `/proc/cpuinfo` contains information about the
processing units on your system. For example, here is a Python version
of what the Linux command ``cat /proc/cpuinfo`` would do:

.. code::

   #! /usr/bin/env python
   """ print out the /proc/cpuinfo
       file
   """
   
   from __future__ import print_function
   
   with open('/proc/cpuinfo') as f:
       for line in f:
           print(line.rstrip('\n'))

When you execute this program either using Python 2 or Python 3, you
should see all the contents of `/proc/cpuinfo` dumped on your
screen (In the above program, the ``rstrip()`` method removes the
trailing newline character from the end of each line).

The next code listing uses the ``startswith()`` string method to
display the models of your processing units:

.. code::

   #! /usr/bin/env python
   
   """ Print the model of your 
       processing units
   
   """
   
   from __future__ import print_function
   
   with open('/proc/cpuinfo') as f:
       for line in f:
           # Ignore the blank line separating the information between
           # details about two processing units
           if line.strip():
               if line.rstrip('\n').startswith('model name'):
                   model_name = line.rstrip('\n').split(':')[1]
                   print(model_name)


When you run this program, you should see the model names of each of
your processing units. For example, here is what I see on my computer::

    Intel(R) Core(TM) i7-3520M CPU @ 2.90GHz
    Intel(R) Core(TM) i7-3520M CPU @ 2.90GHz
    Intel(R) Core(TM) i7-3520M CPU @ 2.90GHz
    Intel(R) Core(TM) i7-3520M CPU @ 2.90GHz

We have so far seen a couple of ways to find the architecture of
the computer system we are on. To be technically correct, both those
approaches actually report the architecture of the kernel your system is
running. So, if your computer is actually a 64-bit computer, but is 
running a 32-bit kernel, then the above methods will report it as
having a 32-bit architecture. To find the true architecture of the computer
you can look for the ``lm`` flag in the list of flags in
`/proc/cpuinfo`. The ``lm`` flag stands for long mode and
is only present on computers with a 64-bit architecture. The next
program shows how you can do this:

.. code::

   #! /usr/bin/env python
   
   """ Find the real bit architecture
   """
   
   from __future__ import print_function
   
   with open('/proc/cpuinfo') as f:
       for line in f:
           # Ignore the blank line separating the information between
           # details about two processing units
           if line.strip():
               if line.rstrip('\n').startswith('flags') \
                       or line.rstrip('\n').startswith('Features'):
                   if 'lm' in line.rstrip('\n').split():
                       print('64-bit')
                   else:
                       print('32-bit')

As we have seen so far, it is possible to read the
`/proc/cpuinfo` and use simple text processing techniques to
read the data we are looking for. To make it friendlier for other
programs to use this data, it is perhaps a better idea to make the
contents of `/proc/cpuinfo` available as a standard data
structure, such as a dictionary. The idea is simple: if you see the
contents of this file, you will find that for each processing unit,
there are a number of key, value pairs (in an earlier example, we
printed the model name of the processor, here model name was a
key). The information about different processing units are separated
from each other by a blank line. It is simple to build a dictionary
structure which has each of the processing unit's data as keys. For
each of the these keys, the value is all the information about the
corresponding processing unit present in the file `/proc/cpuinfo`. 
The next listing shows how you can do so.

.. code::

   #!/usr/bin/env/ python
   
   """
   /proc/cpuinfo as a Python dict
   """
   from __future__ import print_function
   from collections import OrderedDict
   import pprint
   
   def cpuinfo():
       ''' Return the information in /proc/cpuinfo
       as a dictionary in the following format:
       cpu_info['proc0']={...}
       cpu_info['proc1']={...}
   
       '''
   
       cpuinfo=OrderedDict()
       procinfo=OrderedDict()
   
       nprocs = 0
       with open('/proc/cpuinfo') as f:
           for line in f:
               if not line.strip():
                   # end of one processor
                   cpuinfo['proc%s' % nprocs] = procinfo
                   nprocs=nprocs+1
                   # Reset
                   procinfo=OrderedDict()
               else:
                   if len(line.split(':')) == 2:
                       procinfo[line.split(':')[0].strip()] = line.split(':')[1].strip()
                   else:
                       procinfo[line.split(':')[0].strip()] = ''
               
       return cpuinfo
   
   if __name__=='__main__':
       cpuinfo = cpuinfo()
       for processor in cpuinfo.keys():
           print(cpuinfo[processor]['model name'])

This code uses an `OrderedDict` (Ordered dictionary) instead of a usual dictionary so
that the key and values are stored in the order which they are found in
the file. Hence, the data for the first processing unit is followed by
the data about the second processing unit and so on. If you call this
function, it returns you a dictionary. The keys of dictionary are each
processing unit with. You can then use to sieve for the information
you are looking for (as demonstrated in the ``if
__name__=='__main__'`` block). The above program when run will once
again print the model name of each processing unit (as indicated by
the statement ``print(cpuinfo[processor]['model name'])``::

    Intel(R) Core(TM) i7-3520M CPU @ 2.90GHz
    Intel(R) Core(TM) i7-3520M CPU @ 2.90GHz
    Intel(R) Core(TM) i7-3520M CPU @ 2.90GHz
    Intel(R) Core(TM) i7-3520M CPU @ 2.90GHz


Memory Information
==================

Similar to `/proc/cpuinfo`, the file `/proc/meminfo`
contains information about the main memory on your computer. The next program
creates a dictionary from the contents of this file and dumps it.

.. code::

   #!/usr/bin/env python
   
   from __future__ import print_function
   from collections import OrderedDict
   
   def meminfo():
       ''' Return the information in /proc/meminfo
       as a dictionary '''
       meminfo=OrderedDict()
   
       with open('/proc/meminfo') as f:
           for line in f:
               meminfo[line.split(':')[0]] = line.split(':')[1].strip()
       return meminfo
   
   if __name__=='__main__':
       #print(meminfo())
       
       meminfo = meminfo()
       print('Total memory: {0}'.format(meminfo['MemTotal']))
       print('Free memory: {0}'.format(meminfo['MemFree']))

As earlier, you could also access any specific information you are
looking for by using that as a key (shown in the ``if
__name__==__main__`` block). When you execute the program, you should
see an output similar to the following::

    Total memory: 7897012 kB
    Free memory: 249508 kB

Network Statistics
==================

Next, we explore the network devices on our computer system. We will
retrieve the network interfaces on the system and the data bytes sent
and recieved by them since your system reboot. The
`/proc/net/dev` file makes this information available. If you
examine the contents of this file, you will notice that the first two
lines contain header information - i.e. the first column of this file
is the network interface name, the second and the third columns
display information about the received and the transmitted bytes (such
as total bytes sent, number of packets, errors, etc.). Our interest
here is to extract the total data sent and recieved by the
different network devices. The next listing shows how we can extract this
information from `/proc/net/dev`:

.. code::

   #!/usr/bin/env python
   from __future__ import print_function
   from collections import namedtuple
   
   def netdevs():
       ''' RX and TX bytes for each of the network devices '''
   
       with open('/proc/net/dev') as f:
           net_dump = f.readlines()
       
       device_data={}
       data = namedtuple('data',['rx','tx'])
       for line in net_dump[2:]:
           line = line.split(':')
           if line[0].strip() != 'lo':
               device_data[line[0].strip()] = data(float(line[1].split()[0])/(1024.0*1024.0), 
                                                   float(line[1].split()[8])/(1024.0*1024.0))
       
       return device_data
   
   if __name__=='__main__':
       
       netdevs = netdevs()
       for dev in netdevs.keys():
           print('{0}: {1} MiB {2} MiB'.format(dev, netdevs[dev].rx, netdevs[dev].tx))

When you run the above program, the output should display your
network devices along with the total recieved and transmitted data in
MiB since your last reboot as shown below::

    em1: 0.0 MiB 0.0 MiB
    wlan0: 2651.40951061 MiB 183.173976898 MiB

You could probably couple this with a persistent data storage mechanism to write your own data usage
monitoring program.

Processes
=========

The `/proc` directory also contains a directory each for all
the running processes. The directory names are the same as the process
IDs for these processes. Hence, if you scan `/proc` for all
directories which have digits as their names, you will have a list of
process IDs of all the currently running processes. The function
``process_list()`` in the next listing returns a list with process IDs of
all the currently running processes. The length of this list will
hence be the total number of processes running on the system as you
will see when you execute the above program.

.. code::

   #!/usr/bin/env python
   """
    List of all process IDs currently active
   """
   
   from __future__ import print_function
   import os
   def process_list():
   
       pids = []
       for subdir in os.listdir('/proc'):
           if subdir.isdigit():
               pids.append(subdir)
   
       return pids
   
   
   if __name__=='__main__':
   
       pids = process_list()
       print('Total number of running processes:: {0}'.format(len(pids)))

The above program when executed will show an output similar to::

    Total number of running processes:: 229

Each of the process directories contain number of other files and
directories which contain various information about the invoking
command of the process, the shared libraries its using, and
others.

.. Generic reader for /proc
.. ========================

.. So far, we have concentrated on "hand-picking" the files or
.. directories we wanted to read from `/proc`. The next listing presents a
.. more generic reader of `/proc` entries. 

.. code::

   #!/usr/bin/env python
   
   """
   Python interface to the /proc file system.
   Although this can be used as a replacement for cat /proc/... on the command line,
   its really aimed to be an interface to /proc for other Python programs.
   
   As long as the object you are looking for exists in /proc
   and is readable (you have permission and if you are reading a file,
   its contents are alphanumeric, this program will find it). If its a
   directory, it will return a list of all the files in that directory
   (and its sub-dirs) which you can then read using the same function.
   
   
   Example usage:
   
   Read /proc/cpuinfo:
   
   $ ./readproc.py proc.cpuinfo
   
   Read /proc/meminfo:
   
   $ ./readproc.py proc.meminfo
   
   Read /proc/cmdline:
   
   $ ./readproc.py proc.cmdline
   
   Read /proc/1/cmdline:
   
   $ ./readproc.py proc.1.cmdline
   
   Read /proc/net/dev:
   
   $ ./readproc.py proc.net.dev
   
   Comments/Suggestions:
   
   Amit Saha <@echorand>
   <http://echorand.me>
   
   """
   
   from __future__ import print_function
   import os
   import sys
   import re
   
   def toitem(path):
       """ Convert /foo/bar to foo.bar """
       path = path.lstrip('/').replace('/','.')
       return path
   
   def todir(item):
       """ Convert foo.bar to /foo/bar"""
       # TODO: breaks if there is a directory whose name is foo.bar (for
       # eg. conf.d/), but we don't have to worry as long as we are using
       # this for reading /proc
       return '/' + item.replace('.','/')
   
   def readproc(item):
       """ 
       Resolves proc.foo.bar items to /proc/foo/bar and returns the
       appropriate data.
       1. If its a file, simply return the lines in this file as a list
       2. If its a directory, return the files in this directory in the
       proc.foo.bar style as a list, so that this function can then be
       called to retrieve the contents
       """
       item = todir(item) 
   
       if not os.path.exists(item):
           return 'Non-existent object'
       
       if os.path.isfile(item):
           # its a little tricky here. We don't want to read huge binary
           # files and return the contents. We will probably not need it
           # in the usual case.
           # utilities like 'file' on Linux and the Python interface to
           # libmagic are useless when it comes to files in /proc for
           # detecting the mime type, since the these are not on-disk
           # files. 
           # Searching, i find this solution which seems to be a
           # reasonable assumption. If we find a '\0' in the first 1024
           # bytes of a file, we declare it as binary and return an empty string
           # however, some of the files in /proc which contain text may
           # also contain the null byte as a constituent character.
           # Hence, I use a RE expression that matches against any
           # combination of alphanumeric characters
           # If any of these conditions suffice, we read the file's contents
           
           pattern = re.compile('\w*')
           try:
               with open(item) as f:
                   chunk = f.read(1024)
                   if '\0' not in chunk or pattern.match(chunk) is not None:
                       f.seek(0)
                       data = f.readlines()
                       return data
                   else:
                       return '{0} is binary'.format(item)
           except IOError:
               return 'Error reading object'
   
       if os.path.isdir(item):
           data = []
           for dir_path, dir_name, files in os.walk(item):
               for file in files:
                   data.append(toitem(os.path.join(dir_path, file)))
           return data
   
   if __name__=='__main__':
       
       if len(sys.argv)>1:
           data = readproc(sys.argv[1])
       else:
           data = readproc('proc')
       
       if type(data) == list:
           for line in data:
               print(line)
       else:
           print(data)

.. The function ``readproc()`` takes inputs such as ``proc.meminfo``,
.. ``proc.cpuinfo`` or ``proc.cmdline`` and returns the contents of
.. the file. If the input is a directory (such as ``/proc/1903``), it
.. will return the list of all files in the this directory and all its
.. sub-directories. You could then invoke the function ``readproc()``
.. on these files to read the file contents. For example:

.. - Read /proc/cpuinfo: ``$ ./readproc.py proc.cpuinfo``
.. - Read /proc/meminfo: ``$ ./readproc.py proc.meminfo``
.. - Read /proc/cmdline: ``$ ./readproc.py proc.cmdline``
.. - Read /proc/1/cmdline, i.e. the command that invoked the process with
..   process ID 1: ``$ ./readproc.py proc.1.cmdline``
.. - Read /proc/net/dev: ``$ ./readproc.py proc.net.dev``

Block devices
=============

The next program lists all the block devices by reading from the
`sysfs` virtual file system. The block devices on your system can
be found in the `/sys/block` directory. Thus, you may have
directories such as `/sys/block/sda, /sys/block/sdb` and so on.
To find all such devices, we perform a scan of the `/sys/block`
directory using a simple regular expression to express the block devices we
are interested in finding.

.. code::

   #!/usr/bin/env python
   
   """
   Read block device data from sysfs
   """
   
   from __future__ import print_function
   import glob
   import re
   import os
   
   # Add any other device pattern to read from
   dev_pattern = ['sd.*','mmcblk*']
   
   def size(device):
       nr_sectors = open(device+'/size').read().rstrip('\n')
       sect_size = open(device+'/queue/hw_sector_size').read().rstrip('\n')
   
       # The sect_size is in bytes, so we convert it to GiB and then send it back
       return (float(nr_sectors)*float(sect_size))/(1024.0*1024.0*1024.0)
   
   def detect_devs():
       for device in glob.glob('/sys/block/*'):
           for pattern in dev_pattern:
               if re.compile(pattern).match(os.path.basename(device)):
                   print('Device:: {0}, Size:: {1} GiB'.format(device, size(device)))
   
   if __name__=='__main__':
       detect_devs()

If you run this program, you will see output similar to as follows::

    Device:: /sys/block/sda, Size:: 465.761741638 GiB
    Device:: /sys/block/mmcblk0, Size:: 3.70703125 GiB

When I run the program, I had a SD memory card plugged in as well
and hence you can see that the program detects it. You can extend this
program to recognize other block devices (such as virtual hard disks)
as well.

Building command line utilities
===============================

One ubiquitious part of all Linux command line utilities is that they
allow the user to specify command line arguments to customise the
default behavior of the program. The argparse module
allows your program to have an interface similar to built-in Linux
utilities. The next listing shows a program which retrieves all the users on
your system and prints their login shells (using the `pwd`
standard library module)::

    #!/usr/bin/env python

    """
    Print all the users and their login shells
    """

    from __future__ import print_function
    import pwd


    # Get the users from /etc/passwd
    def getusers():
        users = pwd.getpwall()
    	for user in users:
            print('{0}:{1}'.format(user.pw_name, user.pw_shell))
    
    if __name__=='__main__':
        getusers()


When run the program above, it will print all the users on your system
and their login shells. 

Now, let us say that you want the program user
to be able to choose whether he or she wants to see the system users
(like `daemon`, `apache`). We will see a first use of the
`argparse` module to implement this feature in by extending the
previous listing as follows.

.. code::

   #!/usr/bin/env python
   
   """
   Utility to play around with users and passwords on a Linux system
   """
   
   from __future__ import print_function
   import pwd
   import argparse
   import os
   
   def read_login_defs():
   
       uid_min = None
       uid_max = None
   
       if os.path.exists('/etc/login.defs'):
           with open('/etc/login.defs') as f:
               login_data = f.readlines()
               
           for line in login_data:
               if line.startswith('UID_MIN'):
                   uid_min = int(line.split()[1].strip())
               
               if line.startswith('UID_MAX'):
                   uid_max = int(line.split()[1].strip())
   
       return uid_min, uid_max
   
   # Get the users from /etc/passwd
   def getusers(no_system=False):
   
       uid_min, uid_max = read_login_defs()
   
       if uid_min is None:
           uid_min = 1000
       if uid_max is None:
           uid_max = 60000
   
       users = pwd.getpwall()
       for user in users:
           if no_system:
               if user.pw_uid >= uid_min and user.pw_uid <= uid_max:
                   print('{0}:{1}'.format(user.pw_name, user.pw_shell))
           else:
               print('{0}:{1}'.format(user.pw_name, user.pw_shell))
   
   if __name__=='__main__':
   
       parser = argparse.ArgumentParser(description='User/Password Utility')
   
       parser.add_argument('--no-system', action='store_true',dest='no_system',
                           default = False, help='Specify to omit system users')
   
       args = parser.parse_args()
       getusers(args.no_system)
           
   

On executing the above program with the ``--help`` option, you
will see a nice help message with the available options (and what they do)::

    $ ./getusers.py --help
    usage: getusers.py [-h] [--no-system]

    User/Password Utility

    optional arguments:
      -h, --help   show this help message and exit
      --no-system  Specify to omit system users

An example invocation of the above program is as follows::

    $ ./getusers.py --no-system
    gene:/bin/bash
    
When you pass an invalid parameter, the program complains::

    $ ./getusers.py --param
    usage: getusers.py [-h] [--no-system]
    getusers.py: error: unrecognized arguments: --param

Let us try to understand in brief how we used argparse in the
above program. The statement: ``parser =
argparse.ArgumentParser(description='User/Password Utility')`` 
creates a new ``ArgumentParser`` object with an optional description
of what this program does. 

Then, we add the arguments that we want the program to recognize using
the ``add_argument()`` method in the next statement:
``parser.add_argument('--no-system', action='store_true',
dest='no_system', default = False, help='Specify to omit system
users')``. The first argument to this method is the
name of the option that the program user will supply as an argument
while invoking the program, the next parameter
``action=store_true`` indicates that this is a boolean option. That
is, its presence or absence affects the program behavior in some
way. The ``dest`` parameter specifies the variable in which the
value that the value of this option will be available to the
program. If this option is not supplied by the user, the default value
is ``False`` which is indicated by the parameter ``default =
False`` and the last parameter is the help message that the program
displays about this option. Finally, the arguments are parsed using
the ``parse_args()`` method: ``args =
parser.parse_args()``. Once the parsing is done, the values of the
options supplied by the user can be retrieved using the syntax
``args.option_dest``, where ``option_dest`` is the ``dest``
variable that you specified while setting up the arguments. This
statement: ``getusers(args.no_system)`` calls the ``getusers()``
function with the option value for ``no_system`` supplied by the
user. 

The next program shows how you can specify options which
allow the user to specify non-boolean preferences to your
program. This program is a rewrite of Listing 6, with the additional
option to specify the network device you may be interested in.


.. code::

   #!/usr/bin/env python
   from __future__ import print_function
   from collections import namedtuple
   import argparse
   
   def netdevs(iface=None):
       ''' RX and TX bytes for each of the network devices '''
   
       with open('/proc/net/dev') as f:
           net_dump = f.readlines()
       
       device_data={}
       data = namedtuple('data',['rx','tx'])
       for line in net_dump[2:]:
           line = line.split(':')
           if not iface:
               if line[0].strip() != 'lo':
                   device_data[line[0].strip()] = data(float(line[1].split()[0])/(1024.0*1024.0), 
                                                       float(line[1].split()[8])/(1024.0*1024.0))
           else:
               if line[0].strip() == iface:
                   device_data[line[0].strip()] = data(float(line[1].split()[0])/(1024.0*1024.0), 
                                                       float(line[1].split()[8])/(1024.0*1024.0))    
       return device_data
   
   if __name__=='__main__':
   
       parser = argparse.ArgumentParser(description='Network Interface Usage Monitor')
       parser.add_argument('-i','--interface', dest='iface',
                           help='Network interface')
   
       args = parser.parse_args()
   
       netdevs = netdevs(iface = args.iface)
       for dev in netdevs.keys():
           print('{0}: {1} MiB {2} MiB'.format(dev, netdevs[dev].rx, netdevs[dev].tx))

When you execute the program without any arguments, it behaves exactly
as the earlier version. However, you can also specify the network
device you may be interested in. For example::

    $ ./net_devs_2.py 

    em1: 0.0 MiB 0.0 MiB
    wlan0: 146.099492073 MiB 12.9737148285 MiB
    virbr1: 0.0 MiB 0.0 MiB
    virbr1-nic: 0.0 MiB 0.0 MiB

    $ ./net_devs_2.py  --help
    usage: net_devs_2.py [-h] [-i IFACE]

    Network Interface Usage Monitor

    optional arguments:                                                                                                                                                          
      -h, --help            show this help message and exit                                                                                                                      
      -i IFACE, --interface IFACE                                                                                                                                                
                            Network interface                                                                                                                                    
   
    $ ./net_devs_2.py  -i wlan0
    wlan0: 146.100307465 MiB 12.9777050018 MiB   

System-wide availability of your scripts
========================================

With the help of this article, you may have been able to write one or more
useful scripts for yourself which you want to use everyday like any
other Linux command. The easiest way to do is make this script
executable and setup a BASH alias to this script. You could also
remove the .py extension and place this file in a standard location
such as `/usr/local/sbin`. 

Other useful standard library modules
=====================================

Besides the standard library modules we have already looked at in
this article so far, there are number of other standard modules which
may be useful: subprocess, ConfigParser, readline and curses.

What next?
==========

At this stage, depending on your own experience with Python and
exploring Linux internals, you may follow one of the following
paths. If you have been writing a lot of shell scripts/command
pipelines to explore various Linux internals, take a look at
Python. If you wanted a easier way to write your own utility scripts
for performing various tasks, take a look at Python. Lastly, if you
have been using Python for programming of other kinds on Linux, have
fun using Python for exploring Linux internals.


Resources
=========

Python resources
~~~~~~~~~~~~~~~~


- `Lists <http://docs.python.org/2/tutorial/introduction.html#lists>`__
- `Tuples <http://docs.python.org/2/tutorial/datastructures.html#tuples-and-sequences>`__
- `Namedtuples <http://docs.python.org/2/library/collections.html#collections.namedtuple>`__
- `OrderedDict <http://docs.python.org/2/library/collections.html#collections.OrderedDict>`__
- `split() <http://docs.python.org/2/library/stdtypes.html#str.split>`__
- `strip() rstrip() and other string methods  <http://docs.python.org/2/library/stdtypes.html#string-methods>`_
- `Reading and writing files <http://docs.python.org/2/tutorial/inputoutput.html#reading-and-writing-files>`__
- `os module <http://docs.python.org/2.7/library/os.html>`__
- `platform module <http://docs.python.org/2.7/library/platform.html>`__
- `pwd module <http://docs.python.org/2/library/pwd.html>`__
- `spwd module <http://docs.python.org/2/library/spwd.html>`__
- `grp module <http://docs.python.org/2/library/grp.html>`__
- `subprocess module <http://docs.python.org/2/library/subprocess.html>`__
- `ConfigParser module <http://docs.python.org/2/library/configparser.html>`__
- `readline module <http://docs.python.org/2/library/readline.html>`__


System Information
~~~~~~~~~~~~~~~~~~

- `Long Mode <http://en.wikipedia.org/wiki/Long_mode>`__
- `/proc file system <http://linux.die.net/man/5/proc>`__
- `sysfs <http://en.wikipedia.org/wiki/Sysfs>`__

