---
title:   Kubernetes manifest management
date: 2019-12-20
categories:
-  infrastructure
---


# Introduction

There are two broad discussion points in this post:

1. Creating a new  Kubernetes service/job/deployment unit should involve minimal inputs from the user
2. Static guarantees/best practices enforcements around Kubernetes YAML files before they are applied to a cluster


## Prior art and background

Please read [this article](https://blog.cedriccharly.com/post/20191109-the-configuration-complexity-curse/) to
get a more holistic view of this space. What follows is my summary of what I think is the state at this stage
and how it fits in with my two goals above.

The idea of managing top-level kubernetes YAML manifests via non-YAML solutions is not very new.
For a few years now, the community has been coming up with various alternatives. The
two top reasons as far as my interepretations are concerned are:

- Prevent "YAML duplication" across similar functional resources and allow a hierarchy of YAML files
- Data validation

The solutions to the the first issue above has been solved via mechanisms such as "helm templates"
and "kustomize". Perhaps, one can combine both these to completely solve the YAML duplication problem
as well as implement a hierarchy of YAML files. The data validation problem can be solved via a relatively 
new "data configuration language", called [cue](https://cuelang.org). In fact, `cue` aims to help solve 
the YAML duplication issue as well as it supports "templates". And it seems like, using packages may be a way
to solve the hierarchy problem as well. Essentially, as far as I understand, these three tools all work on the 
principle that the final "output" will be a YAML file which is ready to be deployed to a Kubernetes cluster.
The article I link to above has links to other non-YAML alternatives such as [isopod](https://github.com/cruise-automation/isopod)
and [dhall-kubernetes](https://github.com/dhall-lang/dhall-kubernetes).

Coming back to the requirements I stated in the beginning of the document, there is a good chance we 
can meet the requirement (1) with either "helm template" + kustomize or "cue" itself. The requirement
(2) stated above can be satisfied with tools like:

- [kubeval](https://github.com/instrumenta/kubeval)
- [clusterlint](https://github.com/digitalocean/clusterlint) (More for cluster wide usage)
- [kubeaudit](https://github.com/Shopify/kubeaudit)
- [kubesec](https://github.com/controlplaneio/kubesec)

## Limitations of prior art

All the solutions discussued in the previous section still need that initial "seed" configuration to be
specified for a service manually in some form - a helm chart, a kustomize base YAML or a cue specification.
That is, a human operator is needed to copy/paste or write a new YAML/Cue file from scratch for each service 
and then have the overrides in each environment to establish the hierarchical setup. In addition, it will involve
using one or more external tools. "helm" specifically adds too much complexity for us (IMO), even though
the latest release has removed the need for the server-side tiller component. "kustomize" is a simple tool,
but it doesn't help with the initial seed template generation. Writing various plugins as a way
to customize its behavior is possible, but does involve substantial effort. "cue" is a promising tool, but it has a steep
learning curve for little gain as far as I can see.

Of course, in addition we will need to solve the problem (2) with more than one third party tool.

## Proposed solution

The solution will solve the initial hand generation of configuration by making it a tool's responsibility. It will take
the minimal set of command line arguments, pass it through various validation, policy enforcements and if all that
succeeds, will spit out the YAML configuration ready to be deployed. This solution will also be used to enforce and
continuously scan for any policy violations by existing manifests. So, any policy updates will be enforced.

As a starting point, the tool supports the concept of a "service" as the only top-level
generate-able object. A service may have:

- A worker deployable
- A DB migration job
- A cron job

At this stage, it only supports the following:

- Only one container per pod
- Only supports persistent volumes and secret volumes
- No IAM role support
- Doesn't allow resource limit setting


As of now, the CLI interface looks as follows:

```
Error: accepts 1 arg(s), received 0
Usage:
  mycli service generate-k8s [flags]

Flags:
      --container-image string       Container image to run in the pod (only AWS ECR registries allowed)
      --cron-schedule string         Cron job schedule
      --db-migrate                   Generate database migration job
      --db-migrate-truncate          Truncate DB before migration
      --deploy-environment string    Deployment Environment (dev/qa/staging/production)
      --environ stringArray          Environment variables and values (key=value)
  -h, --help                         help for generate-k8s
      --host string                  FQDN for external web services
      --node-group string            Node group name
      --port int                     Container service port
      --project string               Project name for the service
      --pvc-claims stringArray       Persistent volume claims (name=/path/to/mount;5Gi)
      --replicas int                 Number of replicas
      --role string                  Role of the service (web/worker)
      --secret-environ stringArray   Secret environment variables and values (key=secret/key)
      --secret-volumes stringArray   Secret volume mounts (name=/path/to/mount;secret)
      --type string                  Type of the service (external/internal)
      --worker-replicas int          Number of worker replicas

Global Flags:
      --log int   Set log level (default 3)

accepts 1 arg(s), received 0

```

Todo:

- CI user

Out of scope at this stage:

- Cluster admin will be the exclusive manifest applier
- Node groups will be created externally
- Secrets (TLS certs) will be created externally

### Examples

**Correct user input**

The following command will generate YAML files to deploy a container image:

```
$ mycli service generate-k8s hello-world  \
  --container-image=amitsaha/webapp-demo:golang-tls \
  --environ LISTEN_ADDRESS=":8443"  \
  --deploy-environment=qa  \
  --type internal \
  --port 8443  \
  --role=web \
  --project demo \ 
  --replicas 1 \
  --node-group demo 
```

This will generate an YAML manifest similar to [this](./example_generated.yaml). Key features of the generated configuration are:

- Create a namespace per service and deployment environment
- Enforce non-root user for container init process (UID: 1000, GID: 1000)
- Disallow privilege escalation
- Disallow privileged containers
- Enforce resource limits
- Add automatic readiness and liveness probes
- Add Network policy automatically
- Create a service account for the deployment and use that for the deployment

**Bad user input - invalid service name**

```
$ mycli service generate-k8s hello_world  --container-image=amitsaha/webapp-demo:golang-tls --environ LISTEN_ADDRESS=":8443"  --deploy-environment=qa  --type in
ternal --port 8443  --role=web --project demo  --replicas 1 --node-group demo   

&validator.fieldError{v:(*validator.Validate)(0xc0000de420), tag:"Host", actualTag:"Host", ns:"ServiceData.ServiceHost", structNs:"ServiceData.Host", fieldLen:0xb, structfie
ldLen:0x4, value:"", param:"", kind:0x18, typ:(*reflect.rtype)(0x18fce60)}

2019/12/10 15:56:18 Validations failed

```

**Bad user input - 1 replica for stateless applications**

TODO


To summarize, the following resources are created:

- Namespace
- Service
- Deployment
- NetworkPolicy
- ServiceAccount
- Ingress object

## Brain dump

In the last three years while writing puppet classes/modules, chef recipes, terraform configuration
and most recently Kubernetes YAML files, i have felt that I am writing the same stuff over and over
again. Generating these configurations have often been at the back of my mind. I was losing quite a
bit of sleep (literally!) over this again with Kubernetes manifests. I sent a Twitter DM to Kelsey
Hightower briefly explaining to him what I am trying to do here. One of his sentences was "Configuration
is complicated" (paraphrased slightly) which was the moment for me when I realized that this is not
the first time I have been trying to think about generating configuration rather than copy/pasting them
and hand-editing them. He also mentioned that he likes the idea of "pipelines". Something could be
generating the configuration and something else could be validating it and may be sending pull requests
to fix the issues.
