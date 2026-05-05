---
title:  Looking for answers without outsourcing to LLM
date: 2026-05-04
categories:
-  software
---

Some examples of where i get limited by a specific programming language/framework's syntax/particular way of doing things, and how I navigate
it by trying to see if i can solve it myself based on what i know or good old internet search, (i.e. manually looking at links/posts) and
learning a bit more in the process.

Navigation

- [1](#1)
- [2](#2)

## 1

I want to get access to the `subject_id` within my [Pytorch dataset](https://docs.pytorch.org/tutorials/beginner/basics/data_tutorial.html). I know that
it is present in a dictionary for each row of my data.

```python
(Pdb) eval_dataset
<__main__.Cardiomegaly object at 0x00000298DF1C8BC0>
(Pdb) dir(eval_dataset)
['__add__', '__class__', '__class_getitem__', '__delattr__', '__dict__', '__dir__', '__doc__', '__eq__', '__format__', '__ge__', '__getattribute__', '__getitem__', '__getstate__', '__gt__', '__hash__', '__init__', '__init_subclass__', '__le__', '__len__', '__lt__', '__module__', '__ne__', '__new__', '__orig_bases__', '__parameters__', '__reduce__', '__reduce_ex__', '__repr__', '__setattr__', '__sizeof__', '__str__', '__subclasshook__', '__weakref__', 'df', 'img_dir', 'transform']
(Pdb) eval_dataset[0]
(tensor([....]]), tensor([0.]), {'subject_id': '10000032', 'study_id': np.int64(50414267)})
(Pdb) type(eval_dataset[0])
<class 'tuple'>
(Pdb) eval_dataset[0][0]
tensor([[[ 0.9988,  0.5878,  0.1939,  ..., -0.0972, -0.1143, -0.1486],
         [ 0.9817,  0.6392,  0.2796,  ..., -0.1143, -0.1314, -0.0801],
         [ 1.0331,  0.6906,  0.4166,  ...,  0.0569,  0.0398,  0.0056],
         ...,
        
         ...,
         [-1.5430, -1.6650, -1.7522,  ..., -1.7696, -1.7696, -1.7696],
         [-1.5430, -1.6302, -1.7522,  ..., -1.8044, -1.8044, -1.8044],
         [-1.5430, -1.6476, -1.7347,  ..., -1.8044, -1.8044, -1.8044]]])
(Pdb) eval_dataset[0][1]
tensor([0.])
(Pdb) eval_dataset[0][2]
{'subject_id': '10000032', 'study_id': np.int64(50414267)}
```

And there I have it, so now collecting the subject_ids is a matter of:

```
(Pdb) subject_ids = [row[2]["subject_id"] for row in eval_dataset]
```


Python makes it easy to inspect objects and get things. Other languages, a bit trickier perhaps, but it's possible, we have the good old
printing!

## 2

I have an integer and i want to just run a loop that many times. 

1. I search for `for loop javascript`
2. I pick the [MDN link](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Loops_and_iteration)

I preferred MDN over w3schools since i am aware of the authority of MDN - similar to w3schools, of course for me, but just went with MDN.
