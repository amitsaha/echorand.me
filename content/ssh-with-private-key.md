---
title: Using a specific SSH private key
date: 2019-09-05
categories:
-  infrastructure
---

# How do I specify a specifc private key with `rsync`?

```
$ rsync <other options> -e "ssh -i <your private key>" <src> <destination>

```

Answer from [here](https://unix.stackexchange.com/a/127355)

# How do I specify a specific private key with `git`?

```
$ GIT_SSH_COMMAND="ssh -i <your key file>" git <command>
```
