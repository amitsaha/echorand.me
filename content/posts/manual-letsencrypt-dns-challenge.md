---
title:  Let's Encrypt, GoDadday DNS and IIS server
date: 2018-11-08
categories:
-  infrastructure
aliases:
- /lets-encrypt-godadday-dns-and-iis-server.html
---

I wanted to create a new SSL certificate for IIS hosted ASP.NET framework application. The key data that may
make this post relevant to you are:

- Let's Encrypt Challenge mode: DNS TXT record
- DNS provider: GoDaddy
- Target web server: IIS
- Target operating system: Windows
- Local operating environment/system: Linux (including Windows Subsystem for Linux).

# Why I chose certbot?

I decided to use [certbot](https://certbot.eff.org/) since it allowed me do create the DNS TXT entries manually. This
was the first time I was doing this and I just wanted to get an idea of what's involved. To me it seemed like a two
step approach:

- Place a request to Let's Encrypt for a SSL certification for a domain
- Validate via DNS challenge that I own the domain

I wanted to do the second step manually.

Two other projects I looked at were [lego](https://github.com/xenolf/lego) and [win-acme](https://github.com/PKISharp/win-acme). While writing this post, I found out that `lego` has inbuilt support for `godadday` DNS, 
so I could have used it to create the DNS TXT record automatically. However, it didn't seem to have the "manual" mode
I was after. `win-acme` needed hooks to be provided for the DNS challenge, which seemed like another thing to do 
at the moment - meaning, writing the hooks.

# Generating the certificate

Once you have installed `certbot`:

```
$ certbot certonly --manual --preferred-challenges dns -d <your domain> --config-dir . --logs-dir . --work-dir .
```

The program will pause displaying:

```
Please deploy a DNS TXT record under the name
_acme-challenge.<your domain> with the following value:
random$string
Before continuing, verify the record is deployed.
```

Now, go to your GoDaddy DNS management page, and create the TXT record with the specified string. Be sure not to enter
the entire domain name as the record if you are doing this for a sub-domain. For example, if you are doing this for
`api.<your-domain>`, the record should just be `_acme-challenge.api`.  

Once you  have verified that the domain entry has propagated, press ENTER to continue. To verify, use `nslookup -q=TXT <domain>`
on Windows, or `dig -t` on Linux.

Once the record has propagated, certbot will try to find it, and if successful continue and eventually give an 
output like this:

```
IMPORTANT NOTES:

 - Congratulations! Your certificate and chain have been saved at:
   /home/asaha/letsencrypt/live/<your domain>/fullchain.pem
   Your key file has been saved at:
   /home/asaha/letsencrypt/live/<your domain>/privkey.pem
   ...
```

# Importing into IIS

The directory created will have a bunch of files. We will next create a .pfx file for importing into IIS using `openssl`:

```
$ openssl pkcs12 -export -out certificate.pfx -inkey privkey.pem -in cert.pem -certfile chain.pem
Enter Export Password:
Verifying - Enter Export Password:
```

The resultant file will be certificate.pfx. Now, copy the `certificate.pfx` file to the target IIS box and import
it using this handy [guide](https://www.digicert.com/ssl-support/pfx-import-export-iis-7.htm).

# Using with `traefik`

If you are generating the certificates manually for `traefik` reverse proxy, the `cert.pem` file is the public
certificate and the `privkey.pem` file is the private key.

# Automating

The next step is to attempt to automate the certificate generation process using `lego` and perhaps some Powershell [glue](https://docs.microsoft.com/en-us/powershell/module/pkiclient/?view=win10-ps) to import the certificate and change/setup
IIS site binding with the new certificate.
