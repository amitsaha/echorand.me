---
title:  User access management on AWS Kubernetes cluster
date: 2019-08-23
categories:
-  infrastructure
---

# Introduction

When implementing a solution for allowing users other than the cluster creator to access the cluster resources we are 
faced with two fairly old generic problems - authentication and authorization. There are various ways one can solve 
these problems. I will discuss one such solution in this post. It makes use of AWS Identity and access management (IAM) 
features. This in my humble opinion is the simplest and hopefully secure enough solution when it comes to EKS.

# Allowing nodes to join the cluster

Before we discuss human users (and services), I want to discuss how the nodes are able to talk to the master 
and join the cluster. One of the first things to do when you are setting up an EKS cluster is to setup a special
ConfigMap - aws-auth in the kube-system namespace and add the IAM role ARNs to it. This allows the nodes to 
call home to the master and allow them to be part of the cluster. To make things concrete, here’s how the 
config map looks like:

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


# Allowing other admins

The cluster creator gets admin privileges by default. To add other admin users, we will
have to update the above ConfigMap as follows:

```
apiVersion: v1
data:
  mapRoles: |
    - rolearn: arn:aws:iam::AWS-ACCOUN-ID:role/myrole
      username: system:node:{{EC2PrivateDNSName}}
      groups:
      - system:bootsrappers
      - system:nodes
  mapUsers: |
    - userarn: arn:aws:iam::AWS-ACCOUN-ID:user/someusername
      username: someusername
      groups:
      - system:masters
kind: ConfigMap
metadata:
  name: aws-auth
  namespace: kube-system
```



# Allowing other non-admin users

You have different teams working on different projects who need varying levels of access to the cluster resources.
First of all, we want to have each project and environment in their own Kubernetes namespace - that's how
we define the perimeter and granularity of our permissions. Let's assume:

1. Our project name is projectA
2. Our environments are `qa`, `staging` and `production`
3. Our namespaces are - `projectA-qa`, and `projectA-staging` and `projectA-production`

We can follow the approach for adding additional admin users above and list each user, assign them to different project 
groups in Kubernetes and then regulate access based on their group and Kubernetes role bindings. 
This is how it might look like. 

First, we update the `ConfigMap` to add new entry per user in the `mapUsers` section as follows:

```
apiVersion: v1
data:
  ...
  mapUsers: |
    - userarn: arn:aws:iam::AWS-ACCOUN-ID:user/username1
      username: username1
      groups:
      - system:basic-user
      - projectA:qa

    - userarn: arn:aws:iam::AWS-ACCOUN-ID:user/username2
      username: username2
      groups:
      - system:basic-user
      - projectA:qa
  ...  
..
```
We add each user to the `system:basic-user` group which "Allows a user read-only access to basic information about themselves"
and added them to two other projectA specific groups.

The above `ConfigMap` update coupled with the "right" `kubeconfig` and AWS CLI configuration 
will allow users, `username1` and `username2` to authenticate to the EKS cluster successfully.
For completeness, a working kubeconfig will look as follows:

```
apiVersion: v1
current-context: k8s-cluster
clusters:
- cluster:
    certificate-authority-data: <ca data>
    server: <EKS endpoint>
  name: k8s-cluster
contexts:
- context:
    cluster: k8s-cluster
    namespace: projectA-qa
    user: username1
  name: username1
kind: Config
users:
- name: username1
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1alpha1
      command: aws-iam-authenticator
      args:
      - token
      - -i
      - k8s-cluster
```
However, to allow them to access project A specific resource, we will first create a `Role` and 
then a `RoleBinding` to associate the `projectA:qa` group above with the role.

The manifest for the `Role` looks as follows:

```
kind: Role
metadata:
  name: projectA-qa-human-users
  namespace: projectA-qa
rules:
- apiGroups:
  - ""
  resources:
  - services
  verbs:
  - get
- apiGroups:
  - extensions
  - apps
  resources:
  - deployments
  verbs:
  - get
- apiGroups:
  - batch
  resources:
  - cronjobs
  - jobs
  verbs:
  - get
- apiGroups:
  - ""
  resources:
  - pods
  verbs:
  - get
  - list
- apiGroups:
  - ""
  resources:
  - pods/exec
  verbs:
  - create
- apiGroups:
  - ""
  resources:
  - pods/log
  verbs:
  - get

```

