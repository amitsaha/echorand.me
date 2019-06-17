---
title:  Setting up AWS EC2 Assume Role with Terraform
date: 2018-02-27
categories:
-  infrastructure
aliases:
- /setting-up-aws-ec2-assume-role-with-terraform.html
---

In this post, we will see how we can implement the AWS `assume role` functionality which allows
an IAM role to be able to obtain temporary credentials to access a resource otherwise only accessible
by another IAM role. We will implement the infrastructure changes using [Terraform](terraform.io)
and see how to obtain temporary credentials and access an AWS resource (a S3 bucket) that the corresponding
IAM role doesn't have access to otherwise via the [AWS CLI](https://aws.amazon.com/documentation/cli/).

If you want to follow along, please install `terraform` and setup AWS config so that it has a profile named
`dev`. If you have a profile or want to use a different AWS profile, you can change it in the `aws.tf` file
of the configuration you are applying. If you are like me, you may have trouble setting up the profile
correctly, so here's my two config files:

```
# ~/.aws/config

[profile dev]
region=ap-southeast-2

# ~/.aws/credentials

[dev]
aws_access_key_id=<Your access key>
aws_secret_access_key=<Your secret key>
```

In each of the configuration directory, you will have to run `terraform init` 
before you can run `terraform apply`. 

This functionality may be found useful in different problem scenarios. Next, I describe the scenario where
I first used it.

## Problem Scenario

Consider the following scenario for 3 services running on their own AWS EC2 instances in
a production setup:

```
                       ┌───────────────────────────┐
                       │   Production AWS Setup    │
                       └───────────────────────────┘




 .───────────────────.      .───────────────────.    .───────────────────.
(      S3Bucket1      )    (      S3Bucket2      )  (      S3Bucket3      )
 `───────────────────'      `───────────────────'    `───────────────────'
            ▲                         ▲                        ▲
      ┌ ─ ─ ┴ ─ ─ ┐             ┌ ─ ─ ┴ ─ ─ ┐            ┌ ─ ─ ┴ ─ ─ ┐
       IAM Role 1                IAM Role 2               IAM Role 3
      └ ─ ─ ┬ ─ ─ ┘             └ ─ ─ ┬ ─ ─ ┘            └ ─ ─ ┬ ─ ─ ┘
            │                         │                        │

     ┌────────────┐            ┌────────────┐            ┌────────────┐
     │ Service A  │            │ Service B  │            │ Service C  │
     └────────────┘            └────────────┘            └────────────┘

       ◀─ ─ ─ ─ ─ ─ ─ ─ ─    AWS EC2 Instances   ─ ─ ─ ─ ─ ─ ─ ─▶
```

Each service running on their own EC2 instance has their own AWS IAM profile which via 
their role and role policy gives them access to the corresponding S3 bucket.

Now, consider the setup below for a developer environment for the above services:

```

                       ┌───────────────────────────┐
                       │   Development AWS Setup   │
                       └───────────────────────────┘




 .───────────────────.      .───────────────────.    .───────────────────.
(      S3Bucket1      )    (      S3Bucket2      )  (      S3Bucket3      )
 `───────────────────'      `───────────────────'    `───────────────────'
              ▲                      ▲                       ▲
              │                      │                       │
      ┌ ─ ─ ─ ┴ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─
                            Access Denied                      │
      └ ─ ─ ─ ┬ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─
              │                 ┌ ─ ─ ─ ─ ─ ┐                │
              └────────────────   IAM Role   ────────────────┘
                                └ ─ ─ ─ ─ ─ ┘
                                     ▲
                                     │
                               ┌────────────┐
                               │ Service B  │
                               └────────────┘
                               ┌────────────┐
                               │ Service A  │
                               └────────────┘
                               ┌────────────┐
                               │ Service C  │
                               └────────────┘


                              AWS EC2 Instance

```

Instead of each service running on their own development EC2 instance, we run all the services
on a single EC2 instance. 

As I note in the diagram above, the individual services will get an access denied error since
the EC2 instance above is using a different IAM profile than the ones used when the services
are running in the production setup. 

## Setting up test infrastructure

Let's verify the problem for ourselves first by created a test infrastructure as follows:

