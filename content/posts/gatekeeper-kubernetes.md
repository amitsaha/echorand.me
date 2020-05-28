---
title: Using Gatekeeper in Kubernetes
date: 2020-05-28
categories:
-  infrastructure
---

## Introduction


## Our first policy from scratch

One of the difficulties I have had is writing a policy from scratch. Let's look at a policy which will fail
if the `namespace` of an object is `default`:

```
package k8svalidnamespace
        
violation[{"msg": msg, "details": {}}] {
  value := input.review.object.metadata.namespace
  value == "default"
  msg := sprintf("Namespace should not be default: %v", [value])
}
```

The first line of this policy defines a namespace for the policy. Each policy must reside in a package. 

Next, we define a `violation` *block* which "returns" two objects, "msg" and "details" to the calling framework.
If you are coming to gatekepper from OPA documentation, you will notice that OPA has `deny` block, whereas
`gatekeeper` has `violation` blocks. I am not sure why, but this was changed in 
[gatekeeper](https://github.com/open-policy-agent/gatekeeper/issues/168) a while back. This is the "entrypoint" for
a rule as per the [OPA constraint framework guide](https://github.com/open-policy-agent/frameworks/tree/master/constraint#opa-constraint-framework).

The statements inside this block i.e. inside the `{}` are [Rego](https://www.openpolicyagent.org/docs/latest/policy-language/#the-basics) expressions.

The expression `value := input.review.object.metadata.namespace` assigns the value of `input.review.object.metadata.namespace` to the variable `value`. The `input` object contains the entire JSON object that
Gatekeeper provides to the policy when evaluating it.

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
### Policy with two conditions in a rule

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

### OR rules

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

**Invalid input - Unspecified namespace**

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

**Invalid input - Empty namespace**

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


**Invalid input - default namespace**

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

**Valid Input**

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


## Setting up Gatekeeper

Install Gatekeeper as per instructions [here](https://github.com/open-policy-agent/gatekeeper#installation-instructions)

The following resources are created:

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


## Creating a constraint template

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


## Creating a constraint

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

## Testing the constraint

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

## Audit

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

## Rego playground and gatekeeper policies

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

The above object is available to your rego code as `input`.


## Learn more

- https://github.com/open-policy-agent/frameworks/tree/master/constraint#opa-constraint-framework
- https://www.stackrox.com/post/2020/05/custom-kubernetes-controls-with-open-policy-agent-opa-part-2/
