---
title:  An approach to user access management on AWS EKS Kubernetes cluster
date: 2019-08-23
categories:
-  infrastructure
---


When implementing a solution for allowing users other than the cluster creator to access the cluster resources we are 
faced with two fairly old generic problems - authentication and authorization. There are various ways one can solve 
these problems. I will discuss one such solution in this post. It makes use of AWS Identity and access management (IAM) 
features. This in my humble opinion is the simplest and hopefully secure enough solution when it comes to EKS.

## Allowing nodes to join the cluster

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


## Allowing other admins

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



## Allowing other non-admin users

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


## Non human users 

For non-human users, we can once again leverage IAM roles for authentication and groups and role bindings
for authorization. I will discuss two scenarios which brings to light two different use cases.

### Deployment of applications

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

### Read only access to the cluster API 

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

## Which AWS user performed this API operation?

To be completed.

## Automating kubeconfig management for human users

To be completed.

## Conclusion

To be completed.