---
title:  Automatic building and publishing DEB packages for Golang applications 
date: 2018-02-24
categories:
-  golang
aliases:
- /automatic-building-and-publishing-deb-packages-for-golang-applications.html
---

In my earlier post, [Quick and dirty debian packages for your Golang application](http://echorand.me/quick-and-dirty-debian-packages-for-your-golang-application.html)
I shared a recipe building DEB packages for Golang applications. We are going to see the following things in this post building
upon our recipe in that post:

- Building the DEB packages in [Travis CI](https://travis-ci.org/amitsaha/golang-packaging-demo)
- Publishing the DEB package to [packagecloud.io](https://packagecloud.io)

The primary assumption in my first post was using [dep](https://golang.github.io/dep/) for dependency management. 
That still holds here.

## Building the DEB packages in Travis CI

To let Travis build the DEB package, we add a `.travis.yml` file to our [git repository](https://github.com/amitsaha/golang-packaging-demo)
with the following contents:

```
# This gives us full control over what we intend to do
# in the job
language: minimal
sudo: required
services:
  - docker
addons:
  apt:
    packages:
      - docker-ce
script:
  - make build-deb DEB_PACKAGE_DESCRIPTION="Logrus Demo" DEB_PACKAGE_NAME=demo BINARY_NAME=demo

```

The recipe I shared in my earlier post used a script, `build-deb-docker.sh` to build the DEB package. We invoked
it via the `Makefile` targte, `build-deb`. We do the same here in the `.travis.yml` file's script section. However,
as opposed to the first post where I was using two separate dockerfiles, I switched to using docker's
[multi stage builds](https://docs.docker.com/develop/develop-images/multistage-build/) feature and hence used
a single Dockerfile. To use this docker feature, I update the `docker` engine to the latest release via the following
above:

```
addons:
  apt:
    ...
```

The above creates the DEB package and places it in the `artifacts` directory.

## Publishing DEB package to packagecloud.io

We have built our package now and we are going to push it to a repository created on [pacakagecloud.io](https://packagecloud.io). The first step is to create a repostiory by logging in - let's call it `logrus-demo`'
and update our `.travis.yml` as follows:

```
deploy:
  provider: packagecloud
  repository: logrus-demo 
  username: amitsaha
  token: "${PACKAGECLOUD_TOKEN}"
  dist: "ubuntu/xenial"   
  local-dir: "./artifacts"
  package_glob: "*.deb"
  skip_cleanup: true
  on:
    branch: master
```

In the above configuration, we specify the packagecloud.io `username`, the API `token`, the `dist` we are publishing
the package for. See [here](https://packagecloud.io/docs#anchor-debian) and [here](https://packagecloud.io/docs#anchor-ubuntu)
to learn more about this. `local-dir` specifies where the packages are and `package_glob` allows us to specify what
file patterns we want to push to the repository. `skip_cleanup` ensures we don't cleanup the working directory
and we restrict the deploy to only happen on pushes to the `master` branch.

We will have add an environment variable, `PACKAGECLOUD_TOKEN` in the Travis CI's repository 
settings (https://travis-ci.org/<github repo>settings) and set it's value to the packagecloud.io API token.
The value of your API token can be found by going to your [packagecloud API token](https://packagecloud.io/api_token) 
page.

At this stage we are all set. If we trigger a new build, it should build the DEB and deploy the package to your
packagecloud.io repository. You should see your package in your repo similar to [mine](https://packagecloud.io/amitsaha/logrus-demo).

## Installing the package

Once the package is pushed, let's try installing it from our packagecloud.io repository. Helpful instructions
are provided on how you can add the repository to your distribution:

![Repository setup]({filename}/images/package_cloud1.png "Repository setup instructions")

Let's try the manual step:


```
root@c9b3de968621:/# curl -s https://packagecloud.io/install/repositories/amitsaha/logrus-demo/script.deb.sh | bash
Detected operating system as Ubuntu/xenial.
Checking for curl...
Detected curl...
Checking for gpg...
Detected gpg...
Running apt-get update... done.
Installing apt-transport-https... done.
Installing /etc/apt/sources.list.d/amitsaha_logrus-demo.list...done.
Importing packagecloud gpg key... done.
Running apt-get update... done.

The repository is setup! You can now install packages.
```

Our package is called `demo`, so let's install it:

```
root@c9b3de968621:/# apt install demo
Reading package lists... Done
Building dependency tree
Reading state information... Done
The following NEW packages will be installed:
  demo
0 upgraded, 1 newly installed, 0 to remove and 20 not upgraded.
Need to get 842 kB of archives.
After this operation, 2483 kB of additional disk space will be used.
Get:1 https://packagecloud.io/amitsaha/logrus-demo/ubuntu xenial/main amd64 demo amd64 0.1-e7b1650 [842 kB]
Fetched 842 kB in 5s (143 kB/s)
debconf: delaying package configuration, since apt-utils is not installed
Selecting previously unselected package demo.
(Reading database ... 5291 files and directories currently installed.)
Preparing to unpack .../demo_0.1-e7b1650_amd64.deb ...
Unpacking demo (0.1-e7b1650) ...
Setting up demo (0.1-e7b1650) ...

```
And let's run it now:

```
$ demo
INFO[0000] I love logrus!

```


## References

- [Get started with Travis CI](https://docs.travis-ci.com/user/getting-started)
- [Quick and dirty debian packages for your Golang application
](http://echorand.me/quick-and-dirty-debian-packages-for-your-golang-application.html)
- [Example repo](https://github.com/amitsaha/golang-packaging-demo)

## Acknowledegements

Thanks [packagecloud.io](https://packagecloud.io) for setting me up with their open source plan!

