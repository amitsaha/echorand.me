---
title:  Notes on using Go to write gitbackup
date: 2017-03-26
categories:
-  golang
aliases:
- /notes-on-using-golang-to-write-gitbackup.html
---

`gitbackup <https://github.com/amitsaha/gitbackup>`__ is a tool to backup your git repositories from GitHub and GitLab. I wrote the `initial version <https://github.com/amitsaha/gitbackup/releases/tag/lj-0.1>`__ as a project for a go article which is in review for publication in a Linux magazine. It supports GitHub enterprise installations and custom GitLab installations in addition to repositories on github.com and gitlab.com. It's written in Golang, and built upon `go-github <https://github.com/google/go-github>`__ and `go-gitlab <https://github.com/xanzy/go-gitlab>`__ and other third party golang packages.

Since the initial version, the project's code has seen number of changes which has been a learning experience for me since I am still fairly new to Go. In the rest of this post, I describe these and some personal notes about the experience.

Using afero for filesystem operations
=====================================

``gitbackup`` needs to do some basic filesystem operations - create directories and check for existence of directories. In the initial version, I was using the ``os`` package directly which meant any test invoking the code which performed these operations were actually performing those on the underlying filesystem. I could of course
perform cleanup after these tests so that my filesystem would not remain polluted. However, then I decided to check what `afero <https://github.com/spf13/afero>`__ had to offer. It had exactly what I needed - a memory backed filesystem (`NewMemMapFs`).This `section <https://github.com/spf13/afero#using-afero-for-testing>`__ in the project homepage was all I needed to switch to using `afero` instead of `os` package drirectly. And hence I didn't need to worry about cleaning up my filesystem after a test run or worry about starting from a known clean state!

To show some code, this is the `git diff` of introducing `afero` and switching out direct use of `os`:

