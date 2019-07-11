---
title:  Notes on using Cloudflare DNS over HTTPS 
date: 2018-04-10
categories:
-  infrastructure
aliases:
- /notes-on-using-cloudflare-dns-over-https.html
---


I recently learned about Cloudflare's [1.1.1.1](https://developers.cloudflare.com/1.1.1.1/) DNS service. One of the more
interesting things that caught my attention there was DNS over HTTPS. That is, we can do this:

```
22:27 $ http 'https://cloudflare-dns.com/dns-query?ct=application/dns-json&name=echorand.
me'
HTTP/1.1 200 OK
CF-RAY: 409535ca3b3765bd-SYD
Connection: keep-alive
Content-Length: 281
Content-Type: application/dns-json
Date: Tue, 10 Apr 2018 12:27:53 GMT
Server: cloudflare-nginx
Set-Cookie: __cfduid=dfb12106907c3b55c52b27b8ea99e185a1523363273; expires=Wed, 10-Apr-19 12:27:53 GMT; path=/; domain=.cloudflare-dns.com; HttpOnly; Secure
cache-control: max-age=285

{
    "AD": false,
    "Answer": [
        {
            "TTL": 285,
            "data": "192.30.252.153",
            "name": "echorand.me.",
            "type": 1
        },
        {
            "TTL": 285,
            "data": "192.30.252.154",
            "name": "echorand.me.",
            "type": 1
        }
    ],
    "CD": false,
    "Question": [
        {
            "name": "echorand.me.",
            "type": 1
        }
    ],
    "RA": true,
    "RD": true,
    "Status": 0,
    "TC": false
}


```

Then, I setup a local [DNS over HTTPS](https://developers.cloudflare.com/1.1.1.1/dns-over-https/cloudflared-proxy/) server for all my
DNS resolution by using the `cloudflared` client. This server sets up a local DNS server running on 127.0.0.1 port 53,
listening to your DNS queries and then proxying them over HTTPS to 1.1.1.1:

```
$ sudo tcpdump -i lo0 udp port 53 -vvv22:41 $ sudo tcpdump -i lo0 udp port 53 -vvv

22:41:20.170401 IP (tos 0x0, ttl 64, id 49987, offset 0, flags [none], proto UDP (17), length 67, bad cksum 0 (->b964)!)
    localhost.49432 > localhost.domain: [bad udp cksum 0xfe42 -> 0xa134!] 39712+ [1au] A? hello1.com. ar: . OPT UDPsize=4096 (39)
22:41:23.130960 IP (tos 0x0, ttl 64, id 6562, offset 0, flags [none], proto UDP (17), length 67, bad cksum 0 (->6306)!)
    localhost.domain > localhost.49432: [bad udp cksum 0xfe42 -> 0x20dc!] 39712 ServFail q: A? hello1.com. 0/0/1 ar: . OPT UDPsize=1536 (39)
^C
6
...
```

In another terminal session, `tcpdump` on traffic to/from 1.1.1.1 will show up as:


```
22:31 $ sudo tcpdump host 1.1.1.1
tcpdump: data link type PKTAP
tcpdump: verbose output suppressed, use -v or -vv for full protocol decode
listening on pktap, link-type PKTAP (Apple DLT_PKTAP), capture size 262144 bytes
22:32:09.795071 IP 10.1.1.8.63821 > 1dot1dot1dot1.cloudflare-dns.com.https: Flags [P.], seq 90707220:90707265, ack 994494030, win 8192, length 45
2
...
```

The `cloudfared` server also exports prometheus metrics:

```
22:57 $ curl 127.0.0.1:64617/metrics | grep coredns | grep count
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100  9795  100  9795    0     0   797k      0 --:--:-- --:--:-- --:--:--  797k
# HELP coredns_dns_request_count_total Counter of DNS requests made per zone, protocol and family.
# TYPE coredns_dns_request_count_total counter
coredns_dns_request_count_total{family="1",proto="udp",zone="."} 242
coredns_dns_request_duration_seconds_count{zone="."} 242
coredns_dns_request_size_bytes_count{proto="udp",zone="."} 242
# HELP coredns_dns_request_type_count_total Counter of DNS requests per type, per zone.
# TYPE coredns_dns_request_type_count_total counter
coredns_dns_request_type_count_total{type="A",zone="."} 217
coredns_dns_request_type_count_total{type="AAAA",zone="."} 25
# HELP coredns_dns_response_rcode_count_total Counter of response status codes.
# TYPE coredns_dns_response_rcode_count_total counter
coredns_dns_response_rcode_count_total{rcode="NOERROR",zone="."} 236
coredns_dns_response_rcode_count_total{rcode="NXDOMAIN",zone="."} 4
coredns_dns_response_rcode_count_total{rcode="SERVFAIL",zone="."} 2
coredns_dns_response_size_bytes_count{proto="udp",zone="."} 242
..
```


# Firefox and DNS over HTTPS (DOH)

Another interesting bit of information I learned about was Mozilla's plan to integrate DNS over HTTPS in their Firefox
browser. This [article](https://www.ghacks.net/2018/03/20/firefox-dns-over-https-and-a-worrying-shield-study/) has the
details.

Update: This is another [article](https://hacks.mozilla.org/2018/05/a-cartoon-intro-to-dns-over-https/) from Mozilla on DNS and their work with Cloudflare and another [article](https://daniel.haxx.se/blog/2018/06/03/inside-firefoxs-doh-engine/) discussing more on making
DNS more secure.


