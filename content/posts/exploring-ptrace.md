---
title:  Exploring ptrace
date: 2018-09-27
categories:
-  software
aliases:
- /exploring-ptrace.html
draft: true
---


In this post, we will explore the [ptrace](http://man7.org/linux/man-pages/man2/ptrace.2.html) system call on Linux.
`ptrace()` makes it possible for one process - a `tracer` to observe and even manipulate what another
process - the `tracee` is doing. It allows us to do various complicated and fun things. Let's start our exploration!

Since, the Kernel version may matter, here's mine (on a Ubuntu 18.04 system):

```
$ uname -a
Linux vagrant 4.15.0-29-generic #31-Ubuntu SMP Tue Jul 17 15:39:52 UTC 2018 x86_64 x86_64 x86_64 GNU/Linux
```

## Stopping a process

In our first exploration, we will stop the `tracee` from our `tracer` with the help of `ptrace()`.

Let's consider the following C program - our `tracer`:


```
// tracer.c

#include <sys/ptrace.h>
#include <stdlib.h>
#include <stdio.h>

int main(int argc, char **argv)
{
    long ptrace_status;

    pid_t tracee_pid;
    tracee_pid = atoi(argv[1]);
    ptrace_status = ptrace(PTRACE_ATTACH, tracee_pid, 0, 0);

    if (ptrace_status == -1) {
        perror("Error attaching to process");
    }

    return 0;
}
```

Our `tracee` is a Python program:

```
# tracee.py
import time
import os

print(f"Starting. PID: {os.getpid()}")
while True:
    print("Hello")
    time.sleep(5)
```

The only job our tracee has is to print `Hello`, sleep for 5 seconds and then repeat the same for
its lifetime.

On terminal 1 run the `tracee`:

```
$ python3 tracee.py
Starting. PID: 20790
Hello
Hello
```

On terminal 2, compile the `tracer`, and run it giving the above PID as the first argument:
```
$ gcc -o tracer tracer.c
$ ./tracer 20790
Error attaching to process: Operation not permitted
$ sudo ./tracer 20790
```

(We will come back to the permission issue later on)

Our tracer will exit, and on the Terminal 1 where our tracee was running, we will see:

```
[1]+  Stopped                 python3 tracee.py
```

Now, from Terminal 2, we will send the `SIGCONT` signal to our process as follows:

```
$ kill -SIGCONT 20790
```

Back to Terminal 1, and we should see our tracee alive again:

```
$ Hello
Hello
Hello
Hello
...
```

You can use job control command, `fg` and then kill the `tracee`:

```
$ fgHello

python3 tracee.py

^CTraceback (most recent call last):
  File "tracee.py", line 7, in <module>
    time.sleep(20)
KeyboardInterrupt
```

### PTRACE_ATTACH