The `RoleBinding` is as follows:

```
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:  
  name:  projectA-qa-human-users
  namespace: projectA-qa

roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: projectA-qa-human-users
subjects:
- apiGroup: rbac.authorization.k8s.io
  kind: Group
  name: projectA:qa
  namespace: projectA-qa
```

The key bit of information that ties in an AWS user with a certain set of permissions in the cluster
is the assignment to a group in the `ConfigMap` and the `group` assigment in the above role binding.

So:

```
                                                                    Role with certain permissions
                                                                              / \
                                                                               |
AWS user/IAM role -> Assigned to a cluster group via ConfigMap -> Role binding associates a role to the group
```

With the above setup, you have successfully granted `username1` access to your cluster and they
are confined to the `projectA-qa` namespace where they can only `exec` into pods and view the 
pods' logs. If you wanted to allow `username1` access to other projectA's environments or other
projects' environments, you would do the following:

- Update `ConfigMap` to assign `username1` to the different groups
- Create `Role`s in your cluster corresponding to your different projects' namespaces
- Create `RoleBinding`s in your cluster corresponding the different groups and roles

For adding new users such as other team members on the same project or different project
members, you would essentially repeat the process - add new user and assign them to groups.

For example:


```
apiVersion: v1
data:
  ...
  mapUsers: |
    - userarn: arn:aws:iam::AWS-ACCOUN-ID:user/username1
      username: username1
      groups:
      - system:basic-user
      - projectA:qa

    - userarn: arn:aws:iam::AWS-ACCOUN-ID:user/username2
      username: username2
      groups:
      - system:basic-user
      - projectA:qa

    - userarn: arn:aws:iam::AWS-ACCOUN-ID:user/username3
      username: username3
      groups:
      - system:basic-user
      - projectB:qa

    - userarn: arn:aws:iam::AWS-ACCOUN-ID:user/username3
      username: username3
      groups:
      - system:basic-user
      - projectB:qa

..
  ...  
..
```

An alternative to adding each individual user to the `ConfigMap` is to use IAM roles per project 
environment. So, to replicate the above using IAM roles, we would do the following:


```
apiVersion: v1
data:
  mapRoles: |
    - rolearn: arn:aws:iam::AWS-ACCOUN-ID:role/projectA-qa-humans
      username: projectA-{{SessionName}}
      groups:
      - system:basic-user
      - projectA:qa
    - rolearn: arn:aws:iam::AWS-ACCOUN-ID:role/projectB-qa-humans
      username: projectB-{{SessionName}}
      groups:
      - system:basic-user
      - projectB:qa
...

```
We don't add the individual user accounts any more. So, how do the individual users authenticate themselves
to the cluster and then access relevant resources? We use the `AssumeRole` functionality to do so. An example
kubeconfig will now look like:

```
apiVersion: v1
current-context: k8s-cluster
clusters:
- cluster:
    certificate-authority-data: <ca data>
    server: <EKS endpoint>
  name: k8s-cluster
contexts:
- context:
    cluster: k8s-cluster
    namespace: projectA-qa
    user: username1
  name: username1
kind: Config
users:
- name: username1
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1alpha1
      command: aws-iam-authenticator
      args:
      - token
      - -i
      - k8s-cluster
      - -r
      - arn:aws:iam::AWS-ACCOUN-ID:role/projectA-qa-humans

```

If we compare it to the previous kubeconfig, the change is additional two arguments to `aws-iam-authenticator`
to the end. `-r` says that we want to assume a role when fetching the token that we use to authenticate
to the cluster. The role we want to assume here is the role which we have added to the `ConfigMap` above
instead of individual users. To allow users to assume this role, we will need to do a couple of things.

Allow the IAM role `projectA-qa-humans` to be assumed by everyone in the AWS account:

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::<AWS-ACCOUNT-ID>:root"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

And then allow user's accounts to assume this role via this policy:

