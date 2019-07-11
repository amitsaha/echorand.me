---

title:  What is my program doing on Linux? 
date: 2018-06-19
categories:
-  software
aliases:
- /what-is-my-program-doing-on-linux-.html
draft: true
---

Consider the following program written in Python:

```
#test.py

while True:

    for _ in range(1000000):
        continue
    f = open('test.txt', 'w')
    f.write('Hello')
    f.close()
```

The program has two characteristics:

- The `while True` loop means it is continuously trying to run or get CPU time
- Inside the loop, we create a file and write a string to it i.e. our program also performs Input/Output 
  (in this case, disk writes).

Let's now run the program in the background:

```
$ python3 test.py &
[1] 2114
```

The first tool we will explore is `pidstat`. On most distributions, you will find it in the `sysstat` package. 

# pidstat

# CPU 

Let's run `pidstat` specifying the process ID via `-p` option:

```
$ pidstat -p 2114
Linux 4.15.0-1020-aws (ip-172-31-7-75) 	08/26/18 	_x86_64_	(1 CPU)

09:37:07      UID       PID    %usr %system  %guest   %wait    %CPU   CPU  Command
09:37:07     1000      2114   86.10    0.09    0.00    0.03   86.19     0  python3

```

The first line reports the current kernel version, the IP address associated with the first non-loopback network 
interface, the current date, the CPU architecture and the number of CPUs on the system.

The first column of the second line prints the time of the statistics reported. The other fields are described below:

**UID**

The user ID of the user the process is running as.

**PID**

Process ID of the user

**%usr**

The percentage of the time the process has spent in _user space_. We have a infinite loop in our program,
so we expect a very high percentage of the time being spent completely in this space.

**%system**

The percentage of the time the process has spent in _kernel space_. We are writing to a disk file in our program which
involves _system calls_. This accounts for the very tiny fraction of the time spent in kernel space.


**%wait**

The percentage of the time the process is waiting to run. This could be waiting for I/O or the processor just
being busy serving other higher priority tasks.


**%CPU**

This is the total percentage of the CPU used by the task. Since, the current system is a single processor system,
we can say that our process is using the reported percentage of the total CPU power. If however, this is a multi-processor
environment, the number displayed here will be total CPU usage of the process divided by the number of CPUs
on the system.

**Command**

This is the command (without the arguments) that created the process.


If we specified a `1` at the end of our command above, `pidstat` would report the same statistics for the process
at 1 second intervals unless you press a Ctrl+C:

```
$ pidstat -p 2114 1
Linux 4.15.0-1020-aws (ip-172-31-7-75) 	08/26/18 	_x86_64_	(1 CPU)

09:20:29      UID       PID    %usr %system  %guest   %wait    %CPU   CPU  Command
09:20:30     1000      2114  100.00    0.00    0.00    0.00  100.00     0  python3
09:20:31     1000      2114  100.00    0.00    0.00    0.00  100.00     0  python3
09:20:32     1000      2114  100.00    0.00    0.00    1.00  100.00     0  python3
09:20:33     1000      2114  100.00    1.00    0.00    0.00  100.00     0  python3
..
09:51:02     1000      2114   98.02    0.00    0.00    0.00   98.02     0  python3
^C
Average:     1000      2114   99.50    0.00    0.00    0.00   99.50     -  python3

```

When you pressed a Ctrl + C, a summary is printed at the end. If you added a `5` at the end of the previous
command, it would print the above data for a total of 5 counts and exit. Try it out. 


# Disk

Let's now monitor our process' disk activity using the `-d` switch:

```
$ pidstat -p 2114 -d 1
Linux 4.15.0-1020-aws (ip-172-31-7-75) 	08/26/18 	_x86_64_	(1 CPU)

10:02:35      UID       PID   kB_rd/s   kB_wr/s kB_ccwr/s iodelay  Command
10:02:36     1000      2114      0.00     60.00      0.00       0  python3
10:02:37     1000      2114      0.00      2.68      0.00       0  python3
10:02:38     1000      2114      0.00     40.00      0.00       0  python3
10:02:39     1000      2114      0.00     60.00      0.00       0  python3
10:02:40     1000      2114      0.00     40.00      0.00       0  python3
10:02:41     1000      2114      0.00     60.00      0.00       0  python3
^C
Average:     1000      2114      0.00     15.04      0.00       0  python3
```

The first three and the last columns (starting from the second line) are the same as our earlier report.
The new fields are desribed below:

**kB_rd/s**

