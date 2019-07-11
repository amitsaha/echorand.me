---
title:  Quick and dirty debian packages for your Golang application 
date: 2018-01-25
categories:
-  golang
aliases:
- /quick-and-dirty-debian-packages-for-your-golang-application.html
---

In this post, we will learn about a quick and easy workflow for
building and deploying your golang applications as Debian packages.
The packages produced will not be official quality DEB packages.


# Assumptions

I have been using [dep](https://golang.github.io/dep/) for dependency management, and I assume that
you are doing the same. Other dependency management solutions should
work with only the specific bits of the workflow swapped out to suit
the one you may be using. I also assume that you have `make` and 
a recent `golang` toolset installed, and use `git` as your 
version control. 

If you want to integrate my workflow into an existing project, 
please skip ahead to the second use case and then read back.

# Use case #1: New golang application project

Create a new directory which will be the home of our new project.
Since we are going to use [dep](https://golang.github.io/dep/), it has to be somewhere in our
`GOPATH`. In my case, I will assume it is in 
`$GOPATH/src/github.com/amitsaha/packaging-demo`. The first file,
I will create is a `main.go` which looks like this:

```
package main

import (
	log "github.com/sirupsen/logrus"
)

func main() {
	log.Info("I love logrus!")
}
```

This is a simple program, but it uses a thirdy party package
[logrus](https://github.com/sirupsen/logrus) (which is awesome btw).

**Workflow - Step #1**

Now, we come to the first step of our workflow - create a file 
called `Makefile` with the following contents:

```
GOPATH := $(shell go env GOPATH)
GODEP_BIN := $(GOPATH)/bin/dep
GOLINT := $(GOPATH)/bin/golint
VERSION := $(shell cat VERSION)-$(shell git rev-parse --short HEAD)

packages = $$(go list ./... | egrep -v '/vendor/')
files = $$(find . -name '*.go' | egrep -v '/vendor/')

ifeq "$(HOST_BUILD)" "yes"
	# Use host system for building
	BUILD_SCRIPT =./build-deb-host.sh
else
	# Use docker for building
	BUILD_SCRIPT = ./build-deb-docker.sh
endif


.PHONY: all
all: lint vet test build 

$(GODEP):
	go get -u github.com/golang/dep/cmd/dep

Gopkg.toml: $(GODEP)
	$(GODEP_BIN) init

vendor:         # Vendor the packages using dep
vendor: $(GODEP) Gopkg.toml Gopkg.lock
	@ echo "No vendor dir found. Fetching dependencies now..."
	GOPATH=$(GOPATH):. $(GODEP_BIN) ensure

version:
	@ echo $(VERSION)

build:          # Build the binary
build: vendor
	test $(BINARY_NAME)
	go build -o $(BINARY_NAME) -ldflags "-X main.Version=$(VERSION)" 

build-deb:      # Build DEB package (needs other tools)
	test $(BINARY_NAME)
	test $(DEB_PACKAGE_NAME)
	test "$(DEB_PACKAGE_DESCRIPTION)"
	exec ${BUILD_SCRIPT}
	
test: vendor
	go test -race $(packages)

vet:            # Run go vet
vet: vendor
	go tool vet -printfuncs=Debug,Debugf,Debugln,Info,Infof,Infoln,Error,Errorf,Errorln $(files)

lint:           # Run go lint
lint: vendor $(GOLINT)
	$(GOLINT) -set_exit_status $(packages)
$(GOLINT):
	go get -u github.com/golang/lint/golint

clean:
	test $(BINARY_NAME)
	rm -f $(BINARY_NAME) 

help:           # Show this help
	@fgrep -h "#" $(MAKEFILE_LIST) | fgrep -v fgrep | sed -e 's/\\$$//' | sed -e 's/#//'
```

**Workflow - Step #2**

Next, we will create a file called `VERSION` in the project 
directory and write a string such as `0.1` into it:

```
$ echo "0.1" > VERSION
```

This will be our major version.

**Workflow - Step #3**

Initialize a git repository in the application directory:

```
$ git init
```

And we will make a first commit:

```
$ git add -A .
$ git commit -m "Initial commit"
```

**Workflow - Step #4**

Let's first try and see what our `Makefile` allows us to do:

```
$ make help
vendor:          Vendor the packages using dep
build:           Build the binary
build-deb:       Build DEB package (needs other tools)
vet:             Run go vet
lint:            Run go lint
help:            Show this help
```

Let's now use the `build` target to build a binary of our application:

```
$ make build BINARY_NAME=demo
/home/asaha/go/bin/dep init
  Using ^1.0.4 as constraint for direct dep github.com/sirupsen/logrus
  Locking in v1.0.4 (d682213) for direct dep github.com/sirupsen/logrus
  Locking in master (3d37316) for transitive dep golang.org/x/crypto
  Locking in master (af9a212) for transitive dep golang.org/x/sys
No vendor dir found. Fetching dependencies now...
GOPATH=/home/asaha/go:. /home/asaha/go/bin/dep ensure
test demo
go build -o demo -ldflags "-X main.Version=0.1-c3c6990"
```

Let's now run the `demo` binary that was created for us:

```
$ ./demo
INFO[0000] I love logrus!
```

Great! We have built a binary of our application and since it is
a statically linked binary, we are ready to deploy it to our 
servers - after one last step.


**Workflow - Step #5**

To package the application binary as a debian package, we will
use [fpm](https://github.com/jordansissel/fpm). At this stage, my workflow supports any of the
following approaches:

- Install `fpm` on our host system
- Use `docker`

The second approach has the advantage that it will work the same
anywhere once you have `docker` engine installed and running.

If you don't care about using `docker`, create a file, `build-deb-host.sh` with the following contents and mark it as executable:

```
#!/bin/bash
set -xe

BUILD_ARTIFACTS_DIR="artifacts"
version=`git rev-parse --short HEAD`
VERSION_STRING="$(cat VERSION)-${version}"


# check all the required environment variables are supplied
[ -z "$BINARY_NAME" ] && echo "Need to set BINARY_NAME" && exit 1;
[ -z "$DEB_PACKAGE_NAME" ] && echo "Need to set DEB_PACKAGE_NAME" && exit 1;
[ -z "$DEB_PACKAGE_DESCRIPTION" ] && echo "Need to set DEB_PACKAGE_DESCRIPTION" && exit 1;

if which go; then
    make build BINARY_NAME=${BINARY_NAME}
    echo "Binary built. Building DEB now."
else
    echo "golang not installed or not reachable"
    exit 1
fi

mkdir -p $BUILD_ARTIFACTS_DIR && cp $BINARY_NAME $BUILD_ARTIFACTS_DIR
if which fpm; then
    fpm --output-type deb \
      --input-type dir --chdir /$BUILD_ARTIFACTS_DIR \
      --prefix /usr/bin --name $BINARY_NAME \
      --version $VERSION_STRING \
      --description '${DEB_PACKAGE_DESCRIPTION}' \
      -p ${DEB_PACKAGE_NAME}-${VERSION_STRING}.deb \
      $BINARY_NAME && cp *.deb /$BUILD_ARTIFACTS_DIR/
    rm -f $BUILD_ARTIFACTS_DIR/$BINARY_NAME
else
    echo "fpm not installed or not reachable"
    exit 1
fi
```

Now, we can build a debian package as follows:

```
$ make build-deb DEB_PACKAGE_DESCRIPTION="Logrus Demo" DEB_PACKAGE_NA
ME=demo BINARY_NAME=demo HOST_BUILD=yes
...
```

You will see the resulting debian package in `ARTIFCATS` sub-directory.

In addition or to have a way to build debians where you don't
want to worry about having to install golang toolchain or fpm
manually, `docker` comes to the rescue. We will create the following
additional files:

`Dockerfile-go`:

```
FROM golang:1.9
RUN go get -u github.com/golang/dep/cmd/dep
ENV PACKAGE_PATH $GOPATH/src/git.host/mypackage
RUN mkdir -p  $PACKAGE_PATH
COPY . $PACKAGE_PATH
WORKDIR $PACKAGE_PATH
ARG version_string
ARG binary_name
RUN dep ensure && go build -o $GOPATH/bin/${binary_name} -ldflags "-X main.Version=${version_string}" && cp $GOPATH/bin/${binary_name} /${binary_name}
ENTRYPOINT "/${binary_name}"
```

`Dockerfile-fpm`:

```
FROM ruby:2.3
RUN  gem install --quiet --no-document fpm

ARG binary_name
ARG deb_package_name
ARG version_string
ARG deb_package_description

RUN mkdir /deb-package
ADD $binary_name /deb-package/
RUN mkdir dpkg-source
WORKDIR dpkg-source
RUN fpm --output-type deb \
  --input-type dir --chdir /deb-package \
  --prefix /usr/bin --name $binary_name \
  --version $version_string \
  --description '${deb_package_description}' \
  -p ${deb_package_name}-${version_string}.deb \
  $binary_name && cp *.deb /deb-package/
CMD ["/bin/bash"]
```

`build-deb-docker.sh`:

```
#!/bin/bash
set -xe

if ! which docker; then
    echo "docker engine not installed"
    exit 1
fi
# Check if we have docker running and accessible
# as the current user
# If not bail out with the default error message
docker ps

BUILD_IMAGE='amitsaha/golang-binary-builder'
FPM_IMAGE='amitsaha/golang-deb-builder'
BUILD_ARTIFACTS_DIR="artifacts"

version=`git rev-parse --short HEAD`
VERSION_STRING="$(cat VERSION)-${version}"


# check all the required environment variables are supplied
[ -z "$BINARY_NAME" ] && echo "Need to set BINARY_NAME" && exit 1;
[ -z "$DEB_PACKAGE_NAME" ] && echo "Need to set DEB_PACKAGE_NAME" && exit 1;
[ -z "$DEB_PACKAGE_DESCRIPTION" ] && echo "Need to set DEB_PACKAGE_DESCRIPTION" && exit 1;


docker build --build-arg \
    version_string=$VERSION_STRING \
    --build-arg \
    binary_name=$BINARY_NAME \
    -t $BUILD_IMAGE -f Dockerfile-go .
containerID=$(docker run --detach $BUILD_IMAGE)
docker cp $containerID:/${BINARY_NAME} .
sleep 1
docker rm $containerID

echo "Binary built. Building DEB now."

docker build --build-arg \
    version_string=$VERSION_STRING \
    --build-arg \
    binary_name=$BINARY_NAME \
    --build-arg \
    deb_package_name=$DEB_PACKAGE_NAME  \
    --build-arg \
    deb_package_description="$DEB_PACKAGE_DESCRIPTION" \
    -t $FPM_IMAGE -f Dockerfile-fpm .
containerID=$(docker run -dt $FPM_IMAGE)
# docker cp does not support wildcard:
# https://github.com/moby/moby/issues/7710
mkdir -p $BUILD_ARTIFACTS_DIR
docker cp $containerID:/deb-package/${DEB_PACKAGE_NAME}-${VERSION_STRING}.deb $BUILD_ARTIFACTS_DIR/.
sleep 1
docker rm -f $containerID
rm $BINARY_NAME
```

We can build the debian package with:

```
$ make build-deb DEB_PACKAGE_DESCRIPTION="Logrus Demo" DEB_PACKAGE_NA
ME=demo BINARY_NAME=demo
...
```

The resulting debian package will be in the `artifacts/` 
sub-directory.

# Use case #2: Existing golang application project

If you want to use the proposed workflow in an existing golang
application project, you will have to carry out all the workflow
steps above other than step #3. In addition, since we also be
switching to use [dep](https://golang.github.io/dep/) as the package management program, 
you will need to remove the `vendor` or similar directory, and
any other metadata files that may be related to the package
management tool you are migrating from.

# Example project

An example project with the above files is at 
[golang-packaging-demo](https://github.com/amitsaha/golang-packaging-demo). The files in the project are:

```
16:55 $ tree -L 1
.
├── build-deb-docker.sh
├── build-deb-host.sh
├── Dockerfile-fpm
├── Dockerfile-go
├── Gopkg.lock
├── Gopkg.toml
├── main.go
├── Makefile
└── VERSION
```

The most important files above are:

- `build-deb-docker.sh`
- `build-deb-host.sh`
- `Dockerfile-fpm`
- `Dockerfile-go`
- `Makefile`
- `VERSION`

These files are generic and should work for any golang application project once they are dropped in alongwith the application code. The
assumptions in the beginning of course hold - the primary one being
the use of [dep](https://github.com/jordansissel/fpm) as the package management tool.


You may be interested in the extension of this post in [Automatic building and publishing DEB packages for Golang applications](http://echorand.me/automatic-building-and-publishing-deb-packages-for-golang-applications.html)


# Resources

- [Dep](https://golang.github.io/dep/)
- [Daily Dep](https://golang.github.io/dep/docs/daily-dep.html)
- [Help Makefile target](https://gist.github.com/prwhite/8168133)
