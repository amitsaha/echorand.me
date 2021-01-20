---
title:  Mutual TLS Authentication in Kubernetes
date: 2021-01-15
categories:
-  infrastructure
draft: true
---

I watched this presentation titled [Achieving Mutual TLS: Secure Pod-to-Pod Communication Without the Hassle](https://www.usenix.org/conference/srecon20americas/presentation/hahn)
and that led me to explore a bit more on the state of Mutual TLS in Kubernetes. Here are some notes with explorations and
references I came across that helped me learn more.

I will be using a cluster provisioned via [minikube](https://github.com/kubernetes/minikube)

## What is Mutual TLS Authentication?

Okay, so first up what is it that we are trying to solve?

When you type in https://echorand.me in your browser, the "https" allows the client to verify the identify of
the server:

1. You type in https://echorand.me
2. The server hosting the website presents the client (your browser) with a TLS certificate and a public key
3. The client (your browser) trusts the certificate authority that issued the certificate
4. You see my blog contents

However, you see there is no verification on part of the server - i.e. server doesn't have any way
to check whether the client (your browser) should be allowed to communicate with the server even. For
a blog or a public website, that's not really required, but what if you were setting up a service
oriented architecture and you absolutely want to ensure that you have a way to verify that service A
is allowed to talk to service B and vice-versa. That's where mutual TLS authentication comes in.

When the client communicates with the server, there is a two-way verification:

1. Server verifies that the client's identity is recognized and valid
2. Client verifies that the server's identity is recognized and valid

This [article](https://medium.com/sitewards/the-magic-of-tls-x509-and-mutual-authentication-explained-b2162dec4401) is a good post
to learn just enough about mutual TLS.

Before we dive into looking into the state of mutual TLS in Kubernetes, let's familiarize ourselves with the the
cluster root certificate authority

## Cluster root certificate authority

The primary bit of information we should know when discussing about mutual TLS in Kubernetes is the
presence of the [cluster root certificate authority](https://kubernetes.io/docs/tasks/tls/managing-tls-in-a-cluster/)
which is used by all the cluster components to communicate with the master. This also means that 


curl https://kubernetes.default
curl: (60) SSL certificate problem: unable to get local issuer certificate
More details here: https://curl.haxx.se/docs/sslcerts.html

curl failed to verify the legitimacy of the server and therefore could not
establish a secure connection to it. To learn more about this situation and
how to fix it, please visit the web page mentioned above.



$ curl --cacert ./ca.crt https://kubernetes.default
{
  "kind": "Status",
  "apiVersion": "v1",
  "metadata": {
    
  },
  "status": "Failure",
  "message": "forbidden: User \"system:anonymous\" cannot get path \"/\"",
  "reason": "Forbidden",
  "details": {
    
  },
  "code": 403
}

/var/run/secrets/kubernetes.io/serviceaccount


## Create a server certificate signed by the root CA

https://github.com/cloudflare/cfssl

## Create a client certificate signed by the root CA

## ..


