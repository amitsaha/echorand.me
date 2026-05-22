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
- [4](#4)
- [5](#5)
- [6](#6)
- [7](#7)
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

```python
(Pdb) insurance_metrics
                                                   n      tp       tn       fp      fn  accuracy  precision    recall        f1       auc    pr_auc
dataset                    insurance
eval_1_cardiomegaly.csv.gz Medicaid          14877.0  1816.0   9472.0   2897.0   692.0  0.758755   0.385317  0.724083  0.502977  0.826120  0.481929
                           Medicare          45393.0  8678.0  21264.0  13126.0  2325.0  0.659617   0.398000  0.788694  0.529033  0.772568  0.493489
...
````

I want to get access to the data for each unique combination of `dataset` and `insurance`":

```python
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

```python
(Pdb) insurance_metrics.get(('eval_1_cardiomegaly.csv.gz', 'Medicaid'))
```

No dice.

Okay, I know, `loc`, and i know that i want to specify a tuple, since I have a `MultiIndex`:

```python
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

```python
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

## 4

I have two dataframes, `new_results` and `baseline_results`.

I want to copy all the data from a `baseline_results` for a specific column value into `new_results`. In this case,
the column value is `baseline_cardiomegaly.csv.gz` for `dataset` column.

My trial and error attempts and how i got there:

```python
(Pdb) new_results
        Unnamed: 0  y_true  y_pred    prob_1  ...                     dataset  gender              race         insurance
0                0       1       1  0.649867  ...  eval_1_cardiomegaly.csv.gz       M             WHITE          Medicare

...            ...     ...     ...       ...  ...                         ...     ...               ...               ...

[142698 rows x 11 columns]

```python

(Pdb) baseline_results
        Unnamed: 0  y_true  y_pred    prob_1  ...                       dataset  gender              race         insurance
0                0       0       0  0.057635  ...  baseline_cardiomegaly.csv.gz       M  RECORD_NOT_FOUND  RECORD_NOT_FOUND
[362281 rows x 12 columns]
```

Awfully bad attempts, without even thinking, one might say, hands typing, brain listening to music (perhaps from the muscle memory of yesterday):

```python

(Pdb) new_results["baseline_cardiomegaly.csv.gz"] = baseline_results["baseline_cardiomegaly.csv.gz"]
*** KeyError: 'baseline_cardiomegaly.csv.gz'


(Pdb) new_results["baseline_cardiomegaly.csv.gz"] = baseline_results.loc("baseline_cardiomegaly.csv.gz")
*** ValueError: No axis named baseline_cardiomegaly.csv.gz for object type DataFrame
(Pdb) new_results["baseline_cardiomegaly.csv.gz"] = baseline_results.loc(["baseline_cardiomegaly.csv.gz"])
*** TypeError: unhashable type: 'list'
(Pdb) new_results["baseline_cardiomegaly.csv.gz"] = pd.Series(baseline_results.loc(["baseline_cardiomegaly.csv.gz"]))
*** TypeError: unhashable type: 'list'
(Pdb) baseline_results.loc(["baseline_cardiomegaly.csv.gz"])
*** TypeError: unhashable type: 'list'
(Pdb) baseline_results.loc(("baseline_cardiomegaly.csv.gz"))
*** ValueError: No axis named baseline_cardiomegaly.csv.gz for object type DataFrame

```

The above attempts are all my brain not considering the fact that I am choosing the value for a specific column and the value itself
is not an index or a column  name.

`dataset` is a column and that's the column I must look up (not an index).

Once the brain has that updated context, I struggle with the exact syntax for filtering a bit:

```python
(Pdb) new_results["baseline_cardiomegaly.csv.gz"] = baseline_results[baseline_results[dataset == "baseline_cardiomegaly..csv.gz"]]
*** NameError: name 'dataset' is not defined
(Pdb) new_results["baseline_cardiomegaly.csv.gz"] = baseline_results[baseline_results["dataset" == "baseline_cardiomegaly..csv.gz"]]
*** KeyError: False
(Pdb) new_results["baseline_cardiomegaly.csv.gz"] = baseline_results[baseline_results["dataset"] == "baseline_cardiomegaly.csv.gz"]
*** ValueError: Cannot set a DataFrame with multiple columns to the single column baseline_cardiomegaly.csv.gz

```

At this point I realize, what i am doing wrong, i have the selection correct, but i am trying to put in multiple columns and assign it to a single column,
so I need `concat` which I again struggle with the right syntax:

```python
(Pdb) new_results = new_results.concat(baseline_results[baseline_results["dataset"] == "baseline_cardiomegaly.csv.gz"])
*** AttributeError: 'DataFrame' object has no attribute 'concat'
(Pdb) new_results = pd.concat(new_results, baseline_results[baseline_results["dataset"] == "baseline_cardiomegaly.csv.gz"])
*** TypeError: concat() takes 1 positional argument but 2 were given
(Pdb) new_results = pd.concat([baseline_results[baseline_results["dataset"] == "baseline_cardiomegaly.csv.gz"], new_results])
```

Okay finally i have it!
Trial and error is my favorite way to learn, the brain needs to take the paths to the solution and there is a satisfaction I derive from that process:

```python
(Pdb) new_results
        Unnamed: 0  y_true  y_pred    prob_1  ...                       dataset  gender              race         insurance
0                0       0       0  0.057635  ...  baseline_cardiomegaly.csv.gz       M  RECORD_NOT_FOUND  RECORD_NOT_FOUND

[362281 rows x 12 columns]
```

Okay, so I am training myself i think. I am my favorite agent.

## 5

I want the equivalent of ternary operator `?` (in C or javascript) in Python. I have forgotten exactly how, but i know that
i can use `if..else` in list comprehension, so perhaps it works outside it too?

Let's try:

```python
>>> import random
>>> value = 1 if random.random() > 0.5 else 0
>>> value
0
>>> value = 1 if random.random() > 0.5 else 0
>>> value
0
>>> value = 1 if random.random() > 0.5 else 0
>>> value
1
```


yeah, it does.

of course, `random.random() > 0.5` is an example of a conditional evaluation.

## 6

I want to access, `feature-prep` directory which is at the same level as `utils`, from inside a file inside `utils`. Basically:

1. Traverse one directory up from `utils`
2. Go down another directory, `feature-prep`

```python
(Pdb) Path(__file__) / "..//feature-prep"
WindowsPath('C:/Users/amits/work/github.com/amitsaha/ml-fairness-health/mywork/experiments/mimic-cxr/utils/common_experiment.py/../feature-prep')
(Pdb) import os
(Pdb) os.path.exists(Path(__file__) / "..//feature-prep")
False
(Pdb) os.path.exists(Path(__file__))
True
(Pdb) os.path.basename(Path(__file__))
'common_experiment.py'
(Pdb) os.path.dirname(Path(__file__))
'C:\\Users\\amits\\work\\github.com\\amitsaha\\ml-fairness-health\\mywork\\experiments\\mimic-cxr\\utils'
(Pdb) os.path.dirname(os.path.dirname(Path(__file__)))
'C:\\Users\\amits\\work\\github.com\\amitsaha\\ml-fairness-health\\mywork\\experiments\\mimic-cxr'
(Pdb) os.path.exists(os.path.dirname(os.path.dirname(Path(__file__)))
*** SyntaxError: '(' was never closed
(Pdb) os.path.exists(os.path.dirname(os.path.dirname(Path(__file__))))
True
(Pdb) os.path.exists(Path(os.path.dirname(os.path.dirname(Path(__file__)))) / "feature-prep")
True
(Pdb) os.path.exists(Path(os.path.dirname(os.path.dirname(Path(__file__)))) / "feature-prep")
```


## 7

```javascript
> const userQueries = ["foo", "bar"];
undefined
> console.log(userQueries)
[ 'foo', 'bar' ]
undefined
> for (const item in userQueries) {
... console.log(item)
... }
0
1
undefined
> for (const idx, item in userQueries) {
for (const idx, item in userQueries) {
           ^^^

Uncaught SyntaxError: Missing initializer in const declaration
> for (const {idx, item} in userQueries) {
... console.log(item)
... {
... }
... }
undefined
undefined
undefined
> for (const item in Object.entries(userQueries)) {
... console.log(item)
... }
0
1
undefined
```

Then, i come across https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Loops_and_iteration#for...of_statement when I search again and in the Google AI summary.

So, we have a `for..of` !? (why???)

```
> for (const item of userQueries) {
... console.log(item)
... }
foo
bar
undefined```
