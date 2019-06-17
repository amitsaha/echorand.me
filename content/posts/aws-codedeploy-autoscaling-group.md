---
title:  AWS CodeDeploy Deployment Group and Initial Auto Scaling lifecycle hook
date: 2018-12-19
categories:
-  infrastructure
aliases:
- /aws-codedeploy-deployment-group-and-initial-auto-scaling-lifecycle-hook.html
---

When we create an AWS Code Deploy [deployment group](https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-groups.html) via
[Terraform](https://www.terraform.io/) or [CloudFormation](https://aws.amazon.com/cloudformation/) and integrate with an Auto Scaling Group, 
it also by default creates an initial lifecycle hook which ensuresthat a new code deployment gets triggered when a scale-out event occurs. 

It is all very "magical" and it is one of those cases where you have [troublesome](https://github.com/terraform-providers/terraform-provider-aws/issues/2993) behavior especially
when you are managing your infrastructure as code. The troublesome behavior happens as a result of the lifecycle hook creation being
a side-effect of creating a deployment group rather than an explicit operation that the user performs. 

Let's consider this example terraform snippet:

```
resource "aws_codedeploy_app" "code_deploy_app" {
  compute_platform = "Server"
  name             = "${var.service_name}"
}

resource "aws_codedeploy_deployment_group" "deploy_group" {  
  app_name              = "${aws_codedeploy_app.code_deploy_app.name}"
  deployment_group_name = "${var.service_name}-DeploymentGroup${var.environment}"
  service_role_arn      = ".."
  autoscaling_groups = ["${aws_autoscaling_group.autoscaling_group.name}"]
}

resource "aws_launch_configuration" "launch_configuration" {

  lifecycle {
    create_before_destroy = true
  }
  ..
}


resource "aws_autoscaling_group" "autoscaling_group" {

  name_prefix = "${var.service_name}-AutoscalingGroup"
  launch_configuration = "${aws_launch_configuration.launch_configuration.name}"
  ..  
}
```

When we apply the above change to our AWS infrastructure it will:

- Create a code deploy application
- Create a deployment group for this application
- Create an autoscaling group
- Associate the deployment group with the autoscaling group

The above infrastructure changes are all explicit and they map to what we have in code. Let's use the AWS CLI to describe
the deployment group we created above:

```
$ aws deploy get-deployment-group --application-name MyService --deployment-group-name MyService-DeploymentGroup
{
    "deploymentGroupInfo": {
        "applicationName": "MyService",
        "deploymentGroupId": "b7a6653a-407d-47d8-b9ff-3e0a10b028b3",
        "deploymentGroupName": "MyServiceDeploymentGroup",
        "deploymentConfigName": "CodeDeployDefault.OneAtATime",
        "ec2TagFilters": [],
        "onPremisesInstanceTagFilters": [],
        "autoScalingGroups": [
            {
                "name": "MyServiceAutoscalingGroup",
                "hook": "CodeDeploy-managed-automatic-launch-deployment-hook-myservice-a2d358c8-3525-452c-b76e-978f1746ae74"
            }
        ],
   ...
   }
```

We see that our deployment group has been created, has been associated with the autoscaling group, and we have a hook associated with it which was implicitly created for us. 

Next, let's see what this hook does using the AWS CLI:

```
$ aws autoscaling describe-lifecycle-hooks \
    --auto-scaling-group-name "MyServiceAutoscalingGroup" \
    --lifecycle-hook-names "CodeDeploy-managed-automatic-launch-deployment-hook-myservice-a2d358c8-3525-452c-b76e-978f1746ae74"
{
    "LifecycleHooks": [
        {
            "LifecycleHookName": ""CodeDeploy-managed-automatic-launch-deployment-hook-myservice-a2d358c8-3525-452c-b76e-978f1746ae74",
            "AutoScalingGroupName": MyServiceAutoscalingGroup",
            "LifecycleTransition": "autoscaling:EC2_INSTANCE_LAUNCHING",
            "NotificationTargetARN": "arn:aws:sqs:ap-southeast-2:062506839004:razorbill-ap-southeast-2-prod-default-autoscaling-lifecycle-hook",
            "NotificationMetadata": "b7a6653a-407d-47d8-b9ff-3e0a10b028b3",
            "HeartbeatTimeout": 600,
            "GlobalTimeout": 60000,
            "DefaultResult": "ABANDON"
        }
    ]
}
```

The above tells us the following about the lifecycle hook:

- It is set to fire when a EC2 instance is launched
- The action is going to be that it is going to publish a message to some "razorbill" SQS queue specified via `NotificationTargetARN`
- The most important bit here though is the `NotificationMetadata` which has the Code Deployment Group's `deploymentGroupId`

So, I imagine this is how it all works:

1. EC2 instance launches
2. A message is published to the SQS razorbill queue - which is AWS managed
3. The consumer sees the message and the metadata and creates a deployment in the corresponding deploment group
