---
title:  Notes on Kubernetes
date: 2019-08-02
categories:
-  infrastructure
---

# Introduction

This in-progress page lists some of my findings while working with [Kubernetes](https://kubernetes.io/). 

# EKS cluster setup

This section will have findings that are relevant when working with an AWS EKS cluster.

## Terraform configuration for master

This is based on the tutorial from the Terraform folks [here](https://learn.hashicorp.com/terraform/aws/eks-intro). Unlike
the tutorial though, I assume that you already have the VPC and subnets you want to setup your EKS master in. 

First up, the master. There are three main category of AWS resources we will need to create:

- IAM role and policies
- Security groups
- EKS master

### IAM role

```
resource "aws_iam_role" "cluster" {
  name = "eks-cluster-${var.environment}"

  assume_role_policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "eks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
POLICY
}

resource "aws_iam_role_policy_attachment" "cluster-AmazonEKSClusterPolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = "${aws_iam_role.cluster.name}"
}

resource "aws_iam_role_policy_attachment" "cluster-AmazonEKSServicePolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSServicePolicy"
  role       = "${aws_iam_role.cluster.name}"
}
```

### Security group and rules

```
resource "aws_security_group" "cluster" {
  name        = "eks-cluster-${var.environment}"
  description = "Cluster communication with worker nodes"
  vpc_id      = "${var.vpc_id}"

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "eks-cluster-${var.environment}"
  }
}

resource "aws_security_group_rule" "cluster-ingress-workstation-https" {
  cidr_blocks       = "${var.ssh_access_ip}"
  description       = "Allow local workstation to communicate with the cluster API Server"
  from_port         = 443
  protocol          = "tcp"
  security_group_id = "${aws_security_group.cluster.id}"
  to_port           = 443
  type              = "ingress"
}
```

### EKS master

We create an EKS master with the following key attributes:

- We enable the cloudwatch logs for the `api`, `audit`, `authenticator`, `controllerManager` and `scheduler`
- We specify that we want a private endpoint access for the master
- We specify that we don't want a public endpoint access for the master
- We specify our existing private subnet IDs that we want to use

These private subnet IDs must have a tag - `kubernetes.io/cluster/<your cluster name>: shared` where the cluster name
is the same as that you use in the your terraform configuration.

The following Terraform configuration will create the EKS master:

```
resource "aws_eks_cluster" "cluster" {
  name            = "${var.cluster_name}"
  role_arn        = "${aws_iam_role.cluster.arn}"

  enabled_cluster_log_types = [
      "api","audit","authenticator","controllerManager","scheduler",
  ]

  vpc_config {
    endpoint_private_access = true
    endpoint_public_access = false
    security_group_ids = ["${aws_security_group.cluster.id}"]
    subnet_ids         = ["${var.private_subnet_ids}"]
  }

  depends_on = [
    "aws_iam_role_policy_attachment.cluster-AmazonEKSClusterPolicy",
    "aws_iam_role_policy_attachment.cluster-AmazonEKSServicePolicy",
  ]
}
```

## Terraform configuration for nodes

## Public subnet tagging

Public subnets will need the following key-value pairs as tags:

```
kubernetes.io/cluster/<cluster-name>: shared 
kubernetes.io/role/elb: 1
```

This is so that public load balancers can be created for services and/or ingress controllers.


## EKS private master and DNS resolution

In my setup, the master was private (along with all the nodes residing in private subnets). Right off the bat, 
I ran into issue of the master  hostname not resolving from my local workstation (even when I was connected to 
the VPN which had VPC peering with the VPC the master was running in). This issue is described 
[here](https://github.com/aws/containers-roadmap/issues/221). The solution I used ended up getting the IP 
address of the master via the network interface attached to it and then making an entry in the local `/etc/hosts` file.


## Authentication and Authorization

The first step to accessing the cluster is authenticating yourself and the second step is whether
based on the credentials you authenticated yourself with, are you authorized to perform the operation
you are trying to currently perform. For EKS clusters, using AWS IAM is the most straightforward
approach for authentication. The user who sets up the EKS cluster are automatically given access to
the cluster as a member of the `system:masters` kubernetes group and the authentication setup in
kubeconfig looks as follows:

```
- name: mycluster-admin
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1alpha1
      command: aws-iam-authenticator
      args:
      - token
      - -i
      - myclustername
```

For the user who created the cluster, there is no further configuration required.

## Getting cluster data

To be able to make API requests, we have to get another key piece of information
- the certificate authority data. We can get it from the AWS console or from
the terraform output, or via using the AWS CLI or directly via the API.

A complete `~/.kube/config` file for admin access for the cluster creator will look like 
as follows:

```
apiVersion: v1
current-context: ""
clusters:
- cluster:
    certificate-authority-data: foobar 
    server: https://adasd.yl4.eu-central-1.eks.amazonaws.com
  name: myclustername
contexts:
- context:
    cluster: myclustername
    namespace: default
    user: admin
  name: admin
kind: Config
users:
- name: admin
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1alpha1
      command: aws-iam-authenticator
      args:
      - token
      - -i
      - myclustername
```

## Worker node joining

Once you have configured the above kubeconfig correctly, if you run `kubectl get nodes`,
you will see that no nodes have joined the cluster. That is because, we will need to
first update a special `ConfigMap` to allow the nodes to authenticate to the cluster:

```
apiVersion: v1
data:
  mapRoles: |
    - rolearn: arn:aws:iam::AWS-ACCOUN-ID:role/myrole
      username: system:node:{{EC2PrivateDNSName}}
      groups:
      - system:bootsrappers
      - system:nodes
kind: ConfigMap
metadata:
  name: aws-auth
  namespace: kube-system

```
The `mapRoles` array lists all the IAM roles that we want to allow to authenticate
successfully to the cluster. We add the role to the kubernetes groups `system:bootstrappers`
and `system:nodes`. We have to add all the IAM roles of the nodes in our cluster to this
ConfigMap. Once we apply this manifest, you should see the nodes are ready when you run
`kubectl get nodes` again.


## Adding other admins and managing users

This is discussed in a [separate post](https://echorand.me/posts/user-management-aws-eks-cluster/#automating-kubeconfig-management-for-human-users).

# Persistent volumes

When you create a persistent volume claim, an EBS volume is created for you in AWS. 

Topology aware: https://kubernetes.io/blog/2018/10/11/topology-aware-volume-provisioning-in-kubernetes/

# Secret management

# Nginx Ingress with SSL throughout


The following specification enables Nginx ingress with SSL to your backend as well:

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: api-ingress
  namespace: mynamespace
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    kubernetes/ingress.class: nginx
    nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"
spec:
  tls:
  - hosts:
    - "myhost.dns.com"
    secretName: myhost-tls
  rules:
    - host: myhost.dns.com
      http:
        paths:
        - path: /
          backend:
            serviceName: xledger
            servicePort: 443

```

However when trying to use the above with AWS ELB, I had to:

- Follow the docs [here](https://kubernetes.github.io/ingress-nginx/deploy/) for AWS ELB L7
- Update config map with the following:

```yaml
kind: ConfigMap
apiVersion: v1
metadata:
  name: nginx-configuration
  namespace: ingress-nginx
  labels:
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/part-of: ingress-nginx
data:
  use-proxy-protocol: "false"
  use-forwarded-headers: "true"
  proxy-real-ip-cidr: "0.0.0.0/0" # restrict this to the IP addresses of ELB
  ssl-ciphers: "ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-DSS-AES128-GCM-SHA256:kEDH+AESGCM:ECDHE-RSA-AES128-SHA256:ECDHE-ECDSA-AES128-SHA256:ECDHE-RSA-AES128-SHA:ECDHE-ECDSA-AES128-SHA:ECDHE-RSA-AES256-SHA384:ECDHE-ECDSA-AES256-SHA384:ECDHE-RSA-AES256-SHA:ECDHE-ECDSA-AES256-SHA:DHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA:DHE-DSS-AES128-SHA256:DHE-RSA-AES256-SHA256:DHE-DSS-AES256-SHA:DHE-RSA-AES256-SHA:AES128-GCM-SHA256:AES256-GCM-SHA384:AES128-SHA256:AES256-SHA256:AES128-SHA:AES256-SHA:AES:CAMELLIA:DES-CBC3-SHA:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!aECDH:!EDH-DSS-DES-CBC3-SHA:!EDH-RSA-DES-CBC3-SHA:!KRB5-DES-CBC3-SHA"
  ssl-protocols: "TLSv1 TLSv1.1 TLSv1.2"

```

The key parts that I struggled with was having to set `ssl-ciphers` and `ssl-protocols`. Without those, the connections
from ALB was just hanging and eventually would give me a 408. For reference, here's a `service-l7.yaml` I used:

```yaml
kind: Service
apiVersion: v1
metadata:
  name: ingress-nginx
  namespace: ingress-nginx
  labels:
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/part-of: ingress-nginx
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-ssl-cert: "your certificate arn"
    service.beta.kubernetes.io/aws-load-balancer-backend-protocol: "https"
    service.beta.kubernetes.io/aws-load-balancer-ssl-ports: "https"
    service.beta.kubernetes.io/aws-load-balancer-connection-idle-timeout: "60"
spec:
  type: LoadBalancer
  selector:
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/part-of: ingress-nginx
  ports:
   - name: https
     port: 443
     targetPort: 443

```

# Jobs

Jobs are useful for running one off tasks - database migrations for example. Here's a sample spec:

```
apiVersion: batch/v1
kind: Job
metadata:
  name: my-job-name
  namespace: my-namespace
spec:
  template:
    spec:
      containers:
      - name: my-job-name
        image: myproject/job
        args:
        - bash
        - -c
        - /migrate.sh
        env:
          - name: ENVIRONMENT
            value: qa
          - name: TOKEN
            valueFrom:
              secretKeyRef:
                name: secret-token
                key: token
      nodeSelector:
        nodegroup: "services"
        environment: "qa"
      restartPolicy: Never
  backoffLimit: 4
  ```

# Cron jobs

Cron jobs are useful for running scheduled jobs:

```yaml
apiVersion: batch/v1beta1
kind: CronJob
metadata:
  name: cron
  namespace: my-namespace
spec:
  schedule: "* * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: cron
            image: myproject/cron-job
            args:
            - bash
            - -c
            - /schedule.sh
            env:
              - name: ENVIRONMENT
                value: qa
              - name: TOKEN
                valueFrom:
                  secretKeyRef:
                    name: secret-token
                    key: token
          restartPolicy: OnFailure
          nodeSelector:
            nodegroup: "services"
            environment: "qa"

```

# Accessing internal network services

`kubectl exec` allows us to exec into a pod and run arbitrary commands inside the pod. However, let's say
we wanted to run a graphical database client locally and wanted to connect to a database pod. We cannot make
use of `kubectl exec`. `kubectl port-forward` helps us here. We can setup a port forward from our local workstation
on port XXXX to the DB port and we are done. However, things get complicated when we are using network policies
and we should. In this particular case, network policies were setup for the database pod to allow only ingress
traffic from within the namespace. Hence, when we try to access the DB pod via port forwarding, it doesn't work.

In such a case, we can make use of the `ipBlock` object in the policy definition, for example:

```
kind: NetworkPolicy
apiVersion: networking.k8s.io/v1
metadata:
  name: db-policy
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: my-app
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              project: my-app
        - ipBlock:
            cidr: 10.0.56.0/21 # Trusted subnet
      ports:
        - protocol: TCP
          port: 5432
  ```
  
 The `ingress` section defines two selectors for `from` - one based on namespace and the other based on `ipBlock`.
 
It's worth noting that since I am using AWS EKS cluster, the CNI plugin generates the IP addresses of the pods 
in the specified subnet  IPv4 ranges, so that may be something which makes this solution not applicable to another 
kubernetes setup.

The nice thing about using `kubectl port-forward` here is that we have both authentication and authorization being enforced
to even obtain the IP address of the DB pod, since we can allow/disallow `port-forward` via a custom `Role`:

```
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: team-access-services
rules:

- apiGroups: [""]
  resources: ["pods/exec", "pods/portforward"]
  verbs: ["create"]
```
# Pod security policies

I have written about this in a [separate blog post](https://echorand.me/posts/kubernetes-pod-security-policies/)


# Exposing StatefulSets and Headless services

Let's say we have a `StatefulSet`:

```
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: prometheus
  namespace: monitoring
spec:
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: prometheus
      project: monitoring
  serviceName: prometheus
  template:
    metadata:
      labels:
        app.kubernetes.io/name: prometheus
        project: monitoring
    spec:
      containers:
      - args:
        - /bin/prometheus/prometheus
        - --config.file=/etc/prometheus.yml
        - --storage.tsdb.path=/data
        env:
        - name: ENVIRONMENT
          value: non-production
        image: <your image>
        imagePullPolicy: Always
       ..
        name: prometheus-infra
        ports:
        - containerPort: 9090
        ..
---
```

It is exposed via a Headless service:

```

apiVersion: v1
kind: Service
metadata:
  name: prometheus
  namespace: monitoring
spec:
  clusterIP: None
  ports:
  - port: 9090
  selector:
    app.kubernetes.io/name: prometheus
    project: monitoring
---
```
To expose it via an ingress controller as an ingress object:

```
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  annotations:
    kubernetes.io/ingress.class: <ingress class>
    nginx.ingress.kubernetes.io/rewrite-target: /
  name: prometheus
  namespace: monitoring
spec:
  rules:
  - host: <your host name>
    http:
      paths:
      - backend:
          serviceName: prometheus
          servicePort: 9090
        path: /
        
        
```

# Gatekeeper

Dedicated post [here](https://echorand.me/posts/gatekeeper-kubernetes/)

# Miscellaneous

## Pods in pending state

https://kubernetes.io/docs/tasks/debug-application-cluster/debug-pod-replication-controller/

