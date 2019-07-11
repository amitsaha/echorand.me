---
title:  Setting up OpenVPN client with systemd template unit files
date: 2018-01-12
categories:
-  fedora
aliases:
- /setting-up-openvpn-client-with-systemd-template-unit-files.html
---

First, I installed `openvpn`:

```
$ sudo dnf  -y install openvpn
```

Then, I used the following systemd unit file from [here](https://ask.fedoraproject.org/en/question/113988/openvpn-will-not-start-via-systemd-after-upgrade-to-f25/?answer=114099#post-id-114099) to create a systemd service for creating a new VPN
connection on Fedora 27:

```
$ cat /etc/systemd/system/openvpn@.service 

[Unit]
Description=OpenVPN service for %I
After=syslog.target network-online.target
Wants=network-online.target
Documentation=man:openvpn(8)
Documentation=https://community.openvpn.net/openvpn/wiki/Openvpn24ManPage
Documentation=https://community.openvpn.net/openvpn/wiki/HOWTO

[Service]
Type=notify
PrivateTmp=true
WorkingDirectory=/etc/openvpn/client/%i/
ExecStart=/usr/sbin/openvpn --status %t/openvpn-server/status-%i.log --status-version 2 --suppress-timestamps --cipher AES-256-GCM --ncp-ciphers AES-256-GCM:AES-128-GCM:AES-256-CBC:AES-128-CBC:BF-CBC --config /etc/openvpn/client/%i/%i.conf
CapabilityBoundingSet=CAP_IPC_LOCK CAP_NET_ADMIN CAP_NET_BIND_SERVICE CAP_NET_RAW CAP_SETGID CAP_SETUID CAP_SYS_CHROOT CAP_DAC_OVERRIDE
LimitNPROC=10
DeviceAllow=/dev/null rw
DeviceAllow=/dev/net/tun rw
ProtectSystem=true
ProtectHome=true
KillMode=process
RestartSec=5s
Restart=on-failure

[Install]
WantedBy=multi-user.target
```
The `WorkingDirectory` set as `/etc/openvpn/client/%i` has the client configuration and all the other configuration that I needed. If you nedded support for two VPN connections, we would have two directories here corresponding to each. In my case, the files in my `client/fln`directory are: `vpn.key`, `vpn.crt`, `ca.crt`, `fln.conf` and `tls-auth.key`.

Once I created the unit file, I enabled and started it as follows:

```
$ sudo systemctl enable openvpn@fln.service
$ sudo systemctl start openvpn@fln.service
```

If I had a second configuration, I would do something like:

```
$ sudo systemctl enable openvpn@fln2.service
$ sudo systemctl start openvpn@fln2.service
```

# Troubleshooting

If something goes wrong, you can see the logs via `journalctl`:

```
$ sudo journalctl -u openvpn@fln
..
```

# References

- [Sample systemd unit file for Open VPN](https://ask.fedoraproject.org/en/question/113988/openvpn-will-not-start-via-systemd-after-upgrade-to-f25/?answer=114099#post-id-114099)
- [systemd template unit files](https://fedoramagazine.org/systemd-template-unit-files/)
- [More on systemd template unit files](https://www.digitalocean.com/community/tutorials/understanding-systemd-units-and-unit-files#creating-instance-units-from-template-unit-files)

