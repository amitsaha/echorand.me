---
title:  Detecting RLO character in Python
date: 2018-02-19
categories:
-  Python
aliases:
- /detecting-rlo-character-in-python.html
---

At work, I learned about how [Right-to-Left Override](https://krebsonsecurity.com/2011/09/right-to-left-override-aids-email-attacks/) was being used to make actually malicious files to look harmless. For example,
a `.exe` file was being made to appear as `.doc` files. We didn't want to allow uploading such files.
This meant that I nedded to detect the presence of the `RLO` character in the filename.

Then, I came across [this](https://stackoverflow.com/questions/17684990/python-testing-for-utf-8-character-in-string) post, where I learned about [unicode bidirectional class](https://www.w3.org/International/articles/inline-bidi-markup/uba-basics) and Python's [bidirectional()](https://docs.python.org/2/library/unicodedata.html#unicodedata.bidirectional) method.

The final solution for detection looked like this:

```
import unicodedata
..
filename = 'arbitrary_filename.doc'
if 'RLO' in [unicodedata.bidirectional(c) for c in unicode(filename)]:
    raise ValueError('Invalid character in one or more of the file names')
..
```
