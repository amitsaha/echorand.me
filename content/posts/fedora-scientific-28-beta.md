---
title:  Fedora Scientific 28 Beta
date: 2018-04-09
categories:
-  fedora
aliases:
- /fedora-scientific-28-beta.html
---

Fedora 28 beta was announced [recently](https://fedoramagazine.org/announcing-fedora-28-beta/) and I am happy to say
[Fedora Scientific](https://labs.fedoraproject.org/prerelease) is back. 

One note though, the following applications/libraries are not part of the release:

- `networkx`
- `scilab`
- `sagemath`
- `rkward`

You can install them on your installation using:

```
$ sudo dnf install python*-networkx scilab sagemath rkward
```

The reason for the above software to be not installed was some failures to install the packages which is why I commented
those out so that we can have a release. The package maintainers have since fixed the issue (thank you!) and hence
you can install them now. Hopefully, they will back with the Fedora Scientific 29 release.

The [Fedora Scientific Guide](http://fedora-scientific.readthedocs.io/en/latest/) has more about what's included in Fedora
Scientific.