**kB_wr/s**

**kB_ccwr/s**

**iodelay**


# Memory

```
$ pidstat -p 2114 -r 1
Linux 4.15.0-1020-aws (ip-172-31-7-75) 	08/26/18 	_x86_64_	(1 CPU)

10:03:46      UID       PID  minflt/s  majflt/s     VSZ     RSS   %MEM  Command
10:03:47     1000      2114      0.00      0.00   30196    9004   0.89  python3
10:03:48     1000      2114      0.00      0.00   30196    9004   0.89  python3
10:03:49     1000      2114      0.00      0.00   30196    9004   0.89  python3
10:03:50     1000      2114      0.00      0.00   30196    9004   0.89  python3
10:03:51     1000      2114      0.00      0.00   30196    9004   0.89  python3
10:03:52     1000      2114      0.00      0.00   30196    9004   0.89  python3
^C
Average:     1000      2114      0.00      0.00   30196    9004   0.89  python3
```



# `perf` tools


```
$  sudo perf trace -p 13419
..
 1509.315 ( 0.157 ms): openat(dfd: CWD, filename: 0x8601e010, flags: CREAT|TRUNC|WRONLY, mode: IRUGO|IWUGO) = 3
 1509.545 ( 0.028 ms): fstat(fd: 3</home/vagrant/test.txt>, statbuf: 0x7ffecd7dc2f0          ) = 0
 1509.697 ( 0.017 ms): fstat(fd: 3</home/vagrant/test.txt>, statbuf: 0x7ffecd7dc1b0          ) = 0
 1509.792 ( 0.029 ms): write(fd: 3</home/vagrant/test.txt>, buf: 0x564785fcf800, count: 5    ) = 5
 1509.877 ( 0.009 ms): close(fd: 3</home/vagrant/test.txt>                                   ) = 0
 ```
 
 
 # /proc
 
 
 ```
$ sudo cat /proc/13419/wchan
io_schedule
```

```
ubuntu@ip-172-31-7-75:~$ sudo cat /proc/2114/stack 
[<0>] exit_to_usermode_loop+0x59/0xd0
[<0>] prepare_exit_to_usermode+0x77/0x80
[<0>] retint_user+0x8/0x8
[<0>] 0xffffffffffffffff
```


```
vagrant@default-centos-7-latest:~$ sudo cat /proc/13419/io
rchar: 301204
wchar: 47307880
syscr: 103
syscw: 9461576
read_bytes: 0
write_bytes: 38754615296
cancelled_write_bytes: 0
```



```
 sudo cat /proc/13419/stat
13419 (python) D 1747 13419 1747 34816 14464 4194304 813 0 0 0 12855 60374 0 0 20 0 1 0 90880 26025984 1618 18446744073709551615 94865168269312 94865171395056 140732345993392 0 0 0 0 16781312 2 1 0 0 17 0 0 0 15 0 0 94865173492400 94865173981536 94865190379520 140732345997296 140732345997311 140732345997311 140732345999336 0
```

http://man7.org/linux/man-pages/man5/proc.5.html

https://stackoverflow.com/questions/223644/what-is-an-uninterruptable-process




```
$ cat /proc/25502/smaps | more
55b79e08e000-55b79e38a000 r-xp 00000000 fd:00 664330                     /usr/bin/python2.7
Size:               3056 kB
Rss:                1624 kB
Pss:                1624 kB
Shared_Clean:          0 kB
Shared_Dirty:          0 kB
Private_Clean:      1624 kB
Private_Dirty:         0 kB
Referenced:         1624 kB
Anonymous:             0 kB
LazyFree:              0 kB
AnonHugePages:         0 kB
ShmemPmdMapped:        0 kB
Shared_Hugetlb:        0 kB
Private_Hugetlb:       0 kB
Swap:                  0 kB
SwapPss:               0 kB
KernelPageSize:        4 kB
MMUPageSize:           4 kB
Locked:                0 kB
VmFlags: rd ex mr mw me dw sd
55b79e589000-55b79e58b000 r--p 002fb000 fd:00 664330                     /usr/bin/python2.7
Size:                  8 kB
Rss:                   8 kB
Pss:                   8 kB
Shared_Clean:          0 kB
Shared_Dirty:          0 kB
Private_Clean:         0 kB
Private_Dirty:         8 kB
Referenced:            8 kB
Anonymous:             8 kB
LazyFree:              0 kB
AnonHugePages:         0 kB
ShmemPmdMapped:        0 kB
Shared_Hugetlb:        0 kB
Private_Hugetlb:       0 kB
Swap:                  0 kB
SwapPss:               0 kB
KernelPageSize:        4 kB
MMUPageSize:           4 kB
Locked:                0 kB
```