```
{
  "Version": "2012-10-17",
  "Statement": {
    "Effect": "Allow",
    "Action": "sts:AssumeRole",
    "Resource": "arn:aws:iam::<AWS-ACCOUNT-ID>:role/projectA-humans"
  }
}
```




## Which AWS user performed this API operation

Let's say we have rolled out the idea of using a single IAM role per project environment which 
the project's team members use (via `AssumeRole`) to access and perform operations in the Kubernetes cluster. One
question you will soon encounter is how do you identify which actual AWS user was performing
the operation? Currently, [aws-iam-authenticator](https://github.com/kubernetes-sigs/aws-iam-authenticator/issues/242)
doesn't support this. However, we can write our own solution by reading Kubernetes logs and leveraging
AWS CloudTrail. 


### API server audit logs

The specific EKS log stream we are interested in is `kube-apiserver-audit`. Entires in this log stream are similar to:

```
{
    "kind": "Event",
    "apiVersion": "audit.k8s.io/v1beta1",
    "metadata": {
        "creationTimestamp": "2019-08-22T00:13:15Z"
    },
    "level": "Request",
    "timestamp": "2019-08-22T00:13:15Z",
    "auditID": "b7140a45-50bf-4dc3-ad64-e64d211e4e6e",
    "stage": "ResponseComplete",
    "requestURI": "/api/v1/namespaces/projectA-qa/pods?limit=500",
    "verb": "list",
    "user": {
        "username": "projectA-qa-1566432791140199108",
        "uid": "heptio-authenticator-aws:<AWS-ACCOUNT-ID>:AROAUBGCRZPAQIISY7KAL",
        "groups": [
            "system:basic-user",
            "projectA:qa",
            "system:authenticated"
        ]
    },
    "sourceIPs": [
        "10.0.57.37"
    ],
    "userAgent": "kubectl/v1.12.7 (linux/amd64) kubernetes/6f48297",
    "objectRef": {
        "resource": "pods",
        "namespace": "projectA-qa",
        "apiVersion": "v1"
    },
    "responseStatus": {
        "metadata": {},
        "code": 200
    },
    "requestReceivedTimestamp": "2019-08-22T00:13:15.584533Z",
    "stageTimestamp": "2019-08-22T00:13:15.589325Z",
    "annotations": {
        "authorization.k8s.io/decision": "allow",
        "authorization.k8s.io/reason": "RBAC: allowed by RoleBinding \"projectA-qa-human-users/projectA-qa\" of Role \"projectA-qa-human-users\" to Group \"projectA:qa\""
    }
}
```

Our main interest in the above log is the `user` object and it's fields - `uid` and `username`. The `username` is composed
of two parts - a hardcoded `projectA-qa` and a generated session name - `1566432791140199108`. This was specified in the `username` field of the
`ConfigMap` (`username: projectA-{{SessionName}}`). The `uid` field is set to `"heptio-authenticator-aws:<AWS-ACCOUNT-ID>:AROAUBGCRZPAQIISY7KAL"`.
The two key bits of data here that we will use to query CloudTrial are the strings `AROAUBGCRZPAQIISY7KAL` and `1566432791140199108`.

### CloudTrail

A CloudTrail event whose `EventName` is `AssumeRole` has the following structure:

```
{
  AccessKeyId: "AKKKLKLJLJLJLLHLHLHL",
  CloudTrailEvent: "...",
  EventName: "AssumeRole",
  EventSource: "sts.amazonaws.com",
  EventTime: 2019-08-22 00:13:12 +0000 UTC,
  ReadOnly: "true",
  Resources: [
    {
      ResourceName: "AKHKHKLJLHLJLLHHLHLHL",
      ResourceType: "AWS::IAM::AccessKey"
    },
    {
      ResourceName: "1566432791140199108",
      ResourceType: "AWS::STS::AssumedRole"
    },
    {
      ResourceName: "AROAUBGCRZPAQIISY7KAL:1566432791140199108",
      ResourceType: "AWS::STS::AssumedRole"
    },
    {
      ResourceName: "arn:aws:sts::AWS-ACCOUNT-ID:assumed-role/projectA-qa-humans/1566432791140199108",
      ResourceType: "AWS::STS::AssumedRole"
    },
    {
      ResourceName: "arn:aws:iam::AWS-ACCOUNT-ID:role/projectA-qa-humans",
      ResourceType: "AWS::IAM::Role"
    }
  ],
  Username: "username1"
}
```

In the above event, if you see the third entry in the `Resources` array, you can see that the `ResourceName` is
basically composed of our two strings of interest from the kubeserver audit logs. Thus, if we search for CloudTrail
AssumeRole events for this ResourceName, we will have our actual AWS user who performed a specific operation
in the `Username` field.

You can write your own script for this. I implemented this in my hobby AWS CLI project [yawsi](https://github.com/amitsaha/yawsi).

The interface looks like:

```
$ yawsi eks whois --uid heptio-authenticator-aws:<user-id>:AROAUBGCRZPAQIISY7KAL --username projectA-qa-1566432791140199108 --lookback 6
```

The `--lookback` parameter specifies the number of hours of CloudTrail events to look back to.

## Automating kubeconfig management for human users

To allow human users to access the kubernetes cluster in a setup where we use a IAM role per project
and environment, there are a few steps involved:

- An AWS account
- Setup the AWS account with the right permissions (described below)
- Give them the EKS cluster endpoint and certificate authority data
- Generate a kubeconfig context per project environment

Once we have created the AWS account for an user with the right permissions, we can allow the users
to configure their own kubeconfig files using a tool - this is better than emailing them configuration files
or walking up to them. 

Let's talk about the permisions which also allows us to look into the steps involved.

The first thing the user needs to do is be able to query AWS for a specific cluster name. This
gives us the certificate authority data and the cluster endpoint. However, if you are using a private
EKS cluster, you will also need to account for this [issue](https://github.com/aws/containers-roadmap/issues/221)
where the cluster endpoint DNS is not resolvable from outside the cluster. The solution I have
decided to go forward is to create an `/etc/hosts` entry with the IP address which we find by
query the network interfaces in AWS. Once we have got all the information we need to talk to the cluster,
the remaining step is to generate the different project environment specific kubeconfig contexts.
To generate the project environment specific kubeconfig contexts, we need to lookup the IAM role ARN
that we want to assume while authenticating ourselves to the cluster. The conventions that I am currently
following which I have referred to previously is that the IAM role which users assume are named as: 
`<project name>-<environment>-humans`. The following IAM policy gives all these permissions:

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "NI1",
      "Effect": "Allow",
      "Action": "ec2:DescribeNetworkInterfaces",
      "Resource": "*"
    },
    {
      "Sid": "EKS1",
      "Effect": "Allow",
      "Action": [
        "eks:ListUpdates",
        "eks:DescribeUpdate",
        "eks:DescribeCluster",
        "eks:ListClusters"
      ],
      "Resource": "*"
    },
    {
      "Sid": "IAM1",
      "Effect": "Allow",
      "Action": [
        "iam:GetRole"
      ],
      "Resource": "arn:aws:iam::AWS-ACCOUNT-ID:role/*-humans"
    }
  ]
}
```

And ofcourse, we need to allow the user to assume the project environment specific role:

```
{
  "Version": "2012-10-17",
  "Statement": {
    "Effect": "Allow",
    "Action": "sts:AssumeRole",
    "Resource": "arn:aws:iam::AWS-ACCOUNT-ID:role/projectA-qa-humans"
  }
}
```
(Instead of managing these permissions for individual users, I am using AWS user groups
and assigning users to relevant groups and managing policies at the group level).

I have implemented this in the `yawsi` project. To create a kubeconfig context if you want to access the 
EKS cluster as a individual AWS user:

```
$ yawsi eks create-kube-config --cluster-name <your-cluster-name>
Kubeconfig written

