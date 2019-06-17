---
title:  Using Travis CI to publish to GitHub pages with custom domain
date: 2018-01-03
categories:
-  software
aliases:
- /using-travis-ci-to-publish-to-github-pages-with-custom-domain.html
---

As of yesterday, this blog is automatically being published via [Travis CI](https://travis-ci.org). 
When I push a new commit to my [GitHub repository](https://github.com/amitsaha/amitsaha.github.io/)
it triggers a new [build](https://travis-ci.org/amitsaha/amitsaha.github.io) in Travis CI. 
The build completes and the the git repository is then
updated with the generated output (mostly HTML with some static CSS). 

The overall flow looks as follows:

![High level flow]({filename}/images/github-travisci-flow.png "GitHub Pages Custom Domain")

This is how I set it all up.

Please see issue [issue](https://github.com/amitsaha/amitsaha.github.io/issues/1).

## Blog repository setup

I use [pelican](http://docs.getpelican.com/en/stable/) as my blog engine. The "source" code for my
blog lives at the [amitsaha.github.io](https://github.com/amitsaha/amitsaha.github.io/)
repository's `site` branch. Besides the content (markdown and restructured text files) and
pelican specific files, the important files related to publishing are:

- `Dockerfile`
- `Makefile`
- `.travis.yml`

The `Dockerfile` is used in Travis for building the site and is as follows:

```
FROM ubuntu:latest

RUN apt-get update && apt-get -y install python3-pip make bash git
RUN pip3 install pelican pelican-youtube markdown pelican-gist
RUN git clone https://github.com/gfidente/pelican-svbhack /tmp/pelican-svbhack
RUN git clone --recursive https://github.com/getpelican/pelican-plugins /tmp/pelican-plugins
WORKDIR /site
ENTRYPOINT ["make", "build"]
```


The `Makefile` has a number of targets, but only the `build` target is currently being used:

```
build:
	$(PELICAN) $(INPUTDIR) -o $(OUTPUTDIR) -s $(PUBLISHCONF) $(PELICANOPTS)
	cp 404.md $(OUTPUTDIR)/
```

The first command generates the site and places the generated files in the `output` sub-directory. In addition
we also copy the `404.md` file to the `output` directory to serve a 
[custom 404](https://help.github.com/articles/creating-a-custom-404-page-for-your-github-pages-site/) page.

The contents of the `output` sub-directory is what we copy to the `master` branch. This is
done via Travis CI via the instructions in the `.travis.yml` file.

To summarize, my blog has two branches:

- `site`: "source" for the blog and other files necessary for generating the HTML for the blog
- `master`: The generated HTML files live in this branch

The generation step is done via Travis and the generated files are pushed to the `master` branch.


## Generating the blog

The `.travis.yml` file is read by Travis CI and is the entry point for what happens when we push a
commit to the `site` branch of the repository. Below I reproduce snippets from the file and their
function.

The blog source is in the site branch  so we want to only build when a push has been made to that branch:

```
branches:
  only:
  - site
git:
  depth: false
```

We also don't bother cloning more than the last commit ([Learn more](https://docs.travis-ci.com/user/customizing-the-build/#Git-Clone-Depth)).


Next, we configure the language and specify that we want to use docker:

```
language: generic
```

The `generic` language ensures that our `.travis.yml` completely controls what commands are run
as part of our build.

We use `docker` to carry out the build and generation. To do so, we have to specify the following:

```
sudo: required
services:
  - docker
```

(To learn more about docker in Travis CI, see [this](https://docs.travis-ci.com/user/docker/))


We then specify the `before_install` and `install` steps. The `before_install` step builds
the docker image:

```
before_install:
  - docker build -t amitsaha/pelican  .
```

The `install` step then creates a container from the image we just built:

```
install:
  - docker run -v `pwd`:/site -t amitsaha/pelican
```

The `install` step runs a container which populates the `output` sub-directory with the generated
files. 

The remaining step is to tell Travis CI's [GitHub pages](https://docs.travis-ci.com/user/deployment/pages/)
"deployer" to deploy the generated output files:

```
deploy:
  provider: pages
  skip_cleanup: true
  github_token: $GITHUB_TOKEN # Set in travis-ci.org dashboard
  on:
    branch: site
  target_branch: master
  local_dir: ${TRAVIS_BUILD_DIR}/output
  fqdn: echorand.me 
```

We we will learn how we set the environment variable, `GITHUB_TOKEN` in a later section.

We basically tell travis CI that we want the build to be done on the `site` branch and the generated
files from the `local_dir` directory to be pushed to the `target_branch` which is `master`.

Setting the `fqdn` to the custom domain updates the repository settings in GitHub and also adds 
a CNAME file in the master branch ([Learn more](https://help.github.com/articles/adding-or-removing-a-custom-domain-for-your-github-pages-site/)). Please see [documentation](https://help.github.com/articles/quick-start-setting-up-a-custom-domain/) on how to setup a custom domain from scratch.

![Travis CI repository settings]({filename}/images/github-pages-custom-domain.png "GitHub Pages Custom Domain")


## Adding the repository to Travis CI

We will then login to [Travis CI](https://travis-ci.org) and follow the [guide](https://docs.travis-ci.com/user/getting-started/)
to add our repository. Under the hood, this step adds a new service integration to our repository. We can see the
integrations at `https://github.com/<username>/<repository>/settings/installations`

If you are logging in for the first time using GitHub (or signing up), you will be presented with the following:

![Travis CI permissions]({filename}/images/travisci-github.png "GitHub Pages Custom Domain")

## Travis CI repository settings

Next, we will configure the repository settings in Travis to add the `GITHUB_TOKEN` environment 
variable and set the value to a generated a personal access token. You can generate one by going to
`https://github.com/settings/tokens` and giving it only the `repo` OAuth 
[scope](https://developer.github.com/apps/building-oauth-apps/scopes-for-oauth-apps/).

![Travis CI repository settings]({filename}/images/travisci-1.png "Repository settings in Travis CI")

## Links

- [Blog github repository](https://github.com/amitsaha/amitsaha.github.io)
- [Travis CI + GitHub Pages](https://docs.travis-ci.com/user/deployment/pages/)
- [GitHub Pages + Custom Domain](https://help.github.com/articles/quick-start-setting-up-a-custom-domain/)

Hope you find the post useful. I reverse engineered this process after having already done all 
the setup, so I may have missed something. Please let me know (*link below*).
