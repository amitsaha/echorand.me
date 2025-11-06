---
title:  Sepsis onset calculation from MIMIC-III data using sepsis-3 criteria
date: 2025-11-05
draft: true
categories:
- research
---

## Reading the relevant tables

We first read the data from the CSV files (corresponding to the relevant tables):

```python
import pandas as pd
import numpy as np


MIMIC_DIR = "C:\\Users\\amits\\work\\datasets\\MIMIC-III-v1.4"

patients = pd.read_csv(f"{MIMIC_DIR}\\PATIENTS.csv.gz")
admissions = pd.read_csv(f"{MIMIC_DIR}\\ADMISSIONS.csv.gz",  parse_dates=['ADMITTIME'])
diagnoses_icd = pd.read_csv(f"{MIMIC_DIR}\\DIAGNOSES_ICD.csv.gz")
icustays = pd.read_csv(f"{MIMIC_DIR}\\ICUSTAYS.csv.gz")

micro = pd.read_csv(f"{MIMIC_DIR}\\MICROBIOLOGYEVENTS.csv.gz", parse_dates=['CHARTDATE'], low_memory=False) 
prescriptions = pd.read_csv(f"{MIMIC_DIR}\\PRESCRIPTIONS.csv.gz", parse_dates=['STARTDATE'], low_memory=False)

chartevents = pd.read_csv(f"{MIMIC_DIR}\\CHARTEVENTS.csv.gz", 
                          usecols=['SUBJECT_ID', 'HADM_ID', 'CHARTTIME', 'ITEMID', 'VALUENUM'],
                          chunksize=1000000, # chartevents is big, so we read one chunk at a time
                          low_memory=False, 
                          parse_dates=['CHARTTIME']
             ) # 330712483 rows
labevents = pd.read_csv(f"{MIMIC_DIR}\\LABEVENTS.csv.gz", 
                          usecols=['SUBJECT_ID', 'HADM_ID', 'CHARTTIME', 'ITEMID', 'VALUENUM'],
                          chunksize=1000000, 
                          low_memory=False, 
                          parse_dates=['CHARTTIME']
             ) #27854055 rows

```



## References

1. [MIMIC-III data description](https://mimic.mit.edu/docs/iii/tables/)



