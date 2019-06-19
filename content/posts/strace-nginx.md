---
title:  nginx + strace
date: 2019-06-19
categories:
-  software
---

I was debugging a issue where we were getting truncated logs in ElasticSearch 
in the context of a setup as follows:

```
Application Logs -> Fluentd (logging) -> Nginx -> ElasticSearch
```

The original problem turned out to be on the application side, but my first
point of investigation was what are we getting on the nginx side? Do we get the
entire message that we are expecting and something is going on the ElasticSearch
side? To do so, I used `strace`.

## Setup

Install `nginx` using your distribution's package manager. On Fedora, `sudo dnf install nginx`
did it for me. Once installed, start `nginx`:

```
$ sudo systemctl start nginx
```

Test if `nginx` is up and running:

```
$ curl localhost
```

If the above request succeeds, we are good to proceed.

Install `strace` on your system using your package manager. On Fedora, `sudo dnf install strace`
was sufficient.

## Tracing `nginx` request and response

To trace system calls made by `nginx` in the context of handling a request, we will attach to
the nginx process. However, `nginx` [runs](https://www.nginx.com/blog/inside-nginx-how-we-designed-for-performance-scale/) multiple worker processes, 
so which process should we attach to? The solution is to ask `strace` to attach to the master process and ask it 
to trace system calls made by any children forked by the master process.

Let's find out the process ID of the nginx master process:

```
[vagrant@ip-10-0-2-15 ~]$ ps -ef --forest | grep nginx
root      1536     1  0 02:28 ?        00:00:00 nginx: master process /usr/sbin/nginx
nginx     1537  1536  0 02:28 ?        00:00:00  \_ nginx: worker process
```

Now that we have process ID of the master, we will run `strace`:

```
$ sudo strace -p 1536 -s 10000 -v -f
```

An explanation of the various switches are in order:

- `-p`: Process ID to attach to
- `-s`: Maximum string size in bytes, useful for printing arguments in full
- `-v`: Enable unabbreviation of the various function calls, gives us a lot of the details we may want to look
- `-f`: Trace child processes created via `fork()`

(Learn more [here](https://linux.die.net/man/1/strace))

On a new terminal, we will perform a nginx reload operation so that it kills the old
worker process and creates a new one:

```
$ sudo systemctl  reload nginx
```

This is needed since `strace` can only trace children created after we attached to the master process.

Now, on the same new terminal, we can make a request to our nginx server via curl:

```
$ curl --request POST --data '{"key":"value"}' localhost
<html>
<head><title>405 Not Allowed</title></head>
<body>
<center><h1>405 Not Allowed</h1></center>
<hr><center>nginx/1.16.0</center>
</body>
</html>

```

Let's see what we have on the terminal we have `strace` open. The most relevant system calls are:

```
[pid  1661] recvfrom(3, "POST / HTTP/1.1\r\nHost: localhost\r\nUser-Agent: curl/7.64.0\r\nAccept: */*\r\nContent-Length: 15\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\n{\"key\":\"value\"}", 1024, 0, NULL, NULL) = 158

[pid  1661] stat("/usr/share/nginx/html/index.html", {st_dev=makedev(0x8, 0x1), st_ino=923644, st_mode=S_IFREG|0644, st_nlink=1, st_uid=0, st_gid=0, st_blksize=4096, st_blocks=16, st_size=5683, st_atime=1560911325 /* 2019-06-19T02:28:45.355163487+0000 */, st_atime_nsec=355163487, st_mtime=1538675049 /* 2018-10-04T17:44:09+0000 */, st_mtime_nsec=0, st_ctime=1560910132 /* 2019-06-19T02:08:52.339205227+0000 */, st_ctime_nsec=339205227}) = 0

[pid  1661] openat(AT_FDCWD, "/usr/share/nginx/html/index.html", O_RDONLY|O_NONBLOCK) = 4

[pid  1661] fstat(4, {st_dev=makedev(0x8, 0x1), st_ino=923644, st_mode=S_IFREG|0644, st_nlink=1, st_uid=0, st_gid=0, st_blksize=4096, st_blocks=16, st_size=5683, st_atime=1560911325 /* 2019-06-19T02:28:45.355163487+0000 */, st_atime_nsec=355163487, st_mtime=1538675049 /* 2018-10-04T17:44:09+0000 */, st_mtime_nsec=0, st_ctime=1560910132 /* 2019-06-19T02:08:52.339205227+0000 */, st_ctime_nsec=339205227}) = 0

[pid  1661] writev(3, [{iov_base="HTTP/1.1 405 Not Allowed\r\nServer: nginx/1.16.0\r\nDate: Wed, 19 Jun 2019 03:22:14 GMT\r\nContent-Type: text/html\r\nContent-Length: 157\r\nConnection: keep-alive\r\n\r\n", iov_len=157}, {iov_base="<html>\r\n<head><title>405 Not Allowed</title></head>\r\n<body>\r\n<center><h1>405 Not Allowed</h1></center>\r\n", iov_len=104}, {iov_base="<hr><center>nginx/1.16.0</center>\r\n</body>\r\n</html>\r\n", iov_len=53}], 3) = 314
```

The `recvfrom()` call has the HTTP request sent by our `curl` command and the `writev()` call has the HTTP response being
sent to the client.

## Summary

Hope you found this post useful and if you did, you may find this [other post](https://www.elvinefendi.com/2017/03/07/my-experience-with-lua-nginx-openssl-strace-gdb-glibc-and-linux-vm.html) useful too.