--------------------------/etc/hosts/ file entry ---------------------

<ip> <EKS cluster endpoint>
```


To create a kubeconfig context if you want to access the EKS cluster by assuming another role
which follows the specified convention above:

```
$ yawsi eks create-kube-config --cluster-name <your-cluster-name> --project projectA --environment qa
Kubeconfig written

--------------------------/etc/hosts/ file entry ---------------------

<ip> <EKS cluster endpoint>
```

Checkout the other [eks related commands](https://github.com/amitsaha/yawsi/blob/master/docs/yawsi_eks.md).


# Non human users 

For non-human users, we can once again leverage IAM roles for authentication and groups and role bindings
for authorization. I will discuss two scenarios which brings to light two different use cases.

## Deployment of applications

Let's consider a scenario where we use Jenkins running outside the cluster to build and deploy applications 
to our kubernetes cluster. Simply because of the operations that Jenkins will need to perform
on the cluster, it will need a very large set of permissions which will cross any project and environment specific
permiters we have set in our cluster such as namespaces. Hence, if we assign an IAM role to the Jenkins build instances, 
add the role to the `ConfigMap` as above and assign the various groups to it, we will end up with almost
admin level access to the cluster. We do want to avoid this scenario by making it slightly more complicated. 

We wil use the IAM role for the authentication to the cluster. However, we will use separate service accounts per project
environment and then use the corresponding credentials when performing operations on a specific project environment.
A service account will only have permissions to perform operations in a specific namespace.

Let's see an example of creating a service account, creating a role with permissions to perform operations
one would usually need to perform deployments, and then creating a role binding with this service acccount:


```
apiVersion: v1
kind: ServiceAccount
metadata:
  name: jenkins-projectA
  namespace: projectA-qa
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: jenkins-projectA
  namespace: projectA-qa
