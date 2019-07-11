---
title:  Generate yourself some Terraform code from TOML
date: 2019-04-04
categories:
-  infrastructure
aliases:
- /generate-yourself-some-terraform-code-from-toml.html
---

In this post, we will see how we can use [Golang](https://golang.org/) to generate Terraform configuration from a TOML specification.
That is, given a TOML file, like:

```
subnet_name = "SubnetA"

rules = [
    {rule_no=101, egress = false, protocol = "tcp", rule_action = "allow", cidr_block = "127.0.0.1/32", from_port = 22, to_port = 30},   
]
```

We will  generate:

```
# This is a generated file, do not hand edit. See README at the
# root of the repository

resource "aws_network_acl_rule" "rule_SubnetA_ingress_101" {

    network_acl_id = "${lookup(local.network_acl_ids_map, "SubnetA")}"
    egress = false
    rule_number = 101
    rule_action = "allow"
    cidr_block = "127.0.0.1/32"
    protocol = "tcp"
    from_port = 22
    to_port = 30


}
```

We will specifically be using AWS Network ACL rules as an example, but the solution for the problem discussed is likely
extrpolable to other cloud resources.

# Background on `count`

Using count is a [popular approach](https://www.terraform.io/docs/configuration/resources.html#count-multiple-resource-instances) to
creating multiple instances of the same resource. I have been combining it with `lists` and `maps` to configure
multiple instances of resources such as AWS VPC subnets, Autoscaling groups and most recently Network ACL rules. 

For example:

```

module "vpc_services" {
  source   = "../../modules/vpc"
  ...
  
  private_subnet_nacl_rules = "${list(
    map(
      "subnet_name", "SubnetA",
      "rule_number", 100,
      "egress", false,
      "protocol", "tcp",
      "rule_action", "allow",
      "cidr_block","${local.vpc_root}.12.0/24",
      "from_port", 1433,
      "to_port", 1433
    ),
    map(
      "name", "SubnetB",
      "rule_number", 101,
      "egress", true,
      "protocol", "tcp",
      "rule_action", "allow",
      "cidr_block","${local.vpc_root}.93.0/24",
      "from_port", 32768,
      "to_port", 65535
    ),
    ...
    # more such rules
  )}"

}

```

The resource creation looks as follows:

```
locals {
    public_network_acl_ids_map = "${zipmap(
        aws_subnet.public.*.tags.Name, aws_network_acl.public_subnets.*.id
    )}",
    private_network_acl_ids_map = "${zipmap(
        aws_subnet.private.*.tags.Name, aws_network_acl.private_subnets.*.id
    )}"
}

...

resource "aws_network_acl_rule" "private_subnet_rules" {
    count = "${length(var.private_subnet_nacl_rules)}"

    network_acl_id = "${lookup(
        local.private_network_acl_ids_map,
        lookup(var.private_subnet_nacl_rules[count.index], "subnet_name")
    )}"

    rule_number    = "${lookup(var.private_subnet_nacl_rules[count.index], "rule_number")}"
    egress         = "${lookup(var.private_subnet_nacl_rules[count.index], "egress")}"
    protocol       = "${lookup(var.private_subnet_nacl_rules[count.index], "protocol")}"
    rule_action    = "${lookup(var.private_subnet_nacl_rules[count.index], "rule_action")}"

    cidr_block     = "${lookup(var.private_subnet_nacl_rules[count.index], "cidr_block")}"
    from_port      = "${lookup(var.private_subnet_nacl_rules[count.index], "from_port")}"
    to_port        = "${lookup(var.private_subnet_nacl_rules[count.index], "to_port")}"
}
```

Since we are using the `count` attribute which Terraform uses in its state to keep track of the resources' state, 
a change in an item somewhere in the middle of the `private_subnet_nacl_rules` list, will in this case cause the 
rules following itto be created and destroyed. Of course, this is not limited to Network ACL rules. See [issue](https://github.com/hashicorp/terraform/issues/14275). 

What do we do? The most straightforward approach to this is to create separate `aws_network_acl_rule` resources
by hand. Instead of writing by hand however, what if we generate the ACL rules? That way:

- We don't run into the issue with count
- We don't have to manually write the terraform configuration for each network ACL rule

# Specification for Network ACL rules

An AWS network ACL rule has the following specification:

- Rule number
- Egress or ingress
- protocol
- from port
- to port
- CIDR block
- Network ACL to which it is attached to

I propose a [toml](https://github.com/toml-lang/toml) based specification:

```
subnet_name = "SubnetA"

rules = [
    {rule_no=101, egress = false, protocol = "tcp", rule_action = "allow", cidr_block = "127.0.0.1/32", from_port = 22, to_port = 30},
    {rule_no=102, egress = true, protocol = "tcp", rule_action = "allow", cidr_block = "127.0.0.1/32", from_port = 22, to_port = 30}
]
```
The assumption here is that, we will have a Network ACL rules specification file per Network ACL and the network ACL ID 
will be derived from the Subnet's name specified in `subnet_name`.

# Generating Terraform configuration

Now that we have a specification for our network acl rules, we will now write our program which will generate Terraform code 
from it. I will be using [burntsushi/toml](https://github.com/BurntSushi/toml) to parse the TOML file and serialize
it into a Golang structure. 

The key bit here is the Golang struct which we will serialize the rules into:

```
type naclRulesSpec struct {
	SubnetName string     `toml:"subnet_name"`
	Rules      []naclRule `toml:"rules"`
}
```


We define `naclRule` as a struct as follows:

```
type naclRule struct {
	NetworkACLID string `tf:"network_acl_id"`
	Egress       bool   `toml:"egress" tf:"egress" tf_type:"bool"`
	RuleNo       int64  `toml:"rule_no" tf:"rule_number" tf_type:"int"`
	RuleAction   string `toml:"rule_action" tf:"rule_action"`
	CidrBlock    string `toml:"cidr_block" tf:"cidr_block"`
	Protocol     string `toml:"protocol" tf:"protocol"`
	FromPort     int64  `toml:"from_port" tf:"from_port" tf_type:"int"`
	ToPort       int64  `toml:"to_port" tf:"to_port" tf_type:"int"`
}
```

From the rules specification above, you can see that we are not specifying the network acl ID, since in this case
we will be generating Terraform code to look it up based on the subnet name. For all the other fields, we specify
the struct tag `toml:xxx` corresponding to the TOML table key we specify in the rules specification. The other
struct tags we specify, `tf` and `tf_type` are used in generating the Terraform code:

- `tf`: This specifies the Terraform attribute the structure field corresponds to in the [aws_network_acl_rule](https://www.terraform.io/docs/providers/aws/r/network_acl_rule.html) resource.
- `tf_type`: We use this to determine if the attribute value is a string or another data type understood by terraform


The following code will then read a Network ACL rules specification and serialize it into Golang objects:

```
naclSpecPath := os.Args[1]
var naclRules naclRulesSpec
if _, err := toml.DecodeFile(naclSpecPath, &naclRules); err != nil {
    fmt.Println("Error", err)
    return
}
subnetName = naclRules.SubnetName
```

At this stage, we have all the network ACL rules in `naclRules.Rules`. Let's say we would want to run some validation on the
rules specified - is the rule number valid? Is the CIDR a valid CIDR? and any other custom criteria we can think of. We can do
so before we generate the Terraform code. It's also worth noting that the above serialization step will also assist in catching
data type mismatch errors.

Here's how we can run validation on the specified rules and generate Terraform code if all the rules are valid:

```
// We use the index only pattern here so that
// we can modify the array elements to insert the
// static value for NetworkAclID
for i := range naclRules.Rules {
	if result, err := naclRules.Rules[i].Validate(); !result {
		log.Fatalf("Invalid rule specification: %#v\n%v\n", naclRules.Rules[i], err)
	}
	// This is static terraform code which looks up the Network ACL id from a map
	// created in Terraform
	naclRules.Rules[i].NetworkACLID = fmt.Sprintf(`${lookup(local.network_acl_ids_map, "%s")}`, subnetName)
}
generateTfNaclRules(naclRules.Rules)
```

The `generateTfNaclRules` function makes use of Golang templates to create the Terraform configuration. 

# Demo

If we build the [code](https://github.com/amitsaha/toml_to_tf/tree/master/nacl), and run it:

```
$ ./nacl ./nacl_example.toml
```

A file `SubnetA_nacls.tf` will be created as follows:

```

# This is a generated file, do not hand edit. See README at the
# root of the repository

resource "aws_network_acl_rule" "rule_SubnetA_ingress_101" {

    network_acl_id = "${lookup(local.network_acl_ids_map, "SubnetA")}"
    egress = false
    rule_number = 101
    rule_action = "allow"
    cidr_block = "127.0.0.1/32"
    protocol = "tcp"
    from_port = 22
    to_port = 30


}
resource "aws_network_acl_rule" "rule_SubnetA_egress_102" {

    network_acl_id = "${lookup(local.network_acl_ids_map, "SubnetA")}"
    egress = true
    rule_number = 102
    rule_action = "allow"
    cidr_block = "127.0.0.1/32"
    protocol = "tcp"
    from_port = 22
    to_port = 30


}
```

Couple of things to note here:

- The Terraform configuration file is named as `<subnet name>_nacls.tf`
- The rule resources are named as `rule_<subnet name>_<egress/ingress>_<rule no>`

This basically means that if we delete a rule, `rule_no` from the rules spefication, only a single resource
will be deleted. 
