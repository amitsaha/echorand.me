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

## Sepsis-3 Criteria

From [The Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3)](https://jamanetwork.com/journals/jama/fullarticle/2492881):

> Sepsis should be defined as life-threatening organ dysfunction caused by a dysregulated host response to infection

> For clinical operationalization, organ dysfunction can be represented by an increase in the Sequential [Sepsis-related] Organ Failure Assessment (SOFA) score of 2 points or more, which is associated with an in-hospital mortality greater than 10%.

Another key point that's worth mentioning from the above is:

> As described later, even a modest degree of organ dysfunction when infection is first **suspected** is associated with an in-hospital mortality in excess of 10%. Recognition of this condition thus merits a prompt and appropriate response.

We will henceforth refer to infection detection as "suspected infection detection".

## Operationalization in code

To implement it, we will need to:

1. Identify the onset of suspected infection
2. Use the SOFA score and its increase magnitude

## Identifying the onset of suspected infection

To identify the onset of suspected infection, we will:

1. Find the time of drawing of first culture for a particular HADM_ID (which uniquely identifies a patient's specific admission)
2. Find the time of administering of antibiotics
3. And if they are within 24 hours of each other (irrespective of order), we consider that there is an onset of suspected infection.

### Time of drawing of the first culture

```python
# ['CHARTDATE'].min() computes the minimum (earliest) CHARTDATE for each HADM_ID group
# since we already prased the CHARTDATE as datetime during reading, the min function
# works as intended

first_culture = micro.groupby('HADM_ID')['CHARTDATE'].min().reset_index()
first_culture.columns = ['HADM_ID', 'first_culture_time']
```

### Time of administering of antiobiotics

From [Incidence and Trends of Sepsis in US Hospitals Using Clinical vs Claims Data, 2009-2014](https://pubmed.ncbi.nlm.nih.gov/28903154/),


antibiotics = ['Vancomycin', 'Ceftriaxone', 'Meropenem', 'Piperacillin-Tazobactam', 'Levofloxacin']
extended_abx = [
    'Cefepime', 'Azithromycin', 'Ampicillin', 'Ampicillin/Sulbactam', 
    'Clindamycin', 'Linezolid', 'Metronidazole', 'Cefuroxime', 'Tobramycin', 
    'Gentamicin', 'Imipenem', 'Imipenem/Cilastatin', 'Ticarcillin', 
    'Ticarcillin/Clavulanate', 'Ciprofloxacin'
]
all_abx = antibiotics + extended_abx
abx_given = prescriptions[prescriptions['DRUG'].str.contains('|'.join(all_abx), case=False, na=False)]

first_abx = abx_given.groupby('HADM_ID')['STARTDATE'].min().reset_index()
first_abx.columns = ['HADM_ID', 'first_abx_time']


## References

1. [MIMIC-III data description](https://mimic.mit.edu/docs/iii/tables/)



