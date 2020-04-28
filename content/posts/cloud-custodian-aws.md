---
title: Using cloud custodian to ensure compliance across AWS resources
date: 2020-04-28
categories:
-  infrastructure
---

# Introduction

In this post, I will describe my experiments with using [Cloud Custodian](https://cloudcustodian.io/docs/index.html) to perform
various tasks usually falling into the bucket of compliance and sometimes convention. Some of the areas I will cover are
resource tagging and unused resources across multiple AWS accounts.

## Installation and setup

Cloud Custodian is a Python 3 application, so you will need that [installed](https://cloudcustodian.io/docs/quickstart/index.html#install-cloud-custodian).
A docker image is also available to be used. In this post, I will assume a host installation with the CLI
command `custodian` used to invoke the application.

We will also need to ensure that we have the AWS CLI configuration setup correctly. I am using the `AWS_PROFILE`
environment variable to point to the configuration I want to use with `custodian`.

## Ensuring certain tags exist

Let's say that we want to find out all the S3 buckets which do not have certain tags defined. Cloud custodian
requires us to specify this requirement as a policy YAML file which looks like as follows:

### S3

Create a new file called, `s3.yaml` and paste in the following contents:

```
policies:
  - name: s3-tag-policy
    resource: aws.s3
    filters:
      - or:
        - "tag:Project": absent
        - "tag:Environment": absent
        - "tag:Provisioner": absent
```



### EC2

```
policies:
  - name: ec2-tag-policy
    resource: aws.rds
    filters:
      - or:
        - "tag:Project": absent
        - "tag:Environment": absent
        - "tag:Provisioner": absent
```


### RDS

```
policies:
  - name: rds-tag-policy
    resource: aws.rds
    filters:
      - or:
        - "tag:Project": absent
        - "tag:Environment": absent
        - "tag:Provisioner": absent
```




