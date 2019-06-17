---
title: Juicy Code
author: Open Source
date: '2012-01-23'
categories:
  - Code
tags:
  - Juicy
slug: juicy-code
---

Check out this JUICY! code:

~~~ruby
def with_value_from_database(value)
  self.class.from_database(name, value, type)
end

def with_cast_value(value)
  self.class.with_cast_value(name, value, type)
end

def with_type(type)
  if changed_in_place?
    with_value_from_user(value).with_type(type)
  else
    self.class.new(name, value_before_type_cast, type, original_attribute)
  end
end
~~~
