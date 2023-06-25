FROM debian:latest

ENV HUGO_VERSION 0.114.1
ENV HUGO_BINARY hugo_${HUGO_VERSION}_Linux-64bit.tar.gz

# Install Hugo
RUN set -x && \
  apt-get -y update && \
  apt-get install -y wget ca-certificates python3-pip git python3-docutils python3-pygments && \
  wget https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/${HUGO_BINARY} && \
  tar xzf ${HUGO_BINARY} && \
  ls * && \
  rm -r ${HUGO_BINARY} && \
  mv hugo /usr/bin/ 

WORKDIR /site
# MAYBE: Fix for https://github.com/amitsaha/echorand.me/actions/runs/4218371717
RUN ["git", "config", "--global", "--add", "safe.directory", "/site"]
ENTRYPOINT ["/usr/bin/hugo"]
