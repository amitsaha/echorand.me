---
title: Using Gatekeeper in Kubernetes
date: 2020-05-28
categories:
-  infrastructure
---

# Introduction

[Gatekeeper](https://github.com/open-policy-agent/gatekeeper/) allows a Kubernetes administrator
to implement policies for ensuring compliance and best practices in their cluster. It makes use of
Open Policy Agent (OPA) and is a [validating admission controller](https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/#validatingadmissionwebhook).
The policies are written in the [Rego](https://www.openpolicyagent.org/docs/latest/policy-language/) language.
Gatekeeper embraces Kubernetes native concepts such as Custom Resource Definitions (CRDs) and hence the policies are managed
as kubernetes resources.  The [GKE docs](https://cloud.google.com/anthos-config-management/docs/concepts/policy-controller) on
this topic are a good place to learn more.

Before we dive deep into Gatekeeper itself, let's first familiarize
ourselves with the Rego language. One point worth nothing is Rego and OPA can be used for policy
enforcement beyond Kubernetes, however, we are going to focus on Kubernetes *objects*.

# Writing our first policy

Let's look at a policy which will fail if the `namespace` of an object is `default`:

```
package k8svalidnamespace
        
violation[{"msg": msg, "details": {}}] {
  value := input.review.object.metadata.namespace
  value == "default"
  msg := sprintf("Namespace should not be default: %v", [value])
}
```

The first line of this policy defines a namespace  or package for the policy. Each policy must reside in a package. 

Next, we define a `violation` *block* which "returns" two objects, "msg" and "details" to the calling framework.
If you are coming to gatekepper from OPA documentation, you will notice that OPA has `deny` block, whereas
`gatekeeper` has `violation` blocks. I am not sure why, but this was changed in 
[gatekeeper](https://github.com/open-policy-agent/gatekeeper/issues/168) a while back. This is the "entrypoint" for
a rule as per the [OPA constraint framework guide](https://github.com/open-policy-agent/frameworks/tree/master/constraint#opa-constraint-framework).

The statements inside this block i.e. inside the `{}` are [Rego](https://www.openpolicyagent.org/docs/latest/policy-language/#the-basics) expressions.

The expression `value := input.review.object.metadata.namespace` assigns the value of `input.review.object.metadata.namespace` 
to the variable `value`. The `input` object contains the entire JSON object that Gatekeeper provides to the policy when evaluating
it.

Next, we check whether the value of this variable is "default" using `value == "default"`. Only if this condition
evaluates to `true`, the policy will be violated. If we have more than one conditional statement, all the comparisons
must evaluate to `true` for the policy to be evaluted (see next example below).

In the final line of the policy, we use the `sprintf` function to construct an error message which is stored in the `msg`
object and hence automatically "returned". 

Given the above policy and an input document, let's test it out in the [Rego playground](https://play.openpolicyagent.org/p/SI62cRuOEh).

For reference, the input is:

```
{
    "kind": "AdmissionReview",
    "parameters": {},
    "review": {
        "kind": {
            "kind": "Pod",
            "version": "v1"
        },
        "object": {
            "metadata": {
                "name": "myapp",
                "namespace": "default"
            },
            "spec": {
                "containers": []
            }
        }
    }
}

```

The output you will see is:

```
{
    "violation": [
        {
            "details": {},
            "msg": "Namespace should not be default: default"
        }
    ]
}
```
## Policy with two conditions in a rule

Let's now say that in addition to check if the `namespace` is default, we also want to check if the namespace
is an empty string. In other words, we want the policy to be violated if either the namespace is empty or the
namespace is default. Here's the first version of the policy which doesn't work as expected:

```
package k8svalidnamespace
        
violation[{"msg": msg, "details": {}}] {          
  value := input.review.object.metadata.namespace          
  value == ""
  value == "default"
  msg := sprintf("Namespace should not be default: %v", [value])
}
```

I wrote this version in a hurry and I don't know what I was expecting. Someone in open policy agent slack then pointed me 
to the issue. Even then we can use the above wrong policy to understand a bit more about how policy evaluation works.
Given the same input as the first policy, the policy evaluation will *stop* at the expression, `value == ""`. It evaluates
to false and hence the above rule is not violated and hence we wouldn't see any violations. 

In addition, consider the following input document:

```
{
    "kind": "AdmissionReview",
    "parameters": {},
    "review": {
        "kind": {
            "kind": "Pod",
            "version": "v1"
        },
        "object": {
            "metadata": {
                "name": "myapp",
                "namespace": ""
            },
            "spec": {
                "containers": []
            }
        }
    }
}
```

When we evaluate the policy above with the above input document, the first comparison `(value == ""`) evaluates to `true`,
but the second comparsion `(value == "default")` evaluates to false. Hence, the policy isn't violated - not what
we wanted.

As the last case, let's consider an input document with no `namespace` defined at all:

```
{
    "kind": "AdmissionReview",
    "parameters": {},
    "review": {
        "kind": {
            "kind": "Pod",
            "version": "v1"
        },
        "object": {
            "metadata": {
                "name": "myapp"                
            },
            "spec": {
                "containers": []
            }
        }
    }
}
```

When given this input document, via some Rego magic, the policy is not evaluated at all. Perhaps it detects that
the input object doesn't have the `namespace` field defined and hence decides not to evaluate and hence there is
no violation of the policy.

## OR rules

Let's now write the correct version of the policy to cause a violation if either the namespace is undefined,
empty string or `default`:

```
package k8svalidnamespace
     
violation[{"msg": msg, "details": {}}] {
  not input.review.object.metadata.namespace
  msg := "Namespace should not be unspecified"          
}
        
violation[{"msg": msg, "details": {}}] {
  value := input.review.object.metadata.namespace
  count(value) == 0
  msg := sprintf("Namespace should not be empty: %v", [value])          
}
        
violation[{"msg": msg, "details": {}}] {
  value := input.input.review.object.metadata.namespace
  value == "default"
  msg := sprintf("Namespace should not be default: %v", [value])          
}
```

We have three `violation` blocks in the above policy each containing one conditional expression. The entire policy
will be violated if any of the violation blocks are true.

### Invalid input - Unspecified namespace

Let's consider an input document with no namespace specified:

```

 {
        "kind": "AdmissionReview",
        "parameters": {},
        "review": {
            "kind": {
                "kind": "Pod",
                "version": "v1"
            },
            "object": {
                "metadata": {
                    "name": "myapp"
                },
                "spec": {
                    "containers": []
                }
            }
        }
    }

```

When the above policy is evaluated given the above input document, the first rule evaluates to `true`
and hence we have a violation. The other rules are not evaluated at all - not because the first rule
evaluates to `true`, but because the object doesn't have the `namespace` field.

### Invalid input - Empty namespace

Let's now consider the following input document:

```

 {
        "kind": "AdmissionReview",
        "parameters": {},
        "review": {
            "kind": {
                "kind": "Pod",
                "version": "v1"
            },
            "object": {
                "metadata": {
                    "name": "myapp",
                    "namespace": ""
                    
                },
                "spec": {
                    "containers": []
                }
            }
        }
    }

```

For this policy, the first rule is not violated, but the second rule is, and the third rule is not violated
either.


### Invalid input - default namespace

Now, consider the input document as:

```

 {
        "kind": "AdmissionReview",
        "parameters": {},
        "review": {
            "kind": {
                "kind": "Pod",
                "version": "v1"
            },
            "object": {
                "metadata": {
                    "name": "myapp",
                    "namespace": "default"
                    
                },
                "spec": {
                    "containers": []
                }
            }
        }
    }

```

For this input document, only the last rule is violated and we get a violation from the policy.

### Valid Input

Now, consider the following input document:

```

 {
        "kind": "AdmissionReview",
        "parameters": {},
        "review": {
            "kind": {
                "kind": "Pod",
                "version": "v1"
            },
            "object": {
                "metadata": {
                    "name": "myapp",
                    "namespace": "default1"
                    
                },
                "spec": {
                    "containers": []
                }
            }
        }
    }

```

For the above input, the policy will report no violations.

# A more complicated policy

Let's now write a policy to ensure that only containers from certain repositories
should be allowed to run on the cluster:

```
package k8sallowedrepos

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  satisfied := [good | repo = input.parameters.repos[_] ; good = startswith(container.image, repo)]
  not any(satisfied)
  msg := sprintf("container <%v> has an invalid image repo <%v>, allowed repos are %v", [container.name, container.image, input.parameters.repos])
}
```

The first line of the `violation` block is:

```
container := input.review.object.spec.containers[_]
```

The above expression essentially boils down to the `container` variable containing
a list of all elements in input the `containers` object. To learn more about
the special `_` index, see the [documentation](https://www.openpolicyagent.org/docs/latest/policy-language/#variable-keys).

The second line of the `violation` block is:

```
satisfied := [good | repo = input.parameters.repos[_] ; good = startswith(container.image, repo)]
```

The above line is an example of [comprehension](https://www.openpolicyagent.org/docs/latest/policy-language/#comprehensions) and it essentially executes the following pseudocode:

```
For each repo in the list of allowed repos
  For each container in the list of container objects
    Is container.image starting with any of the repos in the list of allowed repos?
    If so, append "true" to the array "satisfied", else append "false"
  End For
  # Evalute the rule not any(satisfied) and report violation if any
End For
```

The result of the above is an array `satisfied` with the same number of elements
as the number of allowed repos in the `input.parameters.repos` object, with each value being `true`
or `false`.

The third line of the violation block is our condition, `not any(satisfied)`. `any(satisfied)`
evaluates to `true` if any of the values in the `satisfied` list is `true` and `false` otherwise.
It's really important to note here that lines 2-4 in the violation block are "executed" for
each item in the `container` array. 

Hence, given the following input document:

```json
{
  "kind": "AdmissionReview",
  "parameters": {
    "repos": [      
      "quay.io/calico",      
      "k8s.gcr.io",
      "602401143452.dkr.ecr.us-west-2.amazonaws.com/amazon-k8s-cni"
    ]
  },
  "review": {
    "kind": {
      "kind": "Pod",
      "version": "v1"
    },
    "object": {
      "spec": {
        "containers": [
          {
            "image": "amazon-k8s-cni",
            "name": "mysql-backend"
          },
          {
            "image": "nginx",
            "name": "nginx-frontend"
          }          
        ]
      }
    }
  }
}
```

We will see the following as the output: ([Rego playground link](https://play.openpolicyagent.org/p/7zMy2YH8Pu))

```
{
    "violation": [
        {
            "msg": "container <mysql-backend> has an invalid image repo <amazon-k8s-cni>, allowed repos are [\"277433404353.dkr.ecr.eu-central-1.amazonaws.com\", \"quay.io/open-policy-agent\", \"quay.io/calico\", \"quay.io/kubernetes-ingress-controller\", \"k8s.gcr.io\", \"602401143452.dkr.ecr.us-west-2.amazonaws.com/amazon-k8s-cni\"], satisfied: [false, false, false, false, false, false]"
        },
        {
            "msg": "container <nginx-frontend> has an invalid image repo <nginx>, allowed repos are [\"277433404353.dkr.ecr.eu-central-1.amazonaws.com\", \"quay.io/open-policy-agent\", \"quay.io/calico\", \"quay.io/kubernetes-ingress-controller\", \"k8s.gcr.io\", \"602401143452.dkr.ecr.us-west-2.amazonaws.com/amazon-k8s-cni\"], satisfied: [false, false, false, false, false, false]"
        }
    ]
}
```
  
# Rego Unanswered Questions

I am still trying to get my head around Rego. Here's some questions I have:

1. Difference between "=" and ":="
2. Lot more than I can write here, hopefully will be updated.


# Setting up Gatekeeper

Install Gatekeeper as per instructions [here](https://github.com/open-policy-agent/gatekeeper#installation-instructions). The following resources are created:

```
ClusterRole:

        - gatekeeper-manager-role from gatekeeper.yaml

ClusterRoleBinding:

        - gatekeeper-manager-rolebinding from gatekeeper.yaml

CustomResourceDefinition:

        - configs.config.gatekeeper.sh from gatekeeper.yaml
        - constrainttemplates.templates.gatekeeper.sh from gatekeeper.yaml

Deployment:

        - gatekeeper-controller-manager in gatekeeper-system from gatekeeper.yaml

Namespace:

        - gatekeeper-system from gatekeeper.yaml

Role:

        - gatekeeper-manager-role in gatekeeper-system from gatekeeper.yaml

RoleBinding:

        - gatekeeper-manager-rolebinding in gatekeeper-system from gatekeeper.yaml

Secret:

        - gatekeeper-webhook-server-cert in gatekeeper-system from gatekeeper.yaml

Service:

        - gatekeeper-webhook-service in gatekeeper-system from gatekeeper.yaml

ServiceAccount:

        - gatekeeper-admin in gatekeeper-system from gatekeeper.yaml

ValidatingWebhookConfiguration:

        - gatekeeper-validating-webhook-configuration from gatekeeper.yaml

```

In addition, you may need to create sync configuration for [replicating data](https://github.com/open-policy-agent/gatekeeper/#replicating-data).

# Creating a constraint template

Now that we have gatekeeper components installed, the first concept we need to learn is that of a 
`ConstraintTemplate` - which lays down the schema of the data as well as the policy itself in the 
[Rego](https://www.openpolicyagent.org/docs/latest/policy-language/) language.

The `ConstraintTemplate` kind is used to create a new constraint template with the name being `K8sRequiredLabels`:

```
apiVersion: templates.gatekeeper.sh/v1beta1
kind: ConstraintTemplate
metadata:
  name: k8srequiredlabels
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredLabels
        listKind: K8sRequiredLabelsList
        plural: k8srequiredlabels
        singular: k8srequiredlabels
      validation:
        # Schema for the `parameters` field
        openAPIV3Schema:
          properties:
            labels:
              type: array
              items: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8srequiredlabels

        violation[{"msg": msg, "details": {"missing_labels": missing}}] {
          provided := {label | input.review.object.metadata.labels[label]}
          required := {label | label := input.parameters.labels[_]}
          missing := required - provided
          count(missing) > 0
          msg := sprintf("you must provide labels: %v", [missing])
        }

```

Once we create the above constraint template, we can list it using `kubectl`:

```
$ kubectl get constrainttemplates.templates.gatekeeper.sh                                                            │
NAME                AGE                                                                                                                      
k8srequiredlabels   99s   
```


# Creating a constraint

Let's now define a constraint using the constraint template, `K8sRequiredLabels` (`kind: K8sRequiredLabels`):

```
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata:
  name: ns-must-have-gk
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Namespace"]
  parameters:
    labels: ["gatekeeper"]
 ```

Let's create the constraint:

```
$ kubectl apply -f required_labels.yaml 
k8srequiredlabels.constraints.gatekeeper.sh/ns-must-have-gk created
```

We can use `kubectl get` to fetch constraints of this template type:

```
$ kubectl get k8srequiredlabels.constraints.gatekeeper.sh
NAME              AGE
ns-must-have-gk   77s
```

# Testing the constraint

Let's now test this constraint by creating a namespace without the label:

```
apiVersion: v1
kind: Namespace
metadata:
  name: test
```

If we now run `kubectl apply` on the above definition, we will get:

```
$ kubectl apply -f ns.yaml 
Error from server ([denied by ns-must-have-gk] you must provide labels: {"gatekeeper"}): error when creating "ns.yaml": admission webhook "validation.gatekeeper.sh" denied the request: [denied by ns-must-have-gk] you must provide labels: {"gatekeeper"}

```

# Audit

Gatekeeper by default has an auditing functionality via which it evaluates the constraints and stores the audit
results on the constraint's `status` field. For this purpose, Gatekeeper will query the Kubernetes API for the
resources that your constraint specifies and validate the resources against the constraints.

Here's an example:

```
$ kubectl get k8srequiredlabels.constraints.gatekeeper.sh -o yaml                                                    
apiVersion: v1
items:
- apiVersion: constraints.gatekeeper.sh/v1beta1
  kind: K8sRequiredLabels
  metadata:
    annotations:
      kubectl.kubernetes.io/last-applied-configuration: |
        {"apiVersion":"constraints.gatekeeper.sh/v1beta1","kind":"K8sRequiredLabels","metadata":{"annotations":{},"name":"ns-must-have-gk"},"spec":{"match":{"kinds":[{"apiGroups":[""],"kinds":["Namespace"]}]},"parameters":{"labels":["gatekeeper"]}}}
    creationTimestamp: "2020-05-21T04:21:17Z"
    generation: 1
    name: ns-must-have-gk
    resourceVersion: "1722780"
    selfLink: /apis/constraints.gatekeeper.sh/v1beta1/k8srequiredlabels/ns-must-have-gk
    uid: 640dee9f-8f3e-4f3a-9716-599f54cbd18b
  spec:
    match:
      kinds:
      - apiGroups:
        - ""
        kinds:
        - Namespace
    parameters:
      labels:
      - gatekeeper
  status:
    auditTimestamp: "2020-05-21T04:40:17Z"
    byPod:
    - enforced: true
      id: gatekeeper-controller-manager-55bfb4d454-w6424
      observedGeneration: 1
    totalViolations: 7
    violations:
    - enforcementAction: deny
      kind: Namespace
      message: 'you must provide labels: {"gatekeeper"}'
      name: default
    - enforcementAction: deny
      kind: Namespace
      message: 'you must provide labels: {"gatekeeper"}'
      name: gatekeeper-system
    - enforcementAction: deny
      kind: Namespace
      message: 'you must provide labels: {"gatekeeper"}'
      name: gitlab
    - enforcementAction: deny
      kind: Namespace
      message: 'you must provide labels: {"gatekeeper"}'
      name: kube-node-lease
    - enforcementAction: deny
      kind: Namespace
      message: 'you must provide labels: {"gatekeeper"}'
      name: kube-public
    - enforcementAction: deny
      kind: Namespace
      message: 'you must provide labels: {"gatekeeper"}'
      name: kube-system
    - enforcementAction: deny
      kind: Namespace
      message: 'you must provide labels: {"gatekeeper"}'
      name: logging
kind: List
metadata:
  resourceVersion: ""
  selfLink: ""

```

The above shows us the audit results on all the existing namespaces. 

# Rego playground and gatekeeper policies

To test a gatekeeper policy on the [Rego playground](https://play.openpolicyagent.org/), copy the entire rego
policy in the `rego` object above. Now, for the input, we need to have an object like this:

```
{
  "kind": "AdmissionReview",
  "parameters": {
    "cpu": "300m",
    "memory": "2Gi"
  },
  "review": {
    "kind": {
      "kind": "Pod",
      "version": "v1"
    },
    "object": {
      "spec": {
        "containers": [
          {
            "image": "quay.io/calico/nginx",
            "name": "nginx-frontend",
            "resources": {
              "limits": {
                "cpu": "290m"
                
              }
            }
          },
          {
            "image": "602401143452.dkr.ecr.us-west-2.amazonaws.com/amazon-k8s-cni",
            "name": "mysql-backend",
            "resources": {
              "limits": {
                "cpu": "400m",
                "memory": "1Gi"
              }
            }
          }
        ]
      }
    }
  }
}



```

The above object is available to your rego code as `input` object.

# Gatekeeper constraint library

The gatekeeper [library](https://github.com/open-policy-agent/gatekeeper/tree/master/library/general) contains
a few examples of constraint templates and constraints to enforce in your cluster.

# Pod security policies

In a [previous post](https://echorand.me/posts/kubernetes-pod-security-policies/), I discussed
using pod security policies to enforce compliance and restrictions in a cluster. We can do the same
making use of Gatekeeper constraints. The repository has a few examples [here](https://echorand.me/posts/kubernetes-pod-security-policies/).

# Dry run mode

For any constraint, we can add the `enforcementAction: dryrun` to the spec to enforce it in a audit mode for
existing and new resources. This will not disallow non-conformant resoures. This can be especially useful when 
rolling out constraints to an environment with existing workloads.

Example constraint spec:

```
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sValidNamespace
metadata:
  name: namespace-must-be-valid
spec:
  enforcementAction: dryrun
  ..

```

For constraints created with the enforcement action as `dryrun`, we can then find out the audit results in
the output of `kubectel get`, like so:

```
kubectl describe k8svalidnamespace.constraints.gatekeeper.sh namespace-must-be-valid
Name:         namespace-must-be-valid
Namespace:    
Labels:       <none>
Annotations:  kubectl.kubernetes.io/last-applied-configuration:
                {"apiVersion":"constraints.gatekeeper.sh/v1beta1","kind":"K8sValidNamespace","metadata":{"annotations":{},"name":"namespace-must-be-valid"...
API Version:  constraints.gatekeeper.sh/v1beta1
Kind:         K8sValidNamespace
Metadata:
  Creation Timestamp:  2020-06-03T01:49:24Z
  Generation:          1
  Resource Version:    3421798
  Self Link:           /apis/constraints.gatekeeper.sh/v1beta1/k8svalidnamespace/namespace-must-be-valid
  UID:                 d9c171b2-9451-4a45-98c7-24a2d4e8a3e4
Spec:
  Enforcement Action:  dryrun
  Match:
    Kinds:
      API Groups:
        
      Kinds:
        ConfigMap
        CronJob
        DaemonSet
        Deployment
        Job
        NetworkPolicy
        PodDisruptionBudget
        Role
        RoleBinding
        StatefulSet
        Service
        Secret
        ServiceAccount
      API Groups:
        extensions
        networking.k8s.io
      Kinds:
        Ingress
Status:
  Audit Timestamp:  2020-06-03T04:05:45Z
  By Pod:
    Enforced:             true
    Id:                   gatekeeper-controller-manager-ff7c87585-h7cjh
    Observed Generation:  1
  Total Violations:       3
  Violations:
    Enforcement Action:  dryrun
    Kind:                Secret
    Message:             Namespace should not be default: default
    Name:                default-token-9xvts
    Namespace:           default
    Enforcement Action:  dryrun
    Kind:                ServiceAccount
    Message:             Namespace should not be default: default
    Name:                default
    Namespace:           default
    Enforcement Action:  dryrun
    Kind:                Service
    Message:             Namespace should not be default: default
    Name:                kubernetes
    Namespace:           default
Events:                  <none>
```

The `Violations` section above results all the violations of the constraint that were found.

# Monitoring and Alerting

Gatekeeper exports several prometheus metrics covering various aspects of the behavior. If you have an existing
prometheus setup in your cluster, all you need to do is add the following annotations to Gatekeeper's `controller-manager`
deployment:

```
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gatekeeper-controller-manager
  namespace: gatekeeper-system
spec:
  ..
  template:
    metadata:
      annotations:
        prometheus.io/port: "8888"
        prometheus.io/scrape: "true"
        ..
```

Some of the key counter metrics to monitor are:

- gatekeeper_constraints: Total number of constraints
- gatekeeper_constraint_templates: Total number of constraint templates
- gatekeeper_violations: Total number of constraint violations
- request_count: Total number of requests to gatekeeper

The `enforcement_action` label is available for the `gatekeeper_constraints` and `gatekeeper_violations`  constraints
and can have a value of `dryrun`, `active` and `error`.

The `status` label is available for the `gatekeeper_constraint_templates` metric and can take the value of `active`
and `error`.

The `request_count` metric has a label, `admission_status` which is useful for understanding the distribution of
`allow` and `deny` requests.

Metrics related to the sync/replicating data are available in the v3.1.0-beta.9 release.

All the available metrics are documented [here](https://github.com/open-policy-agent/gatekeeper/blob/master/docs/Metrics.md).

Some useful prometheus alerts can be:

- Alert when we have a spike of active constraints violated
- Alert when the last audit run was X minutes back

# Learn more

- [Open Policy Agent documentation](https://www.openpolicyagent.org/docs/latest/)
- [OPA constraint framework](https://github.com/open-policy-agent/frameworks/tree/master/constraint#opa-constraint-framework)
- [Introductory article on OPA and Gatekeeper](https://www.stackrox.com/post/2020/05/custom-kubernetes-controls-with-open-policy-agent-opa-part-2/)
