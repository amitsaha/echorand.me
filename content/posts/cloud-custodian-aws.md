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

Now, let's run `custodian` from the same directory as the above policy file:

```
$ custodian run s3.yaml --output-dir=. 
2020-04-28 15:26:39,312: custodian.policy:INFO policy:s3-tag-policy resource:aws.s3 region:eu-central-1 count:13 time:27.72
```

The above command has invoked cloud custodian with the above policy definition and created a few files with
presumably the result of the query in a new sub-directory `s3-tag-policy` in 
the current directory specified via `--output-dir`. 

We will next use the `report` sub-command to summarize the results for us:

```
$ custodian report s3.yaml --output-dir=. --format grid
+-----------------------------------------+---------------------------+
| Name                                    | CreationDate              |
+=========================================+===========================+
| bucket 1                                | 2020-03-18T05:44:33+00:00 |
+-----------------------------------------+---------------------------+
| bucket 2                                | 2020-03-18T05:44:33+00:00 |
..

```


### EC2

Let's now write a policy for checking the tagging across EC2 resources. Create a new file `ec2.yaml` and
save it in the same directory as the above:

```
policies:
  - name: ec2-tag-policy
    resource: aws.ec2
    filters:
      - or:
        - "tag:Project": absent
        - "tag:Environment": absent
        - "tag:Provisioner": absent
```


### RDS

Next, let write a policy for checking the tagging across RDS resources. Create a new file `rds.yaml` and
save it in the same directory as the above:


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

### Running with all the policies

Let's now run cloud custodian with all the above policies and across multiple AWS regions:

```
$ custodian run --output-dir=. ec2.yaml s3.yaml rds.yaml -r ap-southeast-2 -r eu-central-1 -r eu-west-1

2020-04-29 09:40:25,067: custodian.policy:INFO policy:ec2-tag-policy resource:aws.ec2 region:ap-southeast-2 count:3 time:0.35
2020-04-29 09:40:43,447: custodian.policy:INFO policy:s3-tag-policy resource:aws.s3 region:ap-southeast-2 count:13 time:18.38
2020-04-29 09:40:43,615: custodian.policy:INFO policy:rds-tag-policy resource:aws.rds region:ap-southeast-2 count:0 time:0.16
2020-04-29 09:40:46,425: custodian.policy:INFO policy:ec2-tag-policy resource:aws.ec2 region:eu-central-1 count:7 time:2.79
2020-04-29 09:41:14,221: custodian.policy:INFO policy:s3-tag-policy resource:aws.s3 region:eu-central-1 count:13 time:27.79
2020-04-29 09:41:17,455: custodian.policy:INFO policy:rds-tag-policy resource:aws.rds region:eu-central-1 count:0 time:3.23
2020-04-29 09:41:18,893: custodian.policy:INFO policy:ec2-tag-policy resource:aws.ec2 region:eu-west-1 count:0 time:1.42
2020-04-29 09:41:46,373: custodian.policy:INFO policy:s3-tag-policy resource:aws.s3 region:eu-west-1 count:13 time:27.48
2020-04-29 09:41:49,368: custodian.policy:INFO policy:rds-tag-policy resource:aws.rds region:eu-west-1 count:0 time:2.99

```

Now, let's run the `report` sub-command. We can only pass policy files of the same resource type to `report`.
Hence, we will invoke it separately for each resource type which also corresponds to the separate policy files
in our case:

For EC2:

```
$ custodian report --output-dir=. ec2.yaml -r ap-southeast-2 -r eu-central-1 -r eu-west-1 --format grid
+----------------------------+---------------------+--------------------------------------------+----------------+---------------------------+--------------+--------------------+----------------+
| CustodianDate              | InstanceId          | tag:Name                                   | InstanceType   | LaunchTime                | VpcId        | PrivateIpAddress   | Region         |
+============================+=====================+============================================+================+===========================+==============+====================+================+
| 2020-04-29 09:40:46.423450 | i-0912121           | Instance Name                              | c4.large       | 2018-10-29T00:30:38+00:00 | vpc-0c6d8b65 | 172.31.14.88       | eu-central-1   |
```

For S3:

```
$ custodian report --output-dir=. s3.yaml -r ap-southeast-2 -r eu-central-1 -r eu-west-1 --format grid
+-----------------------------------------+---------------------------+-----------+
| Name                                    | CreationDate              | Region    |
+=========================================+===========================+===========+
| cg-foo-bar                    | 2020-03-04T05:57:34+00:00 | eu-west-1 |
+-----------------------------------------+---------------------------+-----------+

```


For RDS:

```
$ custodian report --output-dir=. rds.yaml -r ap-southeast-2 -r eu-central-1 -r eu-west-1 --format grid
+------------------------+----------+----------+-----------------+-----------+--------------------+--------------------+----------------------+----------------------+----------+
| DBInstanceIdentifier   | DBName   | Engine   | EngineVersion   | MultiAZ   | AllocatedStorage   | StorageEncrypted   | PubliclyAccessible   | InstanceCreateTime   | Region   |
+========================+==========+==========+=================+===========+====================+====================+======================+======================+==========+
+------------------------+----------+----------+-----------------+-----------+--------------------+--------------------+----------------------+----------------------+----------+
```