- Create a S3 bucket (`github-amitsaha-bucket`)
- Create two IAM profiles, `role1` and `role2`
- Add a policy to `role2` to be able to perform all operations on the S3 bucket
- Spin up an EC2 instance using `role1`

To see how this is representative of our problem, note that `role2` has access to the S3 bucket, but `role1` doesn't.
The EC2 instance we will be running our experiment is setup to use `role1`, and hence we do not have access
to the S3 bucket.

The [terraform](https://terraform.io) configuration for setting up the above infrastructure can be found 
[here](https://github.com/amitsaha/aws-assume-role-demo/tree/master/terraform_configuration/problem_demo). 

```
$ cd terraform_configuration/problem_demo
$ terraform init
$ terraform apply
```

If we now try to access the S3 bucket from the EC2 instance via the AWS CLI, we will get:

```
$ ssh ec2-user@<Public-IP>
..

$ aws s3 ls s3://github-amitsaha-bucket/*
An error occurred (AccessDenied) when calling the ListObjects operation: Access Denied
```

There are two solutions to this problem:

- The first is to create an IAM profile which will have all the IAM policies of the constituent services
- The second is to use [AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)

The first solution, although simple has the main problem of duplicating your IAM policies and it doesn't
feel clean. The second approach, although requires some work is a much cleaner approach.

There are two stages to implement this solution. The first stage is to setup the infrastructure to allow the
assume role operation to succeed. If an IAM role, `role1` wants to assume another

Before we move on, we will run `terraform destroy` here so that the next step succeeds. We are using a local
`tfstate` file in each configuration directory for the demos which makes this step necessary.

## Solution: Infrastructure setup

If an IAM role, `role1` wants to assume another role, `role2`, then:

- `role1` should be allowed to perform the `sts:AssumeRole` action on `role2`
- `role2` should allow `role1` to assume itself

The corresponding IAM configuration earlier will be updated as follows:


```
data "aws_iam_policy_document" "assume_role2_policy" {
  statement {
    actions = [
      "sts:AssumeRole",
    ]
    resources = [
      "${aws_iam_role.role2.arn}",
    ]
  }
}

resource "aws_iam_role_policy" "role1_assume_role2" {
  name   = "AssumeRole2"
  role = "${aws_iam_role.role1.name}"
  policy = "${data.aws_iam_policy_document.assume_role2_policy.json}"
}

resource "aws_iam_role" "role2" {
  name = "test_profile2_role"
  path = "/"

  assume_role_policy = <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": "sts:AssumeRole",
            "Principal": {
               "Service": "ec2.amazonaws.com",
               "AWS": "${aws_iam_role.role1.arn}"
            },
            "Effect": "Allow",
            "Sid": ""
        }
    ]
}
EOF
}
```

The updated terraform configuration can be found [here](https://github.com/amitsaha/aws-assume-role-demo/tree/master/terraform_configuration/solution_demo).
Let's create the new infrastructure:

```
$ cd terraform_configuration/solution_demo
$ terraform init
$ terraform apply

```

Now, if we `ssh` into the instance and try the same operation, we will get the same error:

```
[ec2-user@ip-172-31-6-239 ~]$ aws s3 ls s3://github-amitsaha-bucket/*
An error occurred (AccessDenied) when calling the ListObjects operation: Access Denied
```

However, since the infrastructure is now setup to allow us to perform assume role, we can make use
of that.

## Solution: Perform AssumeRole operation

The AWS CLI is already installed in the EC2 instance we spun up, so let's see how we can perform `assume role` operation:

```
[ec2-user@ip-172-31-6-239 ~]$ aws sts assume-role --role-arn arn:aws:iam::033145145979:role/test_profile2_role --role-session-name s3-example
{
    "AssumedRoleUser": {
        "AssumedRoleId": "AROAJ3CMHLQFMYPPWQLSQ:s3-example", 
        "Arn": "arn:aws:sts::033145145979:assumed-role/test_profile2_role/s3-example"
    }, 
    "Credentials": {
        "SecretAccessKey": "PzFA0bJxxeB+i4kWjowpM6VTQTQfIiejbRxXkZdo", 
        "SessionToken": "FQoDYXdzEI7//////////wEaDDqRJAWz11tovnatwSLuAUf1CIjLW0OI5dTCAh610HW7f3fBxglofbntqxCSJVyei1DafEjriLIskDzKoCdz6Y7F5Z/uyv/Ue7dCCCvXFpVYExwt82hE7yTGrYJB/oQl+bkMIzPhlHyegDa3/+vxdFu2kbcve8a1VlNhZE8fnpaRLGMoEr9/Ll+NQLjtRyysQ7DuN0GuMVIDiUzqOZHVDFDt4/c5LBHd2VZNfZ2t/rfPTkIwfkI9JQUVON+lcrk5W+FH16Onp1vuZXX4cmraMWQ1ROGf2x4fHGPIcMqaw674sgOnMSllyCUONLIaSPOeJLfOSDIrM/Xfv0PvslgotNrK1AU=", 
        "Expiration": "2018-02-25T13:33:56Z", 
    "AccessKeyId": "ASIAI7JVCNUGFT6XGMAQ"
    }
}

```

The `--role-arn` option specifies the ARN of the IAM profile we want to assume, give it a name via the `--role-session-name` and we get back three key pieces
of data back in the `Credentials` object:

- SecretAccessKey
- SessionToken
- AccessKeyId

We then pass these as environment variables to the AWS CLI and try to perform the above operation on the S3 bucket:

```
$ AWS_SESSION_TOKEN="<session-token-above>" \
  AWS_ACCESS_KEY_ID=<key id above> \
  AWS_SECRET_ACCESS_KEY=<secret key above> aws s3 ls s3://github-amitsaha-bucket/
```

And it works!

We can create an object as well:

```
$ touch hello
$ AWS_SESSION_TOKEN="<session-token-above>" \
  AWS_ACCESS_KEY_ID=<key id above> \
  AWS_SECRET_ACCESS_KEY=<secret key above> aws s3 cp hello  s3://github-amitsaha-bucket/
upload: ./hello to s3://github-amitsaha-bucket/hello             
$ AWS_SESSION_TOKEN="<session-token-above>" \
  AWS_ACCESS_KEY_ID=<key id above> \
  AWS_SECRET_ACCESS_KEY=<secret key above> aws s3 ls s3://github-amitsaha-bucket/
2018-02-25 12:38:32         12 hello
```

## Discussions of the solution

When we discussed the necessary permissions for `role1` to be able to assume `role2`, we learned that:

- `role1` needed to have the permission to perform the `sts:AssumeRole` action on `role2`, and
- `role2` needed allow itself to be assumed by `role1`

We explicitly specified `role1`'s ARN in the assume role policy of `role2`. This is okay for our demo setup, but
it introduces perhaps an unnecessary dependency on `role1`. Since `role1` doesn't play any role in the production setup
of the service which is only reliant on `role2`, it may be a good idea to remove this explicit dependency. Hence, we may
be better off allowing *any* role in the current AWS account to assume `role2`. To implement this, we change the IAM configuration
as follows:

```
60c60
<                "AWS": "${aws_iam_role.role1.arn}"
---
>                "AWS": "arn:aws::iam::${data.aws_caller_identity.current.account_id}:root"
```

You can find the entire configuration in the 
[solution_demo_root_user](https://github.com/amitsaha/aws-assume-role-demo/tree/master/terraform_configuration/solution_demo_root_user).

## AssumeRole in your applications

Above we performed the assume role operation via the AWS CLI, but in your applications we will use the corresponding
language's SDK function to do so. We will also need to check the expiry of the access key and secret key pair before
we attempt to use it make an AWS API call with them.

## Alternatives to modifying your application

[metadataproxy](https://github.com/lyft/metadataproxy) aims to provide a solution to this problem such that you
don't have to modify your application code. This is great if you are using containers to deploy your application
and should work out of the box when you combine the infrastructure setup that this post aims to help you with.

[kube2iam](https://github.com/jtblin/kube2iam) again aims to provide a similar solution to `metadataproxy` for
Kubernetes.

## Conclusion

The problem is generic enough and whether you have to modify your application or not depends on your deployment
platform and choices. However, the infrastructure setup needed for these solutions are similar and hopefully my post
will help you with that.

## Resources

- [Terraform configuration repo](https://github.com/amitsaha/aws-assume-role-demo)
- [AWS Assume Role](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)
- [Terraform](https://www.terraform.io/)
