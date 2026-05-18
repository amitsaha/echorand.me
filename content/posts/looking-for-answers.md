---
title:  Looking for answers without outsourcing to LLM
date: 2026-05-04
categories:
-  software
---

Some examples of where i get limited by a specific programming language/framework's syntax/particular way of doing things, and how I navigate
it by trying to see if i can solve it myself based on what i know or good old internet search, (i.e. manually looking at links/posts) and
learning a bit more in the process.

> I know there is research now showing the impact of using LLMs on our brain, but to me, this is just how I want to do my work. I want to be involved.

Navigation

- [1](#1)
- [2](#2)
- [3](#3)

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

## 3

I have a dataframe which is multi indexed and i want to each each unique combination of index columns data:

```
(Pdb) insurance_metrics
                                                   n      tp       tn       fp      fn  accuracy  precision    recall        f1       auc    pr_auc
dataset                    insurance
eval_1_cardiomegaly.csv.gz Medicaid          14877.0  1816.0   9472.0   2897.0   692.0  0.758755   0.385317  0.724083  0.502977  0.826120  0.481929
                           Medicare          45393.0  8678.0  21264.0  13126.0  2325.0  0.659617   0.398000  0.788694  0.529033  0.772568  0.493489
...
````

I want to get access to the data for each unique combination of `dataset` and `insurance`":

```
insurance_metrics.index
MultiIndex([('eval_1_cardiomegaly.csv.gz',         'Medicaid'),
            ('eval_1_cardiomegaly.csv.gz',         'Medicare'),
            ('eval_1_cardiomegaly.csv.gz',        'No charge'),
```

Search query: "pandas selecting by index value" 

Reading, https://pandas.pydata.org/pandas-docs/stable/user_guide/indexing.html#selection-by-label


> The .loc attribute is the primary access method. The following are valid inputs:
> A single label, e.g. 5 or 'a' (Note that 5 is interpreted as a label of the index. This use is not an integer position along the index.).

>   A list or array of labels ['a', 'b', 'c'].

>    A slice object with labels 'a':'f'. Note that contrary to usual Python slices, both the start and the stop are included, when present in the index! See Slicing with labels.

 >   A boolean array.


**My brain goes. omg.**

So, i start hacking around:

```
(Pdb) insurance_metrics.get(('eval_1_cardiomegaly.csv.gz', 'Medicaid'))
```

No dice.

Okay, I know, `loc`, and i know that i want to specify a tuple, since I have a `MultiIndex`:

```
(Pdb) insurance_metrics.loc(('eval_1_cardiomegaly.csv.gz', 'Medicaid'))
*** ValueError: No axis named ('eval_1_cardiomegaly.csv.gz', 'Medicaid') for object type DataFrame

(Pdb) insurance_metrics.loc[("eval_1_cardiomegaly.csv.gz", "Medicare")]
n            45393.000000
tp            8678.000000
tn           21264.000000
fp           13126.000000
fn            2325.000000
accuracy         0.659617
precision        0.398000
recall           0.788694
f1               0.529033
auc              0.772568
pr_auc           0.493489
Name: (eval_1_cardiomegaly.csv.gz, Medicare), dtype: float64
```

Okay, so i have what i needed. To automate it, i am just gonna use `groupby`:

```
(Pdb) items=[(d, i) for d, i in insurance_metrics.groupby(by=['dataset', 'insurance'])]
(Pdb) type(items[0])
<class 'tuple'>
(Pdb) items[0][0]
('eval_1_cardiomegaly.csv.gz', 'Medicaid')
(Pdb) items[0][1]
                                            n      tp      tn      fp     fn  accuracy  precision    recall        f1      auc    pr_auc
dataset                    insurance
eval_1_cardiomegaly.csv.gz Medicaid   14877.0  1816.0  9472.0  2897.0  692.0  0.758755   0.385317  0.724083  0.502977  0.82612  0.481929
```


Okay, so apparentely, `groupby` works with index columns too. 

