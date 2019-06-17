---
title:  Importing existing AWS Network ACL into Terraform
date: 2018-10-15
categories:
-  infrastructure
aliases:
- /importing-existing-aws-network-acl-into-terraform.html
draft: true
---

Recently, I worked on importing some AWS resources into Terraform. After importing a few
VPC resources - vpc, subnets, routes, routing tables, came the turn of [Network ACLs](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html). 

While configuring network ACL rules, we basically have two choices with Terraform 
(similar to security group and security group rules):

1. We can define the entries/rules inline in the `aws_network_acl` resource
2. We can define the entries/rules as separate `aws_network_acl_rule` resources

My first thought was I wanted to define separate `aws_network_acl_rule` resources. However,
I then learned that whereas Network ACLs could be imported, Network ACL entries
are not yet [supported](https://github.com/terraform-providers/terraform-provider-aws/issues/704#issuecomment-433181340).
Hence, I decided that I will define the network acl entries/rules inline so that importing the network acl would
also import the ACl entries/rules. This would mean that future ACL rules would need to be updated inline as well,
but that's ok as long as we don't mix and match between the two approaches.

However, the network ACLs I was trying to import had a fair number of ACL entries/rules in them and writing them by hand
would be a mind numbing exercise. The reasoning would have applied even if I were to write them as 
separate `aws_network_acl_rule` resources. So, I decided to generate the Terraform code using my hobby AWS CLI
tool - [yawsi](https://github.com/amitsaha/yawsi). `yawsi` already had some code for querying network ACLs for the
`inspect connectivity` command, so it was very straightforward to enumerate the network ACL rules, given a Network ACL
ID and generate Terrafrom code for it.


subnet association import