```
vagrant@default-centos-7-latest:~$ cat /proc/25502/status                                                                                                                                                                                    
Name:   python                                                                                                                                                                                                                               
Umask:  0002                                                                                                                                                                                                                                 
State:  D (disk sleep)                                                                                                                                                                                                                       
Tgid:   25502                                                                                                                                                                                                                                
Ngid:   0                                                                                                                                                                                                                                    
Pid:    25502                                                                                                                                                                                                                                
PPid:   25272                                                                                                                                                                                                                                
TracerPid:      0                                                                                                                                                                                                                            
Uid:    1000    1000    1000    1000                                                                                                                                                                                                         
Gid:    1000    1000    1000    1000                                                                                                                                                                                                         
FDSize: 256                                                                                                                                                                                                                                  
Groups: 4 24 27 30 46 110 115 116 1000 1001                                                                                                                                                                                                  
NStgid: 25502                                                                                                                                                                                                                                
NSpid:  25502                                                                                                                                                                                                                                
NSpgid: 25502                                                                                                                                                                                                                                
NSsid:  25272                                                                                                                                                                                                                                
VmPeak:    25412 kB                                                                                                                                                                                                                          
VmSize:    25412 kB                                                                                                                                                                                                                          
VmLck:         0 kB                                                                                                                                                                                                                          
VmPin:         0 kB                                                                                                                                                                                                                          
VmHWM:      6176 kB                                                                                                                                                                                                                          
VmRSS:      6176 kB                                                                                                                                                                                                                          
RssAnon:            2524 kB                                                                                                                                                                                                                  
RssFile:            3652 kB                                                                                                                                                                                                                  
RssShmem:              0 kB                                                                                                                                                                                                                  
VmData:     3020 kB                                                                                                                                                                                                                          
VmStk:       132 kB                                                                                                                                                                                                                          
VmExe:      3056 kB                                                                                                                                                                                                                          
VmLib:      3644 kB                                                                                                                                                                                                                          
VmPTE:        68 kB                                                                                                                                                                                                                          
VmPMD:        12 kB                                                                                                                                                                                                                          
VmSwap:        0 kB                                                                                                                                                                                                                          
HugetlbPages:          0 kB                                                                                                                                                                                                                  
Threads:        1                                                                                                                                                                                                                            
SigQ:   0/3313                                                                                                                                                                                                                               
SigPnd: 0000000000000000                                                                                                                                                                                                                     
ShdPnd: 0000000000000000                                                                                                                                                                                                                     
SigBlk: 0000000000000000                                                                                                                                                                                                                     
SigIgn: 0000000001001000                                                                                                                                                                                                                     
SigCgt: 0000000180000002                                                                                                                                                                                                                     
CapInh: 0000000000000000                                                                                                                                                                                                                     
CapPrm: 0000000000000000                                                                                                                                                                                                                     
CapEff: 0000000000000000                                                                                                                                                                                                                     
CapBnd: 0000003fffffffff                                                                                                                                                                                                                     
CapAmb: 0000000000000000                                                                                                                                                                                                                     
NoNewPrivs:     0                                                                                                                                                                                                                            
Seccomp:        0                                                                                                                                                                                                                            
Cpus_allowed:   ffff,ffffffff,ffffffff,ffffffff,ffffffff,ffffffff,ffffffff,ffffffff                                                                                                                                                          
Cpus_allowed_list:      0-239                                                                                                                                                                                                                
Mems_allowed:   00000000,00000000,00000000,00000000,00000000,00000000,00000000,00000000,00000000,00000000,00000000,00000000,00000000,00000000,00000000,00000000,00000000,00000000,00000000,00000000,00000000,00000000,00000000,00000000,00000
000,00000000,00000000,00000000,00000000,00000000,00000000,00000001                                                                                                                                                                           
Mems_allowed_list:      0                                                                                                                                                                                                                    
voluntary_ctxt_switches:        725171                                                                                                                                                                                                       
nonvoluntary_ctxt_switches:     5937                                                                                                                                                                                                         
```

https://stackoverflow.com/questions/7880784/what-is-rss-and-vsz-in-linux-memory-management

Learn about PSS:

- https://clearlinux.org/blogs/psstop-chasing-memory-mirages-linux

