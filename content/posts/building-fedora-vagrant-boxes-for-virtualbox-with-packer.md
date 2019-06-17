---
title:  Building Fedora Vagrant boxes for VirtualBox using Packer
date: 2018-10-10
categories:
-  fedora
aliases:
- /building-fedora-vagrant-boxes-for-virtualbox-using-packer.html
---

In a [previous post](https://echorand.me/pre-release-fedora-scientific-vagrant-boxes.html), I shared that we are going to have Fedora Scientific Vagrant boxes with the upcoming Fedora 29 release.
Few weeks back, I wanted to try out a more recent build to [script](https://github.com/FedoraScientific/scientific_spin_tests/blob/master/run_tests_vagrant.py) some of the testing I do on Fedora Scientific boxes
to make sure that the expected libraries/programs are installed. Unexpectedly, `vagrant ssh` would not succeed.  
I filed a issue with [rel-eng](https://pagure.io/releng/issue/7814) where I was suggested to see if a package in
Fedora Scientific was mucking around with the SSH config. To do so, I had to find a way to manually build Vagrant
boxes.

The post [here](https://lalatendu.org/2015/11/05/using-imagefactory-to-build-vagrant-imagesi/) seems to be one way
of doing it. Unfortunately, I was in a Windows environment where I wanted to build the box, so I needed to try out
something else. [chef/bento](https://github.com/chef/bento) uses [Packer](https://www.packer.io/docs/builders/amazon-ebs.html)
and hence this approach looked promising.

After creating a [config file](https://github.com/amitsaha/bento/blob/f29/fedora/fedora-29-scientific-x86_64.json) for 
Fedora 29 and making sure I had my kickstart files right, the following command will build a virtual box vagrant image:

```
$ packer build -force -only=virtualbox-iso .\fedora-29-scientific-x86_64.json
```

Once I had the box build environment ready, it was then a matter of a manual commenting/uncomenting out of package/package 
groups to find out the culprit.
