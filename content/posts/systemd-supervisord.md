---
title:  Doing something before systemd shuts your supervisord down
date: 2018-01-12
categories:
-  infrastructure
aliases:
- /doing-something-before-systemd-shuts-your-supervisord-down.html
---

If you are running your server applications via [supervisord](http://supervisord.org/) on a Linux distro running 
[systemd](https://www.freedesktop.org/wiki/Software/systemd/), you may find this post useful.

# Problem Scenario

An example scenario to help us establish the utility for this post is as follows:

- `systemd` starts the shutdown process
- `systemd` stops `supervisord`
- `supervisord` stops your processes
- You see in-flight requests being dropped


# Solution

What we want to do is **prevent** in-flight requests being dropped when a system is shutting down as part of
a power off cycle (AWS instance termination, for example). We can do so in two ways:

1. Our server application is intelligent enough to not exit (and hence halt instance shutdown) if a request is in progress
2. We hook into the shutdown process above so that we stop new requests from coming in once the shutdown process has started and give our application server enough time to finish doing what it is doing.

The first approach has more theoretical "guarantee" around what we want, but can be hard to implement correctly. In fact,
I couldn't get it right even after trying all sorts of signal handling tricks. Your mileage may vary of course and if you
have an example you have, please let me know.

So, I went ahead with the very unclean second approach:

- Register a shutdown "hook" which gets invoked when `systemd` wants to stop `supervisord`
- This hook takes the service instance out of the healthy pool
- The proxy/load balancer detects the above event and stops sending traffic
- As part of the "hook", after we have gotten ourself out of the healthy service pool, we sleep for an arbitary time so that
existing requests can finish

When you are using a software like [linkerd](https://linkerd.io/) as your RPC proxy, even long-lived connections are not a problem since
`linkerd` will see that your service instance is unhealthy, so it will not proxy any more requests to it.


# Proposed solution implementation

The proposed solution is a systemd unit - let's call it `drain-connections` which is defined as follows:

```
#  cat /etc/systemd/system/drain-connections.service

[Unit]
Description=Shutdown hook to run before supervisord is stopped
After=supervisord.service networking.service
PartOf=supervisord.service
Conflicts=shutdown.target reboot.target halt.target

[Service]
Type=oneshot
RemainAfterExit=true
ExecStart=/bin/true
ExecStop=/usr/local/bin/consul maint -enable
ExecStop=/bin/sleep 300

TimeoutSec=301

[Install]
WantedBy=multi-user.target
```

Let's go over the key systemd directives used above in the `Unit` section:

1. `After` ensures that `drain-connections` is started after `supervisord`, but stopped before `supervisord`
2. `PartOf` ensures that `drain-connections` is stopped/restarted whenever `supervisord` is stopped/restarted

The `Service` section has the following key directives:

1. `Type=oneshot` (learn more about it [here](https://www.freedesktop.org/software/systemd/man/systemd.service.html#Type=))
2. The first `ExecStop` first takes the service instance out of the pool by enabling `consul` maintenance mode
3. The second `ExecStop` then gives our application 300 seconds to stop finishing what it is currently doing
4. The `TimeoutSec` parameter override `systemd` default timeout of 90 seconds to 301 seconds so that the earlier sleep
   of 300 seconds can finish
   

In addition, we setup `supervisord` systemd unit override as follows:

```
# /etc/systemd/system/supervisord.service.d/supervisord.conf

[Unit]
Wants=drain-connections.service
```

This ensures that `drain-connections` service gets started when `supervisord` is started.

# Discussion

Let's see how the above fits in to our scenario:

- `systemd` starts the shutdown process and tries to stop `supervisord`
- This triggerd `drain-connections` to be stopped where we have the commands we want to be executed
- The above commands will take the instance out of the pool and sleep for an arbitrary period of time
- `drain-connections` finishes "stopping"
- `systemd` stops `supervisord`
- shutdown proceeds

What if `drain-connections` is stopped first? That is okay, because that will execute the necessary commands
we would want to be executed. Then, `supervisord` can be stopped which will stop our application server, but
the `drain-connections` unit has already done its job by that time.
