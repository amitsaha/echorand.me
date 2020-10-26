FROM debian:latest

ENV HUGO_VERSION 0.76.5
ENV HUGO_BINARY hugo_extended_${HUGO_VERSION}_Linux-64bit.tar.gz

# Install Hugo
RUN set -x && \
  apt-get -y update && \
  apt-get install -y wget ca-certificates python3-pip git && \
  wget https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/${HUGO_BINARY} && \
  tar xzf ${HUGO_BINARY} && \
  ls * && \
  rm -r ${HUGO_BINARY} && \
  mv hugo /usr/bin/ && \
  pip3 install docutils pygments

WORKDIR /site
ENTRYPOINT ["/usr/bin/hugo"]
