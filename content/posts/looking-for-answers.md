---
title:  Looking for answers without outsourcing
date: 2026-05-04
categories:
-  software
---

I want to get access to the `subject_id` within my [Pytorch dataset](https://docs.pytorch.org/tutorials/beginner/basics/data_tutorial.html).

Challenge: I don't want to ask the Internet, and may be only, a good old internet search, no LLM.

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
