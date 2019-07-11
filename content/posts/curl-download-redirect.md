---
title:  Download a file using `curl` - How hard can it get?
date: 2018-09-14
categories:
-  software
aliases:
- /download-a-file-using-curl-how-hard-can-it-get.html
---

I wanted to download the [prometheus binary](https://prometheus.io/download/) using `curl`. My first attempt:

```
$ curl https://github.com/prometheus/prometheus/releases/download/v2.4.0/prometheus-2.4.0.linux-amd64.tar.gz
<html><body>
You are being <a href="https://github-production-release-asset-2e65be.s3.amazonaws.com/6838921/5c87dc00-b5d1-11e8-8a3a-fd29b54e0c60?X-Amz-Algorithm=AWS4-HMAC-SHA256&amp;X-Amz-Credential=AKIAIWNJYAX4CSVEH53A%2F20180914%2Fus-east-1%2Fs3%2Faws4_request&amp;X-Amz-Date=20180914T004135Z&amp;X-Amz-Expires=300&amp;X-Amz-Signature=5a4887918cf75526c045d236dd5a8b22dace657900a1d131a7ffa947be66fc81&amp;X-Amz-SignedHeaders=host&amp;actor_id=0&amp;response-content-disposition=attachment%3B%20filename%3Dprometheus-2.4.0.linux-amd64.tar.gz&amp;response-content-type=application%2Foctet-stream">redirected</a>.
```

Sure, that's a redirect, let's try:

```
$ curl --location https://github.com/prometheus/prometheus/releases/download/v2.4.0/prometheus-2.4.0.linux-amd64.tar.gz
curl: (23) Failed writing body (0 != 16360)
```

What does that mean? I frantically then google, "download prometheus using curl" and hit upon this 
[link](https://www.techrepublic.com/article/how-to-install-the-prometheus-monitoring-system-on-ubuntu-16-04/).

So, the `-O` option will help:

```
$ curl --remote-name --location https://github.com/prometheus/prometheus/releases/download/v2.4.0/prometheus-2.4.0.linux-amd64.tar.gz
<file downloaded>
```

The `-O` option is equivalent to `--remote-name` which basically says two things:

- Implicitly, save the content to a file
- Use the file part of the remote URL as the local file name

# What's that error above?

The `Failed wrtiting body` error seems to surface in different circumstances. It certainly didn't help my debugging. However,
I was running [WSL](https://docs.microsoft.com/en-us/windows/wsl/install-win10), and a older `curl` version:

```
$ curl --version
curl 7.47.0 (x86_64-pc-linux-gnu) libcurl/7.47.0 GnuTLS/3.4.10 zlib/1.2.8 libidn/1.32 librtmp/2.3
```

On Linux with a newer curl version, the error becomes:

```
$ curl 7.58.0 (x86_64-pc-linux-gnu) libcurl/7.58.0 OpenSSL/1.1.0g zlib/1.2.11 libidn2/2.0.4 libpsl/0.19.1 (+libidn2/2.0.4) nghttp2/1.30.0 librtmp/2.3
Release-Date: 2018-01-24
..

~$ curl --location https://github.com/prometheus/prometheus/releases/download/v2.4.0/prometheus-2.4.0.linux-amd64.tar.gz
Warning: Binary output can mess up your terminal. Use "--output -" to tell
Warning: curl to output it to your terminal anyway, or consider "--output
Warning: <FILE>" to save to a file.
```

That error certainly makes a lot more sense. So basically, error messages are super helpful and software can test you a lot
even when trying to do the simplest of things.
