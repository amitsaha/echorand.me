---
title:  Managing AWS lambda functions from start to finish with Terraform
date: 2018-08-02
categories:
-  infrastructure
aliases:
- /managing-aws-lambda-functions-from-start-to-finish-with-terraform.html
---

[AWS lambda](https://aws.amazon.com/lambda/) functions look deceptively simple. The devil is in the details though. Once you
have written the code and have created a `.zip` file, there's a few more steps to go.

For starters, we need an IAM profile to be defined with appropriate policies allowing the function to access the AWS resources. 
To setup the lambda function to be invoked automatically in reaction to another event, we need some more permissions and 
references to these resources. Then, we  have to create a lambda function in AWS infrastructure and point it to 
our `.zip` file that we have created above. Everytime, we update this, `.zip`, we have to ask AWS lambda to update the 
code again. A lot of steps, all ripe for automation.

# Automation using AWS CLI/Serverless frameworks - Creating Lambda infrastructure islands

One straight forward, no fuss approach is to use the [AWS CLI](https://docs.aws.amazon.com/cli/latest/reference/lambda/index.html).
The main problem I think with this approach and using any of the serverless
tools and frameworks out there like `apex`, `serverless` or `zappa` is that they treat the infrastructure of 
your lambda functions as islands, rather than being part of your broader AWS infrastructure. The same S3 bucket's contents 
which you want your lambda function to be triggered in reaction to changes in may be the bucket some other non-lambda
application writes to. You want to run your lambda function in the same VPC as your database RDS instance. Needless to say,
there will cross-application infrastructure references. 

What follows is a non-production tested suggestion for managing your lambda functions and their infrastructure as part of
your global infrastructure as code repository.

# Managing lambda functions using Terraform

Consider a lambda function [ec2_state_change](https://github.com/amitsaha/cloudwatch-event-lambda/tree/master/functions/ec2_state_change).
I wrote this for a recent [article](https://blog.codeship.com/cloudwatch-event-notifications-using-aws-lambda/). The `src` directory
has the source of the lambda function which is written in Python. To create the lambda function (for the first time) and to
deploy new versions of the code, the following BASH script (there is a PowerShell script too) is run:

```
!/usr/bin/env bash
set -ex

# Create a .zip of src
pushd src
zip -r ../src.zip *
popd

aws s3 cp src.zip s3://aws-health-notif-demo-lambda-artifacts/ec2-state-change/src.zip
version=$(aws s3api head-object --bucket aws-health-notif-demo-lambda-artifacts --key ec2-state-change/src.zip)
version=$(echo $version | python -c 'import json,sys; obj=json.load(sys.stdin); print(obj["VersionId"])')

# Deploy to demo environment
pushd ../../terraform/environments/demo
terraform init
terraform apply \
    -var aws_region=ap-southeast-2 \
    -var ec2_state_change_handler_version=$version \
    -target=module.ec2_state_change_handler.module.ec2_state_change_handler.aws_lambda_function.lambda \
    -target=module.ec2_state_change_handler.module.ec2_state_change_handler.aws_cloudwatch_event_rule.rule \
    -target=module.ec2_state_change_handler.module.ec2_state_change_handler.aws_cloudwatch_event_target.target \
    -target=module.ec2_state_change_handler.module.ec2_state_change_handler.aws_iam_role_policy.lambda_cloudwatch_logging \
    -target=module.ec2_state_change_handler.module.ec2_state_change_handler.aws_lambda_permission.cloudwatch_lambda_execution
popd

```

The above script does the following main things:

- First, it creates a ZIP of the `src` sub-directory
- It uploads it to a designated bucket in S3
- It gets the version of the file it just uploaded
- It then changes the current working directory to one with `terraform` configuration in it
- Then runs `terraform apply` supplying specific targets related to the function it is uploading


The first time, this script is run, it will create all the infrastructure that is needed by the lambda function
to be run. On subsequent applications, only the lambda function's version will change. We can even separate the script
into two such that we can use different AWS credentials for first time creation and subsequent code updates.

We can run this script as part of a CI/CD pipeline. The repository pointed to above has the terraform configuration in it as well,
but we can always download the terrraform configuration tarball or git clone it during a CI run. The key idea here that I want 
to illustrate here is that your terraform configuration for the lambda function can and should co-exist with the rest of your infrastructure.


# Terraform source layout

While working on the article I mentioned above, I also worked for the first time with structuring my terraform code
with modules. Especially, how we can leverage modules to manage different environments for our infrastructure. The above
script relies on this behavior.

My requirement was to manage two lambda functions. They would both have their own infrastructure, but in terms of terraform
code, they would be more or less identical with the exception of the naming of the lambda functions, the AWS cloudwatch
event they would be invoked on, and the environmnet variables.

So, I created a root module, `cloudwatch_event_handlers` with a `main.tf` and defined a `variables.tf` file with all the configurable
module parameters. This is where my first confusion with terraform modules was cleared. Before this, I somehow couldn't wrap my
head around where my module definitions would go and and where would I be using it. In programming languages, you defined 
the sharable code in a library of some form which isn't intended to be executed directly. The program which uses the sharable
code is the one that has the executable code. I was expecting something similar with `terraform`. That is, the `resource`s would
be defined in my "real" code. In terraform, the `resource` statements belong to the "module", and you actually define `module`
in the code you plan to "execute".

Using the `cloudwatch_event_handlers` module, I define another module to implement the lambda function that would handle
EC2 state change events as follows:

```
variable "lambda_artifacts_bucket_name" {
    type = "string"
}

variable "ec2_state_change_handler_version" {
    type = "string"
}

module "ec2_state_change_handler" {

    source = "../cloudwatch_event_handlers"

    cloudwatch_event_rule_name = "ec2-state-change-event"
    cloudwatch_event_rule_description = "Notify when there is a state change in EC2 instances"
    cloudwatch_event_rule_pattern = <<PATTERN
{
  "source": [ "aws.ec2" ],
  "detail-type": [ "EC2 Instance State-change Notification" ]
}
PATTERN
     lambda_iam_role_name = "ec2_state_change_lambda_iam"
     lambda_function_name = "ec2_state_change"
     lambda_handler = "main.handler"
     lambda_runtime = "python3.6"
     
     lambda_artifacts_bucket_name = "${var.lambda_artifacts_bucket_name}"
     lambda_artifacts_bucket_key = "ec2-state-change/src.zip"
     lambda_version = "${var.ec2_state_change_handler_version}"
}

```


Similarly, the `health_event_handler` module is defined as:

```
variable "lambda_artifacts_bucket_name" {
    type = "string"
}

variable "health_event_handler_version" {
    type = "string"
}

variable "health_event_handler_environment" {
  type = "map"
}


module "health_event_handler" {

    source = "../cloudwatch_event_handlers"

    cloudwatch_event_rule_name = "health-event"
    cloudwatch_event_rule_description = "Invoke a lambda function when there is a scheduled health event"
    cloudwatch_event_rule_pattern = <<PATTERN
{
  "source": [ "aws.health" ],
  "detail-type": [ "AWS Health Event" ]
}
PATTERN

    lambda_iam_role_name = "health_event_lambda"
    lambda_function_name = "health_event"
    lambda_handler = "main.handler"
    lambda_runtime = "python3.6"

    lambda_artifacts_bucket_name = "${var.lambda_artifacts_bucket_name}"
    lambda_artifacts_bucket_key = "health-event/src.zip"
    lambda_version = "${var.health_event_handler_version}"

    lambda_environment = "${var.health_event_handler_environment}"
}
```

Note how the implementations code here says it's `module`! Anyway, another thing I learned here is that the inputs to a module
are it's variables. Thats' it. I found it hard to wrap my head around it, but I think i have got it now.

Okay, now that we defined our "source" configuration, we next define `environments` for our infrastructure.

Currently, the repository [here](https://github.com/amitsaha/cloudwatch-event-lambda/) has a `demo` environment defined under
the `environments` sub-directory. The idea is to have one sub-directory per environment. Inside this `demo` environment,
we have the bootstrap configuration where we create the bucket and dynamodb table for storing our terraform state remotely.
We then define the `backend` created in `backend.tf`. With the setup done, we then bring in the modules we created above
in the `main.tf` file:

```
provider "aws" {
  region = "${var.aws_region}"
}

module "lambda_artifacts" {
  source = "../../modules/deployment_artifacts"
  artifacts_bucket_name = "${var.lambda_artifacts_bucket_name}"  
}

module "ec2_state_change_handler" {
  source = "../../modules/ec2_state_change_handler"
  lambda_artifacts_bucket_name = "${var.lambda_artifacts_bucket_name}"
  ec2_state_change_handler_version = "${var.ec2_state_change_handler_lambda_version}"
  
}

module "health_event_handler" {
  source = "../../modules/health_event_handler"
  lambda_artifacts_bucket_name = "${var.lambda_artifacts_bucket_name}"
  health_event_handler_version = "${var.aws_health_event_handler_lambda_version}"
  health_event_handler_environment = "${var.health_event_handler_lambda_environment}"
}
```

Once again, we have another set of child modules. Here we only specify the environment specific variables which we
then populate via `terraform.tfvars` and during application (in the scripts above).

Coming back to our script I shared at the beginning, here's the key terraform specific bits reproduced which should
make more sense now:

```
# Deploy to demo environment
pushd ../../terraform/environments/demo
terraform init
terraform apply \
    -var aws_region=ap-southeast-2 \
    -var ec2_state_change_handler_version=$version \
    -target=module.ec2_state_change_handler.module.ec2_state_change_handler.aws_lambda_function.lambda \
    -target=module.ec2_state_change_handler.module.ec2_state_change_handler.aws_cloudwatch_event_rule.rule \
    -target=module.ec2_state_change_handler.module.ec2_state_change_handler.aws_cloudwatch_event_target.target \
    -target=module.ec2_state_change_handler.module.ec2_state_change_handler.aws_iam_role_policy.lambda_cloudwatch_logging \
    -target=module.ec2_state_change_handler.module.ec2_state_change_handler.aws_lambda_permission.cloudwatch_lambda_execution
popd
```


# Replacing scripts

Of course scripting is hard, and you run into all kinds of issues and they break in all kinds of ways, but they
are a fact of life when it comes to infrastructure considering how quick they are to put together. 
I would want to replace the above scripts by a small tool written in a proper programming language. The difference
from the current tools out there would be that it would work with existing terraform code. 

May be [apex](https://github.com/apex/apex) someday? It uses `terraform` to manage your infrastructure, so may
we could make it reuse your existing infrastructure as code.

# Summary

I plan to trial this setup out for managing lambda functions as I get a chance, what do you think? Is this something that could work
better than managing lambda functions infrastructure as islands?
