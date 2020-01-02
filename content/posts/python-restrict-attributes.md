---
title: Restricting attributes that can be set in Python
date: 2020-01-02
categories:
-  Python
---

A reader of my book "Doing Math with Python" wrote to me a few weeks back about a strange
problem they were having. They were trying to create an animated projectile motion from the
code listing in the book. However, they were not seeing the expected results. Worse, there
were no errors. They figured the issue on their own eventually since I didn't get the time
to reply back and the issue was there was an attribute `center` on a class that was being set
in the correct version. However, the reader was by mistake setting the `centre`. It's easy
to do that - American versus British English. Learn more `here <https://www.grammarly.com/blog/center-centre/>`__.

Anyway, coming back to Python, that is the default Python behavior of user-defined objects.
If you are setting an attribute on an object that hasn't been defined as an attribute of the 
object's class, it will not complain. The solution is to implement your own custom restriction.

The solutions discussed in the `stackoverflow post <https://stackoverflow.com/questions/3603502/prevent-creating-new-attributes-outside-init>`__ i
has solutions - one of which should work.
