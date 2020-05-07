---
title: How to Set up Log Forwarding in a Kubernetes Cluster Using Fluent Bit
date: 2020-05-07
categories:
-  infrastructure
---


## Introduction

Log forwarding is an essential ingredient of a production logging pipeline in any organization.
As an application author, you don't want to be bothered with the responsibility of ensuring the
application logs are being processed a certain way and then stored in a central log storage.
As an operations personnel, you don't want to have to hack your way around different applications
to process and ship logs. Essentially, log forwarding decouples the application
emitting logs and what needs to be done with those logs. This decoupling only works of course, if the
logs emitted by the application is in a format (JSON for example) understood by the log forwarder. The
job of the log forwarder is thus to read logs from one or multiple sources, perform any  processing on
it and then forward them to a log storage system or another log forwarder.

Setting up log forwarding in a Kubernetes cluster allows all applications and system services that
are deployed in the cluster to automatically get their logs processed and stored in a preconfigured
central log storage. The application authors only need to ensure that their logs are being emitted
to the standard output and error streams.

There are various options when it comes to selecting a log forwarding software. Two of the most popular ones
are [fluentd](https://www.fluentd.org) and [logstash](https://www.elastic.co/products/logstash). A relatively
new contender is [fluentbit](https://docs.fluentbit.io/manual/). It is written in C which makes it very lightweight
in terms of its resource consumption as compared to both `fluentd` and `logstash`. This makes it an excellent
alternative. Fluent bit has a pluggable architecture and supports a large collection of input sources, multiple ways
to process the logs and a wide variety of output targets.

The following figure depicts the logging architecture we will setup and the role of fluent
bit in it:

![Fluent bit in a logging pipeline](https://i.imgur.com/MWs2Ggr.png)

In this tutorial, we will setup fluent bit (release 1.3.8) as a Kubernetes [daemonset](https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/) which will
ensure that we will have a fluent bit instance running on every node of the cluster. The fluent bit
instance will be configured to automatically read the logs of all pods running on the node as well as read
the system logs from the systemd journal. These logs will be read by fluent bit, one line at a time, processed
as per the configuration we specify and then forwarded to the configured output, Elasticsearch. After
setting up fluent bit, we will deploy a Python web application and demonstrate how the logs
are automatically parsed, filtered and forwarded to be searched and analyzed.

## Prerequisites

The article assumes that you have the following setup:

- Docker installed locally and a free Docker hub account to push docker image
- A Kubernetes cluster with RBAC enabled
  - One node with 4vCPUs, 8 GB RAM and 160 GB disk should be sufficient to work through this tutorial
- `kubectl` installed locally and configured to connect to the cluster

If you do not have an existing Elasticsearch cluster reachable from the Kubernetes cluster, you can follow 
steps 1-3 of [this guide](https://www.digitalocean.com/community/tutorials/how-to-set-up-an-elasticsearch-fluentd-and-kibana-efk-logging-stack-on-kubernetes) to run your own Elasticsearch cluster in Kubernetes.


## Step 0 - Checking Your Kibana and Elasticsearch Setup

If you are using an already available Elasticsearch cluster, you can skip this step.

If you followed the above guide to setup Kibana and Elasticsearch, let's check all the pods related to 
elasticsearch and kibana are running in the `kube-logging` namespace:

```command
kubectl get pods -n kube-logging
```

You'll see the following output:
```
NAME                      READY   STATUS    RESTARTS   AGE
es-cluster-0              1/1     Running   0          2d23h
es-cluster-1              1/1     Running   0          2d23h
es-cluster-2              1/1     Running   0          2d23h
kibana-7946bc7b94-9gq47   1/1     Running   0          2d22h
```

Before we move on let's setup access to Kibana from our local workstation using port forwarding:

```command
kubectl -n kube-logging port-forward pod/kibana-7946bc7b94-9gq47 5601:5601
```

You will see the following output:

```
Forwarding from 127.0.0.1:5601 -> 5601
Forwarding from [::1]:5601 -> 5601
```

The Kibana pod name will be different for your case, so make sure to use the correct pod name.
Once the port forwarding is setup, go to `http://127.0.0.1:5601/` to access kibana.

We have successfully set up elasticsearch and kibana in the cluster. At this stage, there is no data in elasticsearch as there is nothing sending logs to it. Let's fix that and setup fluent bit.


**Note**: Keep the above port forward running in a terminal session and use a new terminal session for
running the commands in the the rest of the tutorial.

## Step 1 — Setting Up Fluent Bit Service Account and Permissions

In Kubernetes, it is considered a best practice to use dedicated [service account](https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/)
to run pods. Hence, we will setup a new service account for fluent bit daemonset:

First create a new logging directory:

```command
mkdir logging
```
Now inside that directory make a `fluent-bit` directory:

```command
mkdir logging/fluent-bit
```
Within the `fluent-bit` directory create and open a `service-account.yaml` file to create a dedicated service account:

```command
nano logging/fluent-bit/service-account.yaml
```

Add the following content to the file:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: fluent-bit
  namespace: kube-logging
```

Save and close the file.

The two key bits of information here are under the `metadata` field:

- `name`: The service account will be called `fluent-bit`
- `namespace`: The service account will be created in the `kube-logging` namespace created as part of the last prerequisite


Let's create the service account:

```command
kubectl apply -f logging/fluent-bit/service-account.yaml
```
You should see the following output:

```
serviceaccount/fluent-bit created
```

One of the useful features of fluent bit is that it automatically associates various kubernetes metadata to
the logs before it sends it to the configured destination. To allow the fluent bit service account to read
these metadata by making API calls to the Kubernetes server, we will associate this service account
with a set of permissions. This will be implemented by creating a cluster role and a cluster role binding.

Within the `logging/fluent-bit` directory create and open a `role.yaml` file to create a cluster role:

```command
nano logging/fluent-bit/role.yaml
```

Add the following content to the file:


```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: fluent-bit-read
rules:
- apiGroups: [""]
  resources:
  - namespaces
  - pods
  verbs: ["get", "list", "watch"]

```

Save and close the file.

A `ClusterRole` is a specification of the permissions of the API operations that we want to grant to the
`fluent-bit` service account. The role is called `fluent-bit-read` specified by the `name` field inside `metadata`.
Inside `rules`, we specify that we want to allow all `get`, `list` and `watch` verbs on `pods` and `namespaces`
across the core API group.

To create the `ClusterRole`:

```command
kubectl apply -f logging/fluent-bit/role.yaml
```

You should see the following output:

```
clusterrole.rbac.authorization.k8s.io/fluent-bit-read created
```

The second and final step in granting the `fluent-bit` service account the necessary permissions is to
create a cluster role binding to associate the `fluent-bit-role` we created above with the `fluent-bit`
service account in the `kube-logging` namespace.

Within the `logging/fluent-bit` directory create and open a `role-binding.yaml` file to create a cluster
role binding:

```command
nano logging/fluent-bit/role-binding.yaml
```

Add the following content to the file:


```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: fluent-bit-read
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: fluent-bit-read
subjects:
- kind: ServiceAccount
  name: fluent-bit
  namespace: kube-logging

```
Save and close the file.

We are creating a `ClusterRoleBinding` named `fluent-bit-read`, specified via the `name` field inside metadata.
We specify the cluster role we are binding to via the `roleRef` field. The `apiGroup` refers to the API
group for kubernetes RBAC  resource `rbac.authorization.k8s.io`, the `Kind` of role we are binding to
is a `ClusterRole` and the `name` of the role we are binding to is `fluent-bit-read`. The service account
we are creating the binding for is specified in `subjects`. We specify that we want to create the binding to the `fluent-bit` service account in the `kube-logging` namespace.

Run the following command to create the role binding:

```command
kubectl apply -f logging/fluent-bit/role-binding.yaml
```

You should see the following output:

```
clusterrolebinding.rbac.authorization.k8s.io/fluent-bit-read created
```

In this step, we have created a `fluent-bit` service account in the `kube-logging` namespace and given it
permissions to read various metadata about the pods and namespaces in the cluster. Fluent bit needs these permissions
to associate metadata to the logs such as pod labels and namespace a log is originating from.

Next, we will create a `ConfigMap` resource to specify configuration for fluent bit.


## Step 2 — Creating a ConfigMap for Fluent Bit

To configure fluent bit we will create a configmap specifying various configuration sections and attributes.
parameters. When we create  the daemonset, Kubernetes will make this config map available as files to
fluent bit at startup. We will create three versions of this `ConfigMap` as we progress through this
tutorial. We will create the first version now.

Within the `logging/fluent-bit` directory create and open a `configmap-1.yaml` file:

```command
nano logging/fluent-bit/configmap-1.yaml
```
Add the following content to the file:

```
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
  namespace: kube-logging
  labels:
    k8s-app: fluent-bit
data:
  fluent-bit.conf: |
    [SERVICE]
        Flush         1
        Log_Level     info
        Daemon        off
        Parsers_File  parsers.conf

    @INCLUDE input-kubernetes.conf
    @INCLUDE output-elasticsearch.conf
```

The manifest specifies that we are creating a `ConfigMap` - `fluent-bit-config` in the `logging`
namespace. `data` specifies the actual contents of the `ConfigMap` which is composed
of three files - `fluent-bit.conf`, `input-kubernetes.conf`, `output-elasticsearch.conf`
and `parsers.conf`. The `fluent-bit.conf` is the primary configuration file read by
fluent bit at startup. This file then uses the `@INCLUDE` specifier to include other
configuration files - `input-kubernetes.conf` and `output-elasticsearch.conf` in this case.
The `parsers.conf` file is referred to in the `fluent-bit.conf` file and is expected to be
in the same directory as the `fluent-bit.conf` file.

Let's look at the `fluent.bit.conf` file contents:

```
[SERVICE]
        Flush         1
        Log_Level     info
        Daemon        off
        Parsers_File  parsers.conf
```

The `[Service]` section of a fluent bit configuration [specifies configuration](https://docs.fluentbit.io/manual/service)
 regarding the fluent bit engine itself. Here we specify the following options:

- `Flush`: This specifies how often (in seconds) fluent bit will flush the output
- `Log_Level`: This specifies the kind of logs we want fluent bit to emit. Other possible choices are `error`, `warning`, `debug` and `trace`.
- `Daemon`: If this set to `true`, this will make `fluent-bit` go to background on start.
- `Parsers_File`: This specifies the file where fluent bit will look up for a specified parser (discussed later)

Next, add the following contents to the file at the same nesting level as `fluent-bit.conf`:

```yaml
 ...
 input-kubernetes.conf: |
    [INPUT]
        Name              tail
        Tag               kube.*
        Path              /var/log/containers/*.log
        Parser            docker
        DB                /var/log/flb_kube.db
        Mem_Buf_Limit     5MB
        Skip_Long_Lines   On
        Refresh_Interval  10
```
The `input-kubernetes.conf` file's contents uses the `tail` input plugin (specified via `Name`) to
read all files matching the pattern `/var/log/containers/*.log` (specified via `Path`):

Let's look at the other fields in the configuration:

- `Tag`: All logs read via this input configuration will be tagged with `kube.*`.
- `Parser`: We specify that each line that fluent bit reads from the files should be parsed via a parser named `docker`
- `DB`: This is a path to a local SQlite database that fluent bit will use to keep records related to the files it's reading
- `Mem_Buf_Limit`: Set a maximum memory limit that fluent bit will allow the buffer to grow to before it flushes the output
- `Skip_Long_Lines`: Setting this to `On` ensures that if a certain line in a specific monitored file exceeds a configurable max buffer size, it
will skip that line and continue reading the file.
- `Refresh_Interval`: When a pattern is specified, this is the time interval in seconds, fluent bit will refresh the file list it monitors.

You can learn more about the tail input plugin [here](https://docs.fluentbit.io/manual/input/tail).

Next, add the following contents to the file at the same nesting level as `input-kubernetes.conf`:

```yaml
  ...
  output-elasticsearch.conf: |
    [OUTPUT]
        Name            es
        Match           *
        Host            ${FLUENT_ELASTICSEARCH_HOST}
        Port            ${FLUENT_ELASTICSEARCH_PORT}
        Logstash_Format On
        Logstash_Prefix fluent-bit
        Retry_Limit     False
```

The above configuration will create the output configuration in the file `output-elasticsearch.conf`.
We specify that we want to use [es](https://docs.fluentbit.io/manual/output/elasticsearch) output
plugin in the `Name` field. The `Match` field specifies the tag pattern of log messages that
will be sent to the output being configure — the `*` pattern matches all logs. Next, we specify
the hostname and port for the elasticsearch cluster via the `Host` and `Port` fields respectively.
Note how we can use the `FLUENT_ELASTISEARCH_HOST` and `FLUENT_ELASTICSEARCH_PORT` environment variables
that we specify in the `DaemonSet` in the fluent bit configuration. Being able to use environment variables
as values in the configuration files is a feature of fluent bit's configuration system. We then specify
that we want to use the `Logstash_Format` for the elasticsearch indexes that fluent bit will create.
This will create the index in the format `logstash-YYYY.MM.DD` where `YYYY.MM.DD` is the date when
the index is being created. The `Logstash_Prefix` field can be specified to change the  default `logstash` prefix
to something else, like `fluent-bit`. The logstash format is useful when you are using a tool like
elasticsearch [curator](https://www.elastic.co/guide/en/elasticsearch/client/curator/current/index.html)
to manage cleanup of your elasticsearch indices.

The `Retry_Limit` is a generic output configuration that specifies the retry behavior of
[fluent bit](https://docs.fluentbit.io/manual/configuration/scheduler#configuring-retries) if there is a failure
in sending logs to the output destination.

Finally, add the following contents to the file at the same nesting level as `ouput-elasticsearch.conf`:

```yaml
  ...
  parsers.conf: |
    [PARSER]
        Name        docker
        Format      json
        Time_Key    time
        Time_Format %Y-%m-%dT%H:%M:%S.%L
        Time_Keep   On
```

When a parser name is specified in the input section, fluent bit will lookup the parser in the specified
`parsers.conf` file. Above, we define a parser named `docker` (via the `Name` field) which we want to use to
parse a docker container's logs which are JSON formatted (specified via `Format` field). The `Time_Key`
specifies the field in the JSON log that will have the timestamp of the log, `Time_Format` specifes
the format the value of this field should be parsed as and `Time_Keep` specifies whether the original
field should be preserved in the log. The fluent bit documentation has [more information](
https://docs.fluentbit.io/manual/parser) on these fields.

Save and close the file.

The final content of the file should look as follows:


```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
  namespace: kube-logging
  labels:
    k8s-app: fluent-bit
data:
  fluent-bit.conf: |
    [SERVICE]
        Flush         1
        Log_Level     info
        Daemon        off
        Parsers_File  parsers.conf

    @INCLUDE input-kubernetes.conf
    @INCLUDE output-elasticsearch.conf
  input-kubernetes.conf: |
    [INPUT]
        Name              tail
        Tag               kube.*
        Path              /var/log/containers/*.log
        Parser            docker
        DB                /var/log/flb_kube.db
        Mem_Buf_Limit     5MB
        Skip_Long_Lines   On
        Refresh_Interval  10

  output-elasticsearch.conf: |
    [OUTPUT]
        Name            es
        Match           *
        Host            ${FLUENT_ELASTICSEARCH_HOST}
        Port            ${FLUENT_ELASTICSEARCH_PORT}
        Logstash_Format On
        Logstash_Prefix fluent-bit
        Retry_Limit     False

  parsers.conf: |
    [PARSER]
        Name        docker
        Format      json
        Time_Key    time
        Time_Format %Y-%m-%dT%H:%M:%S.%L
        Time_Keep   On

```

Let's now create the first version of the `ConfigMap`:

```command
kubectl apply -f logging/fluent-bit/configmap-1.yaml
```

You should see the following output:

```
configmap/fluent-bit-config created
```


In this step, we have created a `fluent-bit-config` config map in the `kube-logging` namespace. It specifies
where we want the logs to be read from, how we want to process it and where to send them off to after processing.
We will use it to configure the fluent bit daemonset which we look at next.

## Step 3 — Creating the Fluent Bit Daemonset

A Daemonset will be used to run one fluent bit pod per node of the cluster. Within the `logging/fluent-bit`
directory create and open a `daemonset.yaml` file:

```command
nano logging/fluent-bit/daemonset.yaml
```

Add the following content to the file:

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluent-bit
  namespace: kube-logging
spec:
  selector:
    matchLabels:
      k8s-app: fluent-bit-logging
```

Using the above declaration, we are going to configure a `DaemonSet` named `fluent-bit` in the
`kube-logging` namespace. In the `spec` section, we declare that the daemonset will contain
pods which has the `k8s-app` label set to `fluent-bit-logging`.

Next, add the following contents at the same nesting level as `selector`:

```yaml
  ...
  template:
    metadata:
      labels:
        k8s-app: fluent-bit-logging
    spec:
      containers:
      - name: fluent-bit
        image: fluent/fluent-bit:1.3.8
        imagePullPolicy: Always
        env:
        - name: FLUENT_ELASTICSEARCH_HOST
          value: "elasticsearch"
        - name: FLUENT_ELASTICSEARCH_PORT
          value: "9200"
        volumeMounts:
        - name: varlog
          mountPath: /var/log
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
        - name: journal
          mountPath: /journal
          readOnly: true
        - name: fluent-bit-config
          mountPath: /fluent-bit/etc/
      terminationGracePeriodSeconds: 10
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
      - name: journal
        hostPath:
          path: /var/log/journal
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
      - name: fluent-bit-config
        configMap:
          name: fluent-bit-config
      serviceAccountName: fluent-bit
      tolerations:
      - key: node-role.kubernetes.io/master
        operator: Exists
        effect: NoSchedule
```

The most important bits of the above specification are:

**Elasticsearch configuration**

We specify the Elasticsearch host and port via the `FLUENT_ELASTICSEARCH_HOST` and
`FLUENT_ELASTICSEARCH_PORT` environment variables. These are referred to in the fluent bit
output configuration (discussed later on).

**Volume mounts**

We mount three host filesystem paths inside the fluent bit pods:

- `/var/log/`: The standard error and output of all the pods are stored as files  with `.log` extension
in the `/var/log/containers` directory. That said, these files are symbolic links to the actual files
in the `/var/lib/docker/containers` directory.

- `/var/lib/docker/containers`: This directory is mounted since we need access to individual container's
log files.

- `/var/log/journal`: For Linux systems running `systemd`, systemd journal stores logs related to the systemd services
in this directory. Kubernetes system components also log to the systemd journal.

The fourth volume mount inside the pod is from the `ConfigMap` resource `fluent-bit-config` which is mounted
at `/fluent-bit/etc` - the default location where the fluent bit docker image looks for configuration
files in.

**Service Account**

We specify the service account we want to run the daemonset as using the following:

```yaml
      serviceAccountName: fluent-bit
```

**Don't run on master node**

Since we want to run fluent bit only on the cluster nodes, we add a toleration to specify
that we don't want a pod to be scheduled on the Kubernetes master:
```yaml
      tolerations:
      - key: node-role.kubernetes.io/master
        operator: Exists
        effect: NoSchedule
```

The entire contents of the file is as follows:

```yaml

apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluent-bit
  namespace: kube-logging
spec:
  selector:
    matchLabels:
      k8s-app: fluent-bit-logging
  template:
    metadata:
      labels:
        k8s-app: fluent-bit-logging
    spec:
      containers:
      - name: fluent-bit
        image: fluent/fluent-bit:1.3.8
        imagePullPolicy: Always
        env:
        - name: FLUENT_ELASTICSEARCH_HOST
          value: "elasticsearch"
        - name: FLUENT_ELASTICSEARCH_PORT
          value: "9200"
        volumeMounts:
        - name: varlog
          mountPath: /var/log
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
        - name: journal
          mountPath: /journal
          readOnly: true
        - name: fluent-bit-config
          mountPath: /fluent-bit/etc/
      terminationGracePeriodSeconds: 10
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
      - name: journal
        hostPath:
          path: /var/log/journal
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
      - name: fluent-bit-config
        configMap:
          name: fluent-bit-config
      serviceAccountName: fluent-bit
      tolerations:
      - key: node-role.kubernetes.io/master
        effect: NoSchedule
```

Let's now create the `DaemonSet` that will deploy fluent bit to the Kubernetes cluster:

```command
kubectl apply -f logging/fluent-bit/daemonset.yaml
```

You will see the following output:

```
daemonset.apps/fluent-bit created
```

Let's wait for the daemonset to be rolled out:

```command
kubectl rollout status daemonset/fluent-bit -n kube-logging
```

You should see the following output when the command exits:

```
daemon set "fluent-bit" successfully rolled out
```

Next, in our browser, we will  go to the Kibana URL `http://127.0.0.1:5601/app/kibana#/management/kibana/index_pattern?_g=()` to create an index pattern. You will see that an elasticsearch index
is present, but no Kibana index patterns matching it exists:

![Kibana index management](https://i.imgur.com/oWf1FVS.png)

Type in `fluent-bit*` as the index pattern:

![Kibana index pattern setup](https://i.imgur.com/6uPzyuQ.png)

Click on "Next Step", select `@timestamp` as the Time
filter field name and click on "Create index pattern":

![Kibana index creation](https://i.imgur.com/RLM5HAS.png)

Once the index creation has been completed, if you visit the URL `http://127.0.0.1:5601/app/kibana#/discover` you should see logs 
from the currently running containers - elasticsearch, kibana as well as fluent bit itself.

![Logs from the running containers](https://i.imgur.com/ZSn5MZu.png)



In this step, we successfully deployed fluent bit in the cluster, configured it to read logs emitted by various pods running in the cluster and then send those logs to Elasticsearch.

It is worth noting here that there was no need to configure fluent bit specifically for reading logs emitted by Elasticsearch, Kibana or fluent bit itself.
Similarly, we didn't need to configure the applications to send their logs to Elasticsearch. This decoupling is a major benefit of setting up
log forwarding. If we expand any of the log entries and look at the JSON version, we will see an entry looks similar to:

```
{
  "_index": "fluent-bit-2020.03.25",
  "_type": "flb_type",
  "_id": "zsksEHEBxb--hvB5vgJi",
  "_version": 1,
  "_score": null,
  "_source": {
    "@timestamp": "2020-03-25T05:31:39.122Z",
    "log": "{\"type\":\"response\",\"@timestamp\":\"2020-03-25T05:31:39Z\",\"tags\":[],\"pid\":1,\"method\":\"get\",\"statusCode\":200,\"req\":{\"url\":\"/ui/fonts/roboto_mono/RobotoMono-Bold.ttf\",\"method\":\"get\",\"headers\":{\"host\":\"127.0.0.1:5601\",\"user-agent\":\"Mozilla/5.0 (X11; Linux x86_64; rv:72.0) Gecko/20100101 Firefox/72.0\",\"accept\":\"application/font-woff2;q=1.0,application/font-woff;q=0.9,*/*;q=0.8\",\"accept-language\":\"en-US,en;q=0.5\",\"accept-encoding\":\"identity\",\"connection\":\"keep-alive\",\"referer\":\"http://127.0.0.1:5601/app/kibana\"},\"remoteAddress\":\"127.0.0.1\",\"userAgent\":\"127.0.0.1\",\"referer\":\"http://127.0.0.1:5601/app/kibana\"},\"res\":{\"statusCode\":200,\"responseTime\":10,\"contentLength\":9},\"message\":\"GET /ui/fonts/roboto_mono/RobotoMono-Bold.ttf 200 10ms - 9.0B\"}\n",
    "stream": "stdout",
    "time": "2020-03-25T05:31:39.122786572Z"
  },
  "fields": {
    "@timestamp": [
      "2020-03-25T05:31:39.122Z"
    ],
    "time": [
      "2020-03-25T05:31:39.122Z"
    ]
  },
  "sort": [
    1585114299122
  ]
}
```

The most important field in the above JSON object is `_source`. The value of this field corresponds to a line read by fluent bit
from the configured input source. It has three fields:

- `log`: The value of this field corresponds to a single line emitted by the application to the standard output (`stdout`) or standard error (`stderr`)
- `stream`: The value of this field identifies the output stream - `stdout` or `stderr`. This added by the Kubernetes runtime.
- `time`: This field corresponds to the date time in UTC when the log was read by the Kubernetes runtime
- `@timestamp`: This field is derived by fluent bit by parsing the value of  field 
   specified via `Time_Key` using the format specified in `Time_Format` emitted by the application.


Next, we will deploy an web application inside the cluster which emits JSON formatted logs to the standard output and error 
streams. We will see that fluent bit automatically forwards these logs to Elasticsearch without requiring any additional
configuration either in fluent bit or on the application side.

## Step 4 — Write and deploy a web application on kubernetes

We will use the Python programming language to write a basic web application using [Flask](https://palletsprojects.com/p/flask/).
To deploy the application in the kubernetes cluster, we will build a docker image containing the application
source code and publish it to docker hub. First, create a new directory, `application`

```command
mkdir application
```
Now inside that directory, create and open a file called `app.py`:

```command
nano application/app.py
```

Add the following contents to it:

```python
from flask import Flask

app = Flask(__name__)

@app.route('/test/')
def test():
    return 'rest'

@app.route('/honeypot/')
def test1():
    1/0
    return 'lol'

```
The first two statements imports the `Flask` class from `flask` package and then creates the application using the current module name (via the special `__name__` variable). Then,
we define two endpoints - `/test/` and `/honeypot/` using the `app.route` decorator. The `/test/` endpoint will return a text, `rest` as response and the `/honeypot/` endpoint will raise an exception upon being called due to the `1/0` statement.

To run the application, we will use [gunicorn](https://gunicorn.org/).

Inside the application directory, create and open a new file, `Dockerfile`:

```command
nano application/Dockerfile
```

Add the following contents to the file:

```
FROM python:3.7-alpine
ADD app.py /app.py

RUN set -e; \
	apk add --no-cache --virtual .build-deps \
		gcc \
		libc-dev \
		linux-headers \
	; \
	pip install flask gunicorn ; \
	apk del .build-deps;

WORKDIR /
CMD ["gunicorn", "--workers", "5", "--bind", "0.0.0.0:8000", "app:app"]

```

The above `Dockerfile` will create a docker image containing the application code, install
Flask, gunicorn and configure the image to start `gunicorn` on startup. We are running 5 worker
processes and listening on port 8000 for HTTP requests with the WSGI application entrypoint object
as `app` inside the `app` Python module.

From within the `application` directory, let's build the docker image:

```command
cd application
docker build -t sammy/do-webapp .
..
Successfully built <^>ec7bd4635bc7<^>
Successfully tagged sammy/do-webapp:latest

```

Let's run a docker container using the above image:

```command
docker run -p 8000:8000 -ti sammy/do-webapp
```

Now, if we visit the URL `http://127.0.0.1:8000/honeypot/` from the browser, we will see logs such as
these on the terminal we ran the container from:

```

[2019-09-05 04:42:53 +0000] [1] [INFO] Starting gunicorn 19.9.0
[2019-09-05 04:42:53 +0000] [1] [INFO] Listening at: http://0.0.0.0:8000 (1)
[2019-09-05 04:42:53 +0000] [1] [INFO] Using worker: sync
[2019-09-05 04:42:53 +0000] [9] [INFO] Booting worker with pid: 9
[2019-09-05 04:42:53 +0000] [10] [INFO] Booting worker with pid: 10
[2019-09-05 04:42:53 +0000] [11] [INFO] Booting worker with pid: 11
[2019-09-05 04:42:53 +0000] [12] [INFO] Booting worker with pid: 12
[2019-09-05 04:42:53 +0000] [13] [INFO] Booting worker with pid: 13
[2019-09-05 04:43:05,289] ERROR in app: Exception on /honeypot/ [GET]
Traceback (most recent call last):
  File "/usr/local/lib/python3.7/site-packages/flask/app.py", line 2446, in wsgi_app
    response = self.full_dispatch_request()
  File "/usr/local/lib/python3.7/site-packages/flask/app.py", line 1951, in full_dispatch_request
    rv = self.handle_user_exception(e)
  File "/usr/local/lib/python3.7/site-packages/flask/app.py", line 1820, in handle_user_exception
    reraise(exc_type, exc_value, tb)
  File "/usr/local/lib/python3.7/site-packages/flask/_compat.py", line 39, in reraise
    raise value
  File "/usr/local/lib/python3.7/site-packages/flask/app.py", line 1949, in full_dispatch_request
    rv = self.dispatch_request()
  File "/usr/local/lib/python3.7/site-packages/flask/app.py", line 1935, in dispatch_request
    return self.view_functions[rule.endpoint](**req.view_args)
  File "/app.py", line 15, in test1
    1/0
ZeroDivisionError: division by zero
```

The first few lines are startup messages from `gunicorn`. Then, we see the exception that occurs
when we make a request to the `/honeypot/` endpoint. Tracebacks like these present a problem
for logging since they are spread over multiple lines. We want the entire traceback as a single
log message. One way to achieve that is to log messages in a JSON format. Press `CTRL + C` to terminate
the container.

Let's now configure `gunicorn` to emit the logs in a JSON format. In the `application` directory,
create and open a new file, `gunicorn_logging.conf`:

```command
nano application/gunicorn_logging.conf
```

Add the following contents to it:

```
[loggers]
keys=root, gunicorn_error, gunicorn_access

[handlers]
keys=console

[formatters]
keys=json

[logger_root]
level=INFO
handlers=console

[logger_gunicorn.error]
level=DEBUG
handlers=console
propagate=0
qualname=gunicorn.error

[logger_gunicorn.access]
level=INFO
handlers=console
propagate=0
qualname=gunicorn.access

[handler_console]
class=StreamHandler
formatter=json
args=(sys.stdout, )

[formatter_json]
class=pythonjsonlogger.jsonlogger.JsonFormatter

```

To understand the above logging configuration completely, please refer to the
[Python logging module documentation](https://docs.python.org/3/library/logging.config.html). The
most relevant parts for us is the `formatter_json` section where we set the logging
formatter close to the `JsonFormatter` class which is part of the [python-json-logger](https://github.com/madzak/python-json-logger)
package.


To use the above logging configuration, we will update the `application/Dockerfile` as follows:


```
FROM python:3.7-alpine

ADD app.py /app.py
ADD gunicorn_logging.conf /gunicorn_logging.conf

RUN set -e; \
	apk add --no-cache --virtual .build-deps \
		gcc \
		libc-dev \
		linux-headers \
	; \
	pip install flask <^>python-json-logger<^> gunicorn ; \
	apk del .build-deps;
EXPOSE 8000
WORKDIR /
CMD ["gunicorn", "--log-config", "gunicorn_logging.conf", "--workers", "5", "--bind", "0.0.0.0:8000", "app:app"]
```

The key changes in the above Dockerfile are: 

- Since we are using a custom gunicorn logging configuration, we copy the gunicorn logging configuration using: `ADD gunicorn_logging.conf /gunicorn_logging.conf`
- We are now using a new Python package for JSON logging, so we add `python-json-logger` to the list of packages being installed using `pip install`
- To specify the custom logging configuration file to `gunicorn`, we specify the configuration file path to the  `--log-config` option

Rebuild the  image using the updated Dockerfile:

```command
docker build -t sammy/do-webapp .
..
Successfully built <^>ec7bd4635bc7<^>
Successfully tagged sammy/do-webapp:latest

```

Let's run the image:

```command
docker run -p 8000:8000 -ti sammy/do-webapp
```

Now, if we revisit the URL `http://127.0.0.1:8000/honeypot/`, we will see logs are now emitted in a JSON format
in Terminal 1:

```json
{"message": "Starting gunicorn 19.9.0"}
{"message": "Arbiter booted"}
{"message": "Listening at: http://0.0.0.0:8000 (1)"}
{"message": "Using worker: sync"}
{"message": "Booting worker with pid: 8"}
...
{"message": "5 workers", "metric": "gunicorn.workers", "value": 5, "mtype": "gauge"}
{"message": "GET /honeypot/"}
{"message": "Exception on /honeypot/ [GET]", "exc_info": "Traceback (most recent call last):\n  File \"/usr/local/lib/python3.7/site-packages/flask/app.py\", line 2446, in wsgi_app\n    response = self.full_dispatch_request()\n  File \"/usr/local/lib/python3.7/site-packages/flask/app.py\", line 1951, in full_dispatch_request\n    rv = self.handle_user_exception(e)\n  File \"/usr/local/lib/python3.7/site-packages/flask/app.py\", line 1820, in handle_user_exception\n    reraise(exc_type, exc_value, tb)\n  File \"/usr/local/lib/python3.7/site-packages/flask/_compat.py\", line 39, in reraise\n    raise value\n  File \"/usr/local/lib/python3.7/site-packages/flask/app.py\", line 1949, in full_dispatch_request\n    rv = self.dispatch_request()\n  File \"/usr/local/lib/python3.7/site-packages/flask/app.py\", line 1935, in dispatch_request\n    return self.view_functions[rule.endpoint](**req.view_args)\n  File \"/app.py\", line 13, in test1\n    1/0\nZeroDivisionError: division by zero"}
{"message": "172.17.0.1 - - [05/Sep/2019:04:47:33 +0000] \"GET /honeypot/ HTTP/1.1\" 500 290 \"-\" \"Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:68.0) Gecko/20100101 Firefox/68.0\""}
{"message": "GET /test/"}
{"message": "172.17.0.1 - - [05/Sep/2019:04:47:47 +0000] \"GET /test/ HTTP/1.1\" 200 4 \"-\" \"Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:68.0) Gecko/20100101 Firefox/68.0\""}
...
```


**Note:** If you are building your own docker image, please replace `sammy` with your own docker hub username when you login
as well as when you build and push the images. In addition, substitute any reference to `sammy/do-webapp` by your own
image name for the rest of this article

Now that we have our application emitting logs as JSON formatted strings, let's push the docker image
to docker hub. You will need to login first:

```command
docker login
```

```

Login with your Docker ID to push and pull images from Docker Hub. If you don't have a Docker ID, head over to https://hub.docker.com to create one.
Username: sammy
Password: 
Login Succeeded
```

Now, let's push the docker image to docker hub:

```command
docker push sammy/do-webapp
```

```

The push refers to repository [docker.io/sammy/do-webapp]
..
latest: digest: sha256:<^>ba7719343e3430e88dc5257b8839c721d8865498603beb2e3161d57b50a72cbe<^> size: <^>1993<^>
```

Now that we have pushed our docker image to docker hub, we will deploy it to our Kubernetes cluster
using a `Deployment` in a new namespace, `demo`. Create and open a new file `namespace.yaml` inside
the `application` directory:

```command
nano application/namespace.yaml
```

Add the following contents:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: demo
```

To create the namespace:

```command
kubectl apply -f application/namespace.yaml
```

You should see the following output:

```
namespace/demo created
```

Next, create and open a new file `deployment.yaml` inside the `application` directory:

```command
nano application/deployment.yaml
```

Add the following contents to it:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp
  namespace: demo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: webapp
  template:
    metadata:
      labels:
        app: webapp
    spec:
      containers:
      - name: webapp
        image: sammy/do-webapp
        imagePullPolicy: Always
        livenessProbe:
          httpGet:
            scheme: HTTP
            path: /test/
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            scheme: HTTP
            path: /test/
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10

```

The web application is being deployed to the `demo` namespace and will run a container from the
docker image, `sammy/do-webapp` we just pushed. The container has HTTP liveness and readiness
probes configured for port 8000 and path `/test/`. These will make sure that kubernetes is able
to check if the application is working as expected.

Next, let's create the deployment:

```command
kubectl apply -f application/deployment.yaml
```
You shoud see the following output:

```
deployment.apps/webapp created
```

Let's wait for the deployment rollout to complete:

```
kubectl rollout status deployment/webapp -n demo
```

You should see the following output:
```
Waiting for deployment "webapp" rollout to finish: 0 of 2 updated replicas are available...
Waiting for deployment "webapp" rollout to finish: 1 of 2 updated replicas are available...
deployment "webapp" successfully rolled out
```

Let's see if the pods are up and running successfully:

```command
kubectl -n demo get pods
```

You should see the following output:

```
NAME                           READY   STATUS    RESTARTS   AGE
webapp-<^>65f6798978-8phqg<^>   1/1     Running   0          76s
webapp-<^>65f6798978-f2jl9<^>   1/1     Running   0          76s
```


To access the web application from our local workstation, we will use port
forwarding specifying a pod name of one of the two pods above:

```command
kubectl -n demo port-forward pod/webapp-<^>65f6798978-8phqg<^> 8000:8000
```

You should see the following output:

```
Forwarding from 127.0.0.1:8000 -> 8000
Forwarding from [::1]:8000 -> 8000
```


Now, visit `http://127.0.0.1:8000/honeypot/` in the browser a few times.

Now, if we go to kibana and use "honeypot" as the search query, we will see log documents
emitted by our web application. The document's `log` field contains the entire log line:
emitted by the application as a string:

```json

{
...
"log": {"message": "Exception on /honeypot/ [GET]", "exc_info": "Traceback (most recent call last):\n  File \"/usr/local/lib/python3.7/site-packages/flask/app.py\", line 2446, in wsgi_app\n    response = self.full_dispatch_request()\n  File \"/usr/local/lib/python3.7/site-packages/flask/app.py\", line 1951, in full_dispatch_request\n    rv = self.handle_user_exception(e)\n  File \"/usr/local/lib/python3.7/site-packages/flask/app.py\", line 1820, in handle_user_exception\n    reraise(exc_type, exc_value, tb)\n  File \"/usr/local/lib/python3.7/site-packages/flask/_compat.py\", line 39, in reraise\n    raise value\n  File \"/usr/local/lib/python3.7/site-packages/flask/app.py\", line 1949, in full_dispatch_request\n    rv = self.dispatch_request()\n  File \"/usr/local/lib/python3.7/site-packages/flask/app.py\", line 1935, in dispatch_request\n    return self.view_functions[rule.endpoint](**req.view_args)\n  File \"/app.py\", line 13, in test1\n    1/0\nZeroDivisionError: division by zero"}
...
}
```

In this step, we have seen how without any further work on the logging setup, we can view and search
the application logs in Elasticsearch. Next, we will improve this in two ways:

1. Parse the `log` field as JSON and add the JSON keys as top-level fields in the Elasticsearch document
2. Add Kubernetes metadata to each log document so that we can have identifying information about where the log
   is being forwarded from

(1) will allow us to search for logs with specific fields and (2) will give us information about
the specific pod a log is being emitted from. Let's see how we can do both.

<$>[note] Note: Keep the above port forward running in a terminal session and use a new terminal session for running the commands in the the rest of the tutorial. <$>


## Step 5 — Update fluent bit configuration to apply kubernetes filter

In fluent bit, a filter is used to alter the incoming log data in some way. The in-built
[kubernetes filter](https://docs.fluentbit.io/manual/filter/kubernetes) enriches logs
with kubernetes data. In addition, it can also read the incoming data in the `log` field
and if JSON can "scoop out" the keys and add them as top-level fields to the log entry.

The second version of the fluent bit `ConfigMap` resource adds this filter. Create a copy
of the existing `configmap-1.yaml` and name it `configmap-2.yaml` in the same
directory:

```command
cp logging/fluent-bit/configmap-1.yaml logging/fluent-bit/configmap-2.yaml
```

Open the `logging/fluent-bit/configmap-2.yaml` file and update the `fluent-bit.conf` file definition to include:

```yaml

     @INCLUDE filter-kubernetes.conf
```

In addition, add a new file declaration `filter-kubernetes.conf` after `input-kubernetes.conf`:

```yaml

    filter-kubernetes.conf: |
       [FILTER]
         Name                kubernetes
         Match               kube.*
         Keep_Log            Off
         Merge_Log           On

```

Save and close the file.

We specify a section, `[FILTER]` in this file and refer to the `kubernetes` filter using
the `Name` attribute. We use `Match` in `filter-kubernetes.conf` to only apply this filter to logs tagged with `kube.*`.
Note that when we configured the input above in `input-kubernetes.conf`, we tagged all messages with
`kube.*`.

The entire file contents should be as follows:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
  namespace: kube-logging
  labels:
    k8s-app: fluent-bit
data:
  fluent-bit.conf: |
    [SERVICE]
        Flush         1
        Log_Level     info
        Daemon        off
        Parsers_File  parsers.conf
        HTTP_Server   On
        HTTP_Listen   0.0.0.0
        HTTP_Port     2020

    @INCLUDE input-kubernetes.conf
    @INCLUDE filter-kubernetes.conf
    @INCLUDE output-elasticsearch.conf

  input-kubernetes.conf: |
    [INPUT]
        Name              tail
        Tag               kube.*
        Path              /var/log/containers/*.log
        Parser            docker
        DB                /var/log/flb_kube.db
        Mem_Buf_Limit     5MB
        Skip_Long_Lines   On
        Refresh_Interval  10

  filter-kubernetes.conf: |
    [FILTER]
        Name                kubernetes
        Match               kube.*
        Keep_Log            Off
        Merge_Log           On

  output-elasticsearch.conf: |
    [OUTPUT]
        Name            es
        Match           *
        Host            ${FLUENT_ELASTICSEARCH_HOST}
        Port            ${FLUENT_ELASTICSEARCH_PORT}
        Logstash_Format On
        Logstash_Prefix fluent-bit
        Retry_Limit     False

  parsers.conf: |
    [PARSER]
        Name        docker
        Format      json
        Time_Key    time
        Time_Format %Y-%m-%dT%H:%M:%S.%L
        Time_Keep   On
```

Let's delete the existing `ConfigMap` and `DaemonSet` resources first:

```command
kubectl delete -f logging/fluent-bit/configmap-1.yaml -f logging/fluent-bit/daemonset.yaml
```

You should see the following output:

```
configmap "fluent-bit-config" deleted
daemonset.apps "fluent-bit" deleted
```

Next, we recreate the new version of the `ConfigMap` and the fluent bit `DaemonSet`:

```command
kubectl apply -f logging/fluent-bit/configmap-2.yaml -f logging/fluent-bit/daemonset.yaml
```

You should see the following output:
```
configmap/fluent-bit-config created
daemonset.apps/fluent-bit created
```

Now, visit the URL `http://127.0.0.1:8080/honeypot/` in you browser once more and then in Kibana,
use the following search query: `kubernetes.labels.app: "webapp"`. You will see a few documents show up
in the results. Each log document has kubernetes metadata
associated with it - we used one in our search query under the `kubernetes` object. In addition,
`message` and `exc_info` are now searchable fields. For example, the Kibana query
`kubernetes.labels.app: "webapp"  AND exc_info: "ZeroDivisionError"` will return log documents
containing `ZeroDivisionError` in the `exc_info` field.

Here's an example log document with the exception info logged in a separate field:

![Kibana index creation](https://i.imgur.com/IH0OIBO.png)

In this step, we improved the application logging by making use of fluent bit's features. We used the
Kubernetes filter to add Kubernetes metadata to the log messages and
parsed the JSON log emitted by the application to make the individual fields
searchable in Elasticsearch.

In the next step, we see how we can forward system logs via fluent bit.

## Step 6 — Update fluent bit configuration to forward system logs

In addition to application logs, it is a good idea to also forward logs from the system services. These logs
are useful when we may want to debug the behavior of services such as `ssh` daemon, kubernetes node management
services such as `kubelet` and the docker daemon. Most linux systems available today run `systemd` and logs
from these services are logged to the systemd journal. We already mount the `/var/log/journal` directory inside fluent bit. 
However, we have couple of additional steps to perform before we can see our journal logs being forwarded by fluent bit.

The final version of the fluent bit `ConfigMap` resource adds this filter. Create a copy of the existing `configmap-2.yaml` and 
name it `configmap-final.yaml` in the same directory:

```command
cp logging/fluent-bit/configmap-2.yaml logging/fluent-bit/configmap-final.yaml
```


The first step is to add an additional `[INPUT]` section to the the fluent bit configuration. fluent bit has a dedicated `input` [plugin](https://docs.fluentbit.io/manual/input/systemd) for systemd which can be specified as follows:

```yaml
  [INPUT]
      Name            systemd
      Path            /journal
      Tag             systemd.*
  ```

Logs read by the systemd input plugin will be tagged with `systemd.*`. This tag is then use to define
two filters. Add the following to the `configmap-final.yaml` file at the same nesting level as
`filter-kubernetes.conf`:

```yaml
filter-systemd.conf: |
    [FILTER]
        Name modify
        Match systemd.*
        Rename _SYSTEMD_UNIT systemd_unit
        Rename _HOSTNAME hostname

    [FILTER]
        Name record_modifier
        Match systemd.*

        Remove_Key _CURSOR
        Remove_Key _REALTIME_TIMESTAMP
        Remove_Key _MONOTONIC_TIMESTAMP
        Remove_Key _BOOT_ID
        Remove_Key _MACHINE_ID

```

The first is a `modify` filter which renames the `_SYSTEMD_UNIT` field to `systemd_unit`. The second is
a `record_modifier` filter which removes keys which we may not care about logging. We can also
use this filter to add fields to the log using `Add_Key` configuration. For both filters, we use
`Match` to only apply them to logs which are tagged `systemd.*`.


The final contents of the file will look as follows:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
  namespace: kube-logging
  labels:
    k8s-app: fluent-bit
data:
  fluent-bit.conf: |
    [SERVICE]
        Flush         1
        Log_Level     info
        Daemon        off
        Parsers_File  parsers.conf

    @INCLUDE input-systemd.conf
    @INCLUDE input-kubernetes.conf
    @INCLUDE filter-kubernetes.conf
    @INCLUDE filter-systemd.conf
    @INCLUDE output-elasticsearch.conf

  input-systemd.conf: |
    [INPUT]
      Name            systemd
      Path            /journal
      Tag             systemd.*

  input-kubernetes.conf: |
    [INPUT]
        Name              tail
        Tag               kube.*
        Path              /var/log/containers/*.log
        Parser            docker
        DB                /var/log/flb_kube.db
        Mem_Buf_Limit     5MB
        Skip_Long_Lines   On
        Refresh_Interval  10

  filter-kubernetes.conf: |
    [FILTER]
        Name                kubernetes
        Match               kube.*
        Keep_Log            Off
        Merge_Log           On

  filter-systemd.conf: |
    [FILTER]
        Name modify
        Match systemd.*
        Rename _SYSTEMD_UNIT systemd_unit
        Rename _HOSTNAME hostname

    [FILTER]
        Name record_modifier
        Match systemd.*
        Remove_Key _CURSOR
        Remove_Key _REALTIME_TIMESTAMP
        Remove_Key _MONOTONIC_TIMESTAMP
        Remove_Key _BOOT_ID
        Remove_Key _MACHINE_ID

  output-elasticsearch.conf: |
    [OUTPUT]
        Name            es
        Match           *
        Host            ${FLUENT_ELASTICSEARCH_HOST}
        Port            ${FLUENT_ELASTICSEARCH_PORT}

        Logstash_Format On
        Logstash_Prefix fluent-bit
        Retry_Limit     False

  parsers.conf: |

    [PARSER]
        Name        docker
        Format      json
        Time_Key    time
        Time_Format %Y-%m-%dT%H:%M:%S.%L
        Time_Keep   On

```

Let's delete the existing `ConfigMap` and `DaemonSet` resources first:

```command
kubectl delete -f logging/fluent-bit/configmap-2.yaml -f logging/fluent-bit/daemonset.yaml
```

You should see the following output:

```

configmap "fluent-bit-config" deleted
daemonset.apps "fluent-bit" deleted
```

Next, let's recreate the configmap using the final manifest and the fluent bit
`DaemonSet` again:

```command
kubectl apply -f logging/fluent-bit/configmap-final.yaml -f logging/fluent-bit/daemonset.yaml
```

You should see the following output:

```
configmap/fluent-bit-config created
daemonset.apps/fluent-bit created
```

Fluent bit will now forward logs from various system services to Elastic search. However, before we can
search for them in Kibana, we will have to perform a "Refresh field list" operation in Kibana. Go to
the page `http://127.0.0.1:5601/app/kibana#/management/kibana/index_patterns` in your browser and click
on `fluent-bit*` - the index pattern we created earlier. This will take us to the page as shown below:

![fluent-bit* index pattern page](https://i.imgur.com/HId42sj.png)

Click on the "refresh" icon (the second icon on the top right) and in the pop up dialog box, click on "Refresh":

![Refreshing the index pattern](https://i.imgur.com/3gWCOMH.png)

Now, in addition to the logs of all the different pods, we will be able to search for logs related
to the systemd units as well. For example, to view all logs related to the `kubelet` service, we will use the
kibana query `systemd_unit: kubelet.service`:

![Example logs from kubelet.service](https://i.imgur.com/ikBPxvo.png)


## Conclusion

In this post we discussed how we can setup log fowarding in a Kubernetes cluster using fluent bit. We
learned how we can read logs, parse them, modify them and forward them to an Elasticsearch cluster.
This article although should get you started, only scratches the basics of fluent bit and I encourage you to
look at the other fluent bit features such as [monitoring fluent bit itself](https://docs.fluentbit.io/manual/configuration/monitoring), [stream processing](https://docs.fluentbit.io/manual/configuration/stream_processor) and the
variety of [inputs](https://docs.fluentbit.io/manual/input) and [outputs](https://docs.fluentbit.io/manual/output)
it supports.

The [fluent bit](https://groups.google.com/forum/#!forum/fluent-bit) google group is a great forum for
seeking help if you are stuck with something.

## Cleaning up

If you want to delete all the resources we created as part of this article, you can delete the two namespaces
we created:

```command
kubectl delete namespace kube-logging demo
```
