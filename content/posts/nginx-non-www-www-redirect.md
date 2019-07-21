---
title: Nginx - redirecting non-www to www hostnames
date: 2019-07-19
categories:
-  infrastructure
---

# Introduction

I wanted a Nginx configuration which would satisfy the following requirements:

1. Any `example.com` requests should be redirected to `www.example.com`
2. The above should happen for `http` and `https`
3. `http://example.com` should redirect directly to `https://www.example.com`

# Solution

We will need four server blocks:

1. http - example.com (listen on 80)
2. http - www.example.com (listen on 80)
3. https - example.com (listen on 443)
4. https - www.example.com (listen on 443)

I obviously went through a bit of hit and trial, but my main issue was around how I would setup (3) correctly. Since (3) is https,
I needed to setup it up like (4) pointing it to the right SSL cert and key. 

The following Nginx configuration will achieve it:

```
upstream yourupstream {
  server 127.0.0.1:8080;
}

server {
  listen 80;
  server_name example.com;
  return 301 https://www.example.com$request_uri;
}

server {
  listen 80;
  server_name www.example.com;
  return 301 https://$host$request_uri;

}

server {

  listen 443;
  server_name example.com;
  include /etc/nginx/custom_configs/tls_settings;
  ssl_certificate /etc/nginx/ssl/certificate;
  ssl_certificate_key /etc/nginx/ssl/keyfile;
  include /etc/nginx/custom_configs/log_settings;
  return 301 https://www.example.com$request_uri;
}


server {

  listen 443;
  server_name www.example.com;
  include /etc/nginx/custom_configs/tls_settings;
  ssl_certificate /etc/nginx/ssl/certificate;
  ssl_certificate_key /etc/nginx/ssl/keyfile;  

  location / {
    include /etc/nginx/conf.d/proxy_settings;
    proxy_pass http://myupstream;
  }
}

```

# Learn more

I got help from the following resources:

- [Understanding Nginx configuration file structure and configuration contexts](https://www.digitalocean.com/community/tutorials/understanding-the-nginx-configuration-file-structure-and-configuration-contexts)
- [Nginx essentials](https://www.digitalocean.com/community/tutorials/nginx-essentials-installation-and-configuration-troubleshooting)

# Related posts

If you like this post, you may also like my other posts on Nginx:

- [Nginx and geoip lookup with geoip2 module]({{< ref "nginx-geoip2-mmdblookup.md" >}})
- [Nginx + strace]({{< ref "strace-nginx.md" >}})