rules:
- apiGroups:
  - ""
  resources:
  - services
  verbs:
  - '*'
- apiGroups:
  - extensions
  - apps
  resources:
  - deployments
  verbs:
  - '*'
- apiGroups:
  - batch
  resources:
  - cronjobs
  - jobs
  verbs:
  - '*'
- apiGroups:
  - ""
  resources:
  - pods
  verbs:
  - get
  - list
- apiGroups:
  - ""
  resources:
  - pods/log
  verbs:
  - get
---
apiVersion: rbac.authorization.k8s.io/v1beta1
kind: RoleBinding
metadata:
  name: jenkins-projectA-role-binding
  namespace: projectA-qa
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: jenkins-projectA
subjects:
- kind: ServiceAccount
  name: jenkins-projectA
  namespace: projectA-qa
```

Once the above service account is created, we can then get the token corresponding to the service account
and then use that when performing operations on the cluster for a project via `kubectl --token <token>`.

For completeness, the `ConfigMap` entry would like this:

```
apiVersion: v1
data:
  mapRoles: |
    - rolearn: arn:aws:iam::AWS-ACCOUNT-ID:role/Jenkins
      username: system:node:{{EC2PrivateDNSName}}
      groups:
      - system:basic-user
      ...
```

## Read only access to the cluster API 

Let's consider a scenario where you want to run some software outside the cluster which will need to make API
calls to the cluster to read various information - example, for monitoring. In this case, we can use an approach
similar to we do for human non-admin users:

```
apiVersion: v1
data:
  mapRoles: |
  - rolearn: arn:aws:iam::AWS-ACCOUNT-ID:role/Monitoring
      username: system:node:{{EC2PrivateDNSName}}
      groups:
      - monitoring
```

We augment this with a `ClusterRole` and `ClusterRoleBinding` as follows:

```
# Role defined here
....

apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: monitoring
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: monitoring-role
subjects:
  - apiGroup: rbac.authorization.k8s.io
    kind: Group
    name: monitoring
```

# Conclusion

In this post, I have discussed how we can leverage AWS Identity and Access Management features for authentication
and authorization in an AWS EKS cluster setup. With the right amount of convention and automation, we can come up
with a simple and easy to understand and reason approach. Time will tell how this scales though.

# Resources

To learn more, please refer to the following:

- https://kubernetes.io/docs/reference/access-authn-authz/controlling-access/
- https://kubernetes.io/docs/reference/access-authn-authz/rbac/
- https://docs.aws.amazon.com/eks/latest/userguide/security-iam.html