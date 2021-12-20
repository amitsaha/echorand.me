set -e
docker build -t amitsaha/echorandme-publisher .
docker run -v `pwd`:/site -t amitsaha/echorandme-publisher --debug

