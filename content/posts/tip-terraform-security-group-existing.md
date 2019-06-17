---
title:  Tip Terraform and AWS Security Group rules in EC2 classic
date: 2018-01-05
categories:
-  infrastructure
aliases:
- /tip-terraform-and-aws-security-group-rules-in-ec2-classic.html
---

When using Terraform's `aws_security_group_rule` with EC2 classic, you may get an error
saying that the source security group doesn't exist, even though it does. That's probably
because you (like me and [others](https://github.com/hashicorp/terraform/issues/5532)) 
used the source security group ID and not the security group name, like so:

```
resource "aws_security_group_rule" "my_sg_rule" {
  type      = "ingress"
  from_port = 11123
  to_port   = 11123
  protocol  = "tcp"

  security_group_id        = "${aws_security_group.sg1.id}"
  source_security_group_id = "${aws_security_group.sg2.id}"
}
```

You should actually do this instead:

```
resource "aws_security_group_rule" "my_sg_rule" {
  type      = "ingress"
  from_port = 11123
  to_port   = 11123
  protocol  = "tcp"

  security_group_id        = "${aws_security_group.sg1.id}"
  source_security_group_id = "${aws_security_group.sg2.name}"
}
```
