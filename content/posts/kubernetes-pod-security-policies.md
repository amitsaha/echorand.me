---
title: Kubernetes pod security policies
date: 2020-05-20
categories:
-  infrastructure
---
Welcome to this new blog post!

- [Introduction](#introduction)
- [Enforcing policies](#enforcing-policies)
- [Using `kustomize` to manage policies](#using-kustomize-to-manage-policies)
- [Rolling the policy changes out](#rolling-the-policy-changes-out)
- [Multiple matching policies](#multiple-matching-policies)
- [Conclusion](#conclusion)
# Introduction

Pod security policies are [cluster level resources](https://kubernetes.io/docs/concepts/policy/pod-security-policy/).
The Google cloud [docs](https://cloud.google.com/kubernetes-engine/docs/how-to/pod-security-policies) has some basic
human friendly docs.  A `psp` is a way to enforce certain policies that `pod` needs to comply with before it's allowed 
to be scheduled to be run on the cluster - create or an update operation (perhaps a restart of the pod?). Essentially,
it is a type of a [validating admission controller](https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/). 

I should mention that I found it (later on) to think about pod security policies as a way to "control" various
attributes of a pod. Hence, the [pod spec](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.14/#podspec-v1-core) is worth referring to simultaneously.

The  summarized version of how pod security policies are enforced in practice is:

- Cluster admin creates a policy (`psp`)
- Cluster admin creates a cluster role allowing usage of the policy
- CLuster admin creates a cluster role binding assigning subjects to the above role and hence allow usage of the policy

On an AWS [EKS cluster](https://docs.aws.amazon.com/eks/latest/userguide/pod-security-policy.html), we can see there 
is an existing policy already defined:

```
$ kubectl describe psp
Name:  eks.privileged

Settings:
  Allow Privileged:                       true
  Allow Privilege Escalation:             true
  Default Add Capabilities:               <none>
  Required Drop Capabilities:             <none>
  Allowed Capabilities:                   *
  Allowed Volume Types:                   *
  Allow Host Network:                     true
  Allow Host Ports:                       0-65535
  Allow Host PID:                         true
  Allow Host IPC:                         true
  Read Only Root Filesystem:              false
  SELinux Context Strategy: RunAsAny      
    User:                                 <none>
    Role:                                 <none>
    Type:                                 <none>
    Level:                                <none>
  Run As User Strategy: RunAsAny          
    Ranges:                               <none>
  FSGroup Strategy: RunAsAny              
    Ranges:                               <none>
  Supplemental Groups Strategy: RunAsAny  
    Ranges:                               <none>

```

The granular permissions are documented [here](https://kubernetes.io/docs/concepts/policy/pod-security-policy/#policy-reference), but the above policy essentially allows pods to be created with all the permissions available.

We also have an associated cluster role binding:

```
$ kubectl describe clusterrolebinding eks:podsecuritypolicy:authenticated 
Name:         eks:podsecuritypolicy:authenticated
Labels:       eks.amazonaws.com/component=pod-security-policy
              kubernetes.io/cluster-service=true
Annotations:  kubectl.kubernetes.io/last-applied-configuration:
                {"apiVersion":"rbac.authorization.k8s.io/v1","kind":"ClusterRoleBinding","metadata":{"annotations":{"kubernetes.io/description":"Allow all...
              kubernetes.io/description: Allow all authenticated users to create privileged pods.
Role:
  Kind:  ClusterRole
  Name:  eks:podsecuritypolicy:privileged
Subjects:
  Kind   Name                  Namespace
  ----   ----                  ---------
  Group  system:authenticated  

```

The details are documented in the EKS documentation above, but essentially the above role binding allows all
authenticated users (group: `system:authenticated`) to make use of the above policy - or, any authenticated user
is allowed to run privileged pods with *no* policy enforced. Now, if we see which policy *any* pod is running with, it
will show that it is using the `eks.privileged` policy:

```
$ kubectl -n <my-ns> get pod xledger-api-79c745d7d7-ng2j2  -o jsonpath='{.metadata.annotations.kubernetes\.io\/psp}'
eks.privileged
```

Now, the reason we have the default pod security policy and the binding is that there *must* be a pod security policy 
that is defined in your cluster to allow a pod to be scheduled for running if you have the admission controller 
enabled. If there was no default policy, no pod would be "admitted" by the cluster.

# Enforcing policies

So, let's say we want to make things better. One way to do would be to define workload specific policies and a
default restricted policy. The workload specific policies would have certain privileged access, but not all
and they would be explicitly granted via making use of service accounts. The default would however be the 
restricted policy. Let's first look at the restricted policy which will apply to all authenticated "users":

```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: default
spec:
  privileged: false
  # Required to prevent escalations to root.
  allowPrivilegeEscalation: false
  # This is redundant with non-root + disallow privilege escalation,
  # but we can provide it for defense in depth.
  requiredDropCapabilities:
    - ALL
  # Allow core volume types.
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    # Assume that persistentVolumes set up by the cluster admin are safe to use.
    - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    # This policy assumes the nodes are using AppArmor rather than SELinux.
    rule: 'RunAsAny'
  supplementalGroups:
    rule: 'MustRunAs'
    ranges:
      # Forbid adding the root group.
      - min: 1
        max: 65535
  fsGroup:
    rule: 'MustRunAs'
    ranges:
      # Forbid adding the root group.
      - min: 1
        max: 65535
  readOnlyRootFilesystem: false
```

To come up with the workload specific policies, we need to first figure out what kind of privileged access we need
to allow them to have.  We will need to make sure that the custom policies we enforce account for
the permissions that these pods need. [kube-psp-advisor](https://github.com/sysdiglabs/kube-psp-advisor) is an useful
tool that helps us here. The `inspect` sub-command can examine your cluster and generate pod security policies
as well as grants for those policies. Thus a starting point would be to examine each namespace of your cluster
where you have workloads and run: 

```
$ kubectl-advise-psp inspect --grant -n <your namespace>
```

Once you have got all the policies you have for all the workloads, you will quickly see that for each workload,
we will create a:

- Pod Security Policy
- Cluster Role
- Cluster Role Binding

Hence, to minimize duplication, we can make use of [kustomize](https://kustomize.io/).

# Using `kustomize` to manage policies

We can use `kustomize` base and overlays in the following manner to manage the various policies:

```
.
├── base
│   ├── kustomization.yaml
│   ├── kustomizeconfig.yaml
│   ├── psp.yaml
│   ├── rolebinding.yaml
│   └── role.yaml
├── overlays
│   ├── aws-node
│   ├── calico-node
│   ├── calico-typha-autoscaler
│   ├── coredns
│   ├── fluent-bit
│   ├── ingress-controllers
│   ├── restricted

..
```

Let's look at the `base/psp.yaml`:

```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: default
  annotations:
    seccomp.security.alpha.kubernetes.io/allowedProfileNames: 'docker/default,runtime/default'
    seccomp.security.alpha.kubernetes.io/defaultProfileName:  'runtime/default'
  labels:
    kubernetes.io/cluster-service: "true"

```

We don't define any policy at all here, but just define the `PodSecurityPolicy` resource.

Let's look at `base/role.yaml`:

```yaml

apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: psp-default
  labels:
    kubernetes.io/cluster-service: "true"
    eks.amazonaws.com/component: pod-security-policy
rules:
- apiGroups:
  - policy
  resourceNames:
  - default
  resources:
  - podsecuritypolicies
  verbs:
  - use

```

The above `ClusterRole` allows using the `default` pod security policy.

Tying the above `role` and `psp` resources is the `ClusterRoleBinding` as follows in `base/rolebinding.yaml`:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: psp-default
  labels:
    kubernetes.io/cluster-service: "true"
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: psp-default

```

The cluster role binding above doesn't specify any subjects.

Before we look at the overlays, let's look at the `kustomization.yaml`:

```yaml
resources:
- psp.yaml
- role.yaml
- rolebinding.yaml
configurations:
- kustomizeconfig.yaml
```

The interesting bit here for our purpose is the `kustomizeconfig.yaml` file:

```yaml
nameReference:
- kind: PodSecurityPolicy
  fieldSpecs:  
  - path: rules/resourceNames
    kind: ClusterRole
```

`nameReference` transformer which I originally learned about from this 
[issue](https://github.com/kubernetes-sigs/kustomize/issues/1646) allows us to use the name of a resource in another
resource. If you look at the base configuration above, you may have been thinking how do we refer to the pod
security policy (`kind: PodSecurityPolicy`) we generated in a overlay in the cluster role (`kind: ClusterRole`) for
the overlay. `nameReference` allows us to do just that. In plain terms, the above `nameReference` transformer 
essentially substitutes reference to `rules/resourceNames` in `ClusterRole` to the name of `PodSecurityPolicy` 
generated in that specific overlay.

The result is that an overlay directory looks like this:

```
restricted
├── kustomization.yaml
└── restricted.yaml

```

The `kustomization.yaml` file has the following contents:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
bases:
- ../../base
namePrefix: restricted-
patches:
- restricted.yaml
```

The `namePrefix` here is used to somewhat indicate the specific workload we are generating the policy for. 

The `restricted.yaml` file defines the overlay for the `PodSecurityPolicy` and the `ClusterRoleBinding`:

```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: default
spec:
  privileged: false
  # Required to prevent escalations to root.
  allowPrivilegeEscalation: false
  # This is redundant with non-root + disallow privilege escalation,
  # but we can provide it for defense in depth.
  requiredDropCapabilities:
    - ALL
  # Allow core volume types.
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    # Assume that persistentVolumes set up by the cluster admin are safe to use.
    - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    # This policy assumes the nodes are using AppArmor rather than SELinux.
    rule: 'RunAsAny'
  supplementalGroups:
    rule: 'MustRunAs'
    ranges:
      # Forbid adding the root group.
      - min: 1
        max: 65535
  fsGroup:
    rule: 'MustRunAs'
    ranges:
      # Forbid adding the root group.
      - min: 1
        max: 65535
  readOnlyRootFilesystem: false
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: psp-default
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: system:authenticated
```

Note that we don't need to define the `ClusterRole` in the overlay at all. If we look at the `ClusterRole` definition
in the `base/role.yaml` file above, we will see that it only needs reference to the `PodSecurityPolicy` name that
will be generated. The `nameReference` transformer takes care of that.

With the above overlay, when we run `kustomize build`, we get the following:

```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  annotations:
    seccomp.security.alpha.kubernetes.io/allowedProfileNames: docker/default,runtime/default
    seccomp.security.alpha.kubernetes.io/defaultProfileName: runtime/default
  labels:
    kubernetes.io/cluster-service: "true"
  name: restricted-default
spec:
  allowPrivilegeEscalation: false
  fsGroup:
    ranges:
    - max: 65535
      min: 1
    rule: MustRunAs
  hostIPC: false
  hostNetwork: false
  hostPID: false
  privileged: false
  readOnlyRootFilesystem: false
  requiredDropCapabilities:
  - ALL
  runAsUser:
    rule: MustRunAsNonRoot
  seLinux:
    rule: RunAsAny
  supplementalGroups:
    ranges:
    - max: 65535
      min: 1
    rule: MustRunAs
  volumes:
  - configMap
  - emptyDir
  - projected
  - secret
  - persistentVolumeClaim
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  labels:
    eks.amazonaws.com/component: pod-security-policy
    kubernetes.io/cluster-service: "true"
  name: restricted-psp-default
rules:
- apiGroups:
  - policy
  resourceNames:
  - restricted-default
  resources:
  - podsecuritypolicies
  verbs:
  - use
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  labels:
    kubernetes.io/cluster-service: "true"
  name: restricted-psp-default
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: restricted-psp-default
subjects:
- apiGroup: rbac.authorization.k8s.io
  kind: Group
  name: system:authenticated
```
# Rolling the policy changes out

Once we have written our policies and applied them to the cluster, they will not affect any of the currently running
workloads unless any of the pods has been killed and hence restarted, etc. 

Hence, to "switch over" the current workloads to use the policies we created, we will need to do the following:

- Remove the existing default `ClusterRoleBinding`
- Restart the existing workloads - `kubectl rollout restart` really helps here

This step is prone to cause interruptions if the policy has not been set correctly or there are multiple
matching policies (see next). Hence, exercise caution. In my experience `kube-psp-advisor` really helped here.

# Multiple matching policies

To summarize how a pod creation operation and pod security policies admission controller interacts:

1. Pod creation request is received
2. An attempt is made to find a matching policy for the pod
3. If a matching policy is found, is this policy allowed to be used by the pod is checked
4. If the above check passes, the pod is "admitted", else "rejected".

Now, what happens if we have multiple matching policies in step 2? The kubernetes [documentation](https://v1-14.docs.kubernetes.io/docs/concepts/policy/pod-security-policy/#policy-order) on this topic has changed 
between [releases](https://kubernetes.io/docs/concepts/policy/pod-security-policy/) , but illustrates 
another aspect of pod security policy - mutating and non-mutating. We have established that each pod *has* to 
have a  pod security policy enabled. Now, the pod security policy that matches  a pod doesn't need to specify all 
the various fields. In that scenario, the fields not specified will be attached to the pod with their default values. 
Thus, this is a "mutating" pod security policy. However, if the policy specified all fields, this would be attached as 
is to the pod and hence be a "non-mutating" pod security policy.

For kubernetes 1.14, this is what the documentation says will happen when there are multiple matching policies:

1. If any policies successfully validate the pod without altering it, they are used.
2. If it is a pod creation request, then the first valid policy in alphabetical order is used.
3. Otherwise, if it is a pod update request, an error is returned, because pod mutations are 
disallowed during update operation


(1) above is really confusing and hence it has been fixed in the docs for a [while](https://github.com/kubernetes/website/commit/7f90c73a01664c42746b734b1911143c884741bb#diff-a5873cb014f885fa40ee16cfdccddd30) and is currently this:

1. PodSecurityPolicies which allow the pod as-is, without changing defaults or mutating the pod, are preferred. 
The order of these non-mutating PodSecurityPolicies doesn’t matter.
2. If the pod must be defaulted or mutated, the first PodSecurityPolicy (ordered by name) to allow the pod is selected.

Note: During update operations (during which mutations to pod specs are disallowed) only non-mutating PodSecurityPolicies are
used to validate the pod.

The logic is implemented in the Kubernetes source code 
[here](https://github.com/kubernetes/kubernetes/blob/323f34858de18b862d43c40b2cced65ad8e24052/plugin/pkg/admission/security/podsecuritypolicy/admission.go\#L209)

I would like to add one more point to the above which matches the source code which is - even if there is a mutating
pod security policy, it will prefer a non-mutating policy if it exists. This is still subject to the permission
check which happens after a matching policy is found.

# Conclusion

Pod Security policies are a great way to enforce compliance on your workloads as a cluster admin. Some links to resources
which I made use of while working on this are:

- [Kubernetes documentation](https://kubernetes.io/docs/concepts/policy/pod-security-policy/#policy-order)
- [EKS documentation on the topic](https://docs.aws.amazon.com/eks/latest/userguide/pod-security-policy.html)
- [kube-psp-advisor](https://github.com/sysdiglabs/kube-psp-advisor)
- [Basic Go program to list all pods and their pod security policies](https://gist.github.com/amitsaha/581c2abafc8bcf71849a74e4d2683792)