.. code:: diff

    diff --git a/src/gitbackup/main.go b/src/gitbackup/main.go
    index 500d9a2..6e71beb 100644
    --- a/src/gitbackup/main.go
    +++ b/src/gitbackup/main.go
    @@ -3,6 +3,7 @@ package main
     import (
            "flag"
            "github.com/mitchellh/go-homedir"
    +       "github.com/spf13/afero"
            "log"
            "os"
            "os/exec"
    @@ -14,6 +15,7 @@ import (
     var MAX_CONCURRENT_CLONES int = 20

     var execCommand = exec.Command
    +var appFS = afero.NewOsFs()
     var gitCommand = "git"

     // Check if we have a copy of the repo already, if
    @@ -22,7 +24,7 @@ func backUp(backupDir string, repo *Repository, wg *sync.WaitGroup) ([]byte, err
            defer wg.Done()

            repoDir := path.Join(backupDir, repo.Name)
    -       _, err := os.Stat(repoDir)
    +       _, err := appFS.Stat(repoDir)

            var stdoutStderr []byte
            if err == nil {
    @@ -83,7 +85,7 @@ func main() {
            } else {
                    *backupDir = path.Join(*backupDir, *service)
            }
    -       _, err := os.Stat(*backupDir)
    +       _, err := appFS.Stat(*backupDir)
            if err != nil {
                    log.Printf("%s doesn't exist, creating it\n", *backupDir)
                    err := os.MkdirAll(*backupDir, 0771)

When we declare `appFS` above outside all functions, it becomes a package level
variable and we set it to `NewOsFs()` and replace function calls such as `os.Stat` by `appFS.Stat()`. Since the variable name starts with a small letter, this variable is not visible outside the package.

Then, in the test, I will do:

.. code:: go

    appFS = afero.NewMemMapFs()

Hence, all operations will happen in the memory based filesystem rather than the "real" underlying filesystem.

Testing shell commands
======================

One of the first roadblocks to writing tests I faced was how to test functions which were invoking external programs (``git`` in this case). This post here titled `Testing os/exec.Command <https://npf.io/2015/06/testing-exec-command/>`__ had my answer. However, it took me a while to correctly apply it. And that post is still the reference if you want to understand what's going on.

Here's basically what I did:

.. code:: go

    var execCommand = exec.Command
    ..

    func backUp(backupDir string, repo *Repository, wg *sync.WaitGroup) ([]byte, error) {
        ...
        if err == nil {
            ..
            cmd := execCommand(gitCommand, "-C", repoDir, "pull")
            ..
        } else {
            ..
            cmd := execCommand(gitCommand, "clone", repo.GitURL, repoDir)
            ..
        }
        ...
    }

We declare a package variable, ``execCommand`` which is intialized with ``exec.Command`` from the ``os/exec`` package. Then, in the tests, I do the following:

.. code:: go

    func TestHelperCloneProcess(t *testing.T) {
        if os.Getenv("GO_WANT_HELPER_PROCESS") != "1" {
            return
        }
        // Check that git command was executed
        if os.Args[3] != "git" || os.Args[4] != "clone" {
            fmt.Fprintf(os.Stdout, "Expected git clone to be executed. Got %v", os.Args[3:])
            os.Exit(1)
        }
        os.Exit(0)
    }


    func fakeCloneCommand(command string, args ...string) (cmd *exec.Cmd) {
        cs := []string{"-test.run=TestHelperCloneProcess", "--", command}
        cs = append(cs, args...)
        cmd = exec.Command(os.Args[0], cs...)
        cmd.Env = []string{"GO_WANT_HELPER_PROCESS=1"}
        return cmd
    }

    execCommand = fakeCloneCommand
    stdoutStderr, err := backUp(backupDir, &repo, &wg)

The above is a test for the case where a repository is being backed up for the first
time via ``git clone``. In the test, before I call the ``backUp()`` function which actually executes the command, I set ``execCommand = fakeCloneCommand`` so to that ``execCommand`` doesn't point to ``os.execCommand`` any more. ``fakeCloneCommand``, instead of executing ``git clone`` executes ``TestHelperCloneProcess``, where we also check if the command being attempted to execute was ``git clone``.

We similarly test the operation of a repository's backup being updated via ``git pull``.

Switching from ``gb`` to standard go tooling
============================================

When I was started to write ``gitbackup``, I was still in two minds about whether I like the idea of the standard ``go`` tools' requirements of having every Go project in ``$GOPATH``. Hence, I decided to go with `gb <https://getgb.io>`__ because it removed that requirement, as well as allowed me to have a easy way to vendor the third party dependencies and manage them.

However, as I worked on ``gitbackup`` and was finally close to having release binaries, I decided to move away from using ``gb`` and also try out `go dep <https://github.com/golang/dep>`__ for dependency management.

This involved two steps. The first was moving all the source from ``src/gitbackup`` to the top level directory (`commit <https://github.com/amitsaha/gitbackup/commit/e1932c41eac249a0d3dd8b9e6d6b026cdb663cce>`__). Then, I removed the ``vendor`` directory created by ``gb`` (`commit <https://github.com/amitsaha/gitbackup/commit/654f52f0cf1cec7bb1fd994bbc75fd8839a2d43c>`__), and used ``dep init`` to create a new ``vendor`` directory, the ``lock.json`` file and ``manifest.json`` file. And that's all!

Creating release binaries
=========================

At this stage, ``gitbackup`` could be installed with ``go get``, but I wanted to have binaries made available with the 0.1 release. I looked at a few alternatives, but finally I decided upon a bash script (copied from the fish script of `oklog <https://github.com/oklog/oklog/blob/master/release.fish>`__).

The following script snippet builds binaries for multiple OS and architectures:

.. code::

	for pair in linux/386 linux/amd64 linux/arm linux/arm64 darwin/amd64 dragonfly/amd64 freebsd/amd64 netbsd/amd64 openbsd/amd64 windows/amd64; do
		GOOS=`echo $pair | cut -d'/' -f1`
		GOARCH=`echo $pair | cut -d'/' -f2` 
		OBJECT_FILE="gitbackup-$VERSION-$GOOS-$GOARCH"
		GOOS=$GOOS GOARCH=$GOARCH go build -o "$DISTDIR/$OBJECT_FILE" 
	..
	done

I was very excited about being able to build binaries for different operating systems and architectures via ``go build``!

Setting up continious testing for Linux, OS X and Windows
=========================================================

I also setup Travis CI for running the tests on Linux and OS X:

.. code::

  language: go
  os:
    - linux
    - osx
  go: 
    - 1.7
    - 1.8

  install: true
  script:
	- cd $GOPATH/src/github.com/amitsaha/gitbackup/
	- go build
	- go test -v

For running tests on Windows via Appveyor, I have the following ``appveyor.yml``:

.. code::

    version: "{build}"

    # Source Config
    clone_folder: c:\gopath\src\github.com\amitsaha\gitbackup

    # Build host

    environment:
      GOPATH: c:\gopath
      matrix:
        - environment:
          GOVERSION: 1.7.5
        - environment:
          GOVERSION: 1.8

    # Build

    install:
      # Install the specific Go version.
      - rmdir c:\go /s /q
      - appveyor DownloadFile https://storage.googleapis.com/golang/go%GOVERSION%.windows-amd64.msi
      - msiexec /i go%GOVERSION%.windows-amd64.msi /q
      - set Path=c:\go\bin;c:\gopath\bin;%Path%
      - go version
      - go env

    build: off

    test_script:
      - cd c:\gopath\src\github.com\amitsaha\gitbackup
      - go build -o bin\gitbackup.exe 
      - go test -v

Ending notes
============

``gitbackup`` is mainly an educational project to build a tool which I and hopefully others find useful. I wanted to have reasonable test coverage for it, release binaries for multiple operating systems and architecture and have continuous testing setup on multiple operatng systems. So far, all of these has been successfully achieved.I am looking forward to using ``go dep`` more as I get a chance and also happy about making ``gitbackup`` compatible with standard go tools out of the box.

If you get a chance, please `try it out <https://github.com/amitsaha/gitbackup#gitbackup---backup-your-github-and-gitlab-repositories>`__ and I welcome any feedback and contributions!


