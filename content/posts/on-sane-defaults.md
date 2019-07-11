---
title:  On sane defaults in sofware tools
date: 2018-10-26
categories:
-  software
aliases:
- /on-sane-defaults-in-sofware-tools.html
---

My task at hand was simple. Build a Docker image of a ASP.NET application (full framework) hosted in IIS on
a build host (**host1**) and move it to a deployment host (**host2**) and run it. This is a story of how I spent 
close to two full working days trying to debug a simple issue which sane default behavior of a tool would have cut it to 
seconds.

# Key details

The key details that are important to my story are:

- **host1** and **host2** lives in two different AWS VPC subnets
- Web application talks to various external services when the homepage is hit
- **host2** has access to these services, and **host1** does not.


# Observations on build host

I built the image on build host, and ran it in a docker container, like so:

```
$ docker run -d test/image
```

My web application is configured to run on port 51034. From the host, I find out the container IP using `docker inspect`
and make a GET request using PowerShell's `curl` (whic is basically aliased to `Invoke-WebRequest`):

```
$ curl -UseBasicParsing http://ip:51034
```

I get back errors saying there was a error in connecting to the external services. This is expected, since
**host1** doesn't have connectivity to these services.

Great, so I push the docker image to AWS ECR.

# Observations on deployment host

I pull the image from ECR, and run it, as above. Then I try to make the same request as above:

```
> curl IP:51034
curl : Unable to connect to the remote server
At line:1 char:1
+ curl 172.29.170.207:51034
+ ~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (System.Net.HttpWebRequest:HttpWebRequest) [Invoke-WebRequest], WebException
    + FullyQualifiedErrorId : WebCmdletWebResponseException,Microsoft.PowerShell.Commands.InvokeWebRequestCommand
```

Okay, sure may be there is some issue with the web application. To look further, I `docker exec` into the container
and check with `netstat`, if the server is listening on 51034. It checks out. I then try to do the same request as
above, but from inside the container and I get back a `200`. Note that the application now has connectivity
to the external services, so `200` is an expected response.


# Debugging

Alright, so what is going on? I get a "unable to connect to the remote server" from outside on the deployment host, but
that same request works from inside the container. On top of that, accessing the application externally worked on the
build host. So it is not a issue with the application not binding to all the interfaces and such.

I chased a lot of false tails - all of them outside the application code itself. One of the key tail I chased 
was a step in my Docker startup script, I was performing a couple of configuration transformations where I was 
overriding default AppSetting and ConnectionStrings values with environment specific ones. Numerous attempts
revelaed that it was one of these transformations that was causing the issue on **host2**. Eventually, at the end 
it turned out that in that transformation, a configuration value that was being set which the application was 
using to force a redirect to a HTTPS connection if the client request was not coming from localhost.
Since my IIS site was not actually configured to recieve HTTPS connections, it was bailing out.

This also makes sense, because on the deployment host, the IIS logs were showing a 301 in case of the request coming from
outside the container - done in the application. If only, my client would be tell me about the redirect.

# On Sane defaults

So, let's talk about what could have helped me debug this in seconds. When I replace the "fake" curl by the [real
curl](https://curl.haxx.se/windows/):

```
PS C:\Users\Administrator\work\curl> .\curl-7.61.1-win64-mingw\bin\curl.exe  172.29.170.207:51034
<html><head><title>Object moved</title></head><body>
<h2>Object moved to <a href="https://localhost:51034/">here</a>.</h2>
</body></html>
```

See what I see above? I see that there is a redirect being issued to `https://`. That's a sane default I am talking about.
Dont' redirect me automatically, tell me  I am being redirected. That would have been sufficient for me to investigate
into the issue I was having.

(Ignore the "localhost" above, that was my fault in the configuration - that doesn't change the error I get from
"fake" curl)

It turns out "fake" curl has a `MaximumRedirection` parameter which when set to 0 gives me the same behavior as real curl:

```
PS C:\Users\Administrator\work\curl> curl -UseBasicParsing 172.29.170.207:51034 -Verbose -MaximumRedirection 0
VERBOSE: GET http://172.29.170.207:51034/ with 0-byte payload
VERBOSE: received 141-byte response of content type text/html; charset=utf-8


StatusCode        : 301
StatusDescription : Moved Permanently
Content           : <html><head><title>Object moved</title></head><body>
                    <h2>Object moved to <a href="https://localhost:51034/">here</a>.</h2>
                    </body></html>

RawContent        : HTTP/1.1 301 Moved Permanently
                    X-Content-Type-Options: nosniff
                    X-UA-Compatible: IE=Edge,chrome=1
                    Content-Length: 141
                    Content-Type: text/html; charset=utf-8
                    Date: Fri, 26 Oct 2018 02:38:00 GMT
                    Lo...
Forms             :
Headers           : {[X-Content-Type-Options, nosniff], [X-UA-Compatible, IE=Edge,chrome=1], [Content-Length, 141], [Content-Type, text/html; charset=utf-8]...}
Images            : {}
InputFields       : {}
Links             : {@{outerHTML=<a href="https://localhost:51034/">here</a>; tagName=A; href=https://localhost:51034/}}
ParsedHtml        :
RawContentLength  : 141

curl : The maximum redirection count has been exceeded. To increase the number of redirections allowed, supply a higher value to the -MaximumRedirection parameter.
At line:1 char:1
+ curl -UseBasicParsing 172.29.170.207:51034 -Verbose -MaximumRedirecti ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (System.Net.HttpWebRequest:HttpWebRequest) [Invoke-WebRequest], InvalidOperationException
    + FullyQualifiedErrorId : MaximumRedirectExceeded,Microsoft.PowerShell.Commands.InvokeWebRequestCommand
```

Good bye fake curl. I am switching to real curl the first time I see such a weird issue next time.

# Summary of the problem

On **host1**, since the application was not able to talk to the external services, the application was returning
an error before it had reached the point to force the HTTPS redirect. On **host2**, since it could talk to these
services, it reached the code where it was forcing the HTTPS redirect and things took its own course from there.
Why the application server was doing the job of forcing HTTPS instead of in IIS is a whole other question.


