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

### Time of administering of antibiotics

Next, we look through the `prescriptions` dataframe's `DRUG` column and filter rows which contain one of the antibiotics
commonly identified for infection onset:

```python

antibiotics = ['Vancomycin', 'Ceftriaxone', 'Meropenem', 'Piperacillin-Tazobactam', 'Levofloxacin']
extended_abx = [
    'Cefepime', 'Azithromycin', 'Ampicillin', 'Ampicillin-Sulbactam', 
    'Clindamycin', 'Linezolid', 'Metronidazole', 'Cefuroxime', 'Tobramycin', 
    'Gentamicin', 'Imipenem', 'Imipenem-Cilastatin', 'Ciprofloxacin'
]

all_abx = antibiotics + extended_abx

abx_lc = [a.lower() for a in all_abx]
drug_lc = prescriptions['DRUG'].fillna('').str.lower()
# Create a boolean mask: True if any antibiotic name is a substring of the DRUG string
mask = drug_lc.apply(lambda s: any(abx in s for abx in abx_lc))
abx_given = prescriptions[mask]

first_abx = abx_given.groupby('HADM_ID')['STARTDATE'].min().reset_index()
first_abx.columns = ['HADM_ID', 'first_abx_time']
```

### Identifying infection onset

Now that we have identified the first instance of administering an antibiotic and drawing blood culture, we now join
the two dataframes based on HADM_ID:

```python
suspected_infection = pd.merge(first_abx, first_culture, on='HADM_ID')
```

Next, we find the delta between the two times and store it as a separate column:

```python
suspected_infection['delta'] = (
    (suspected_infection['first_abx_time'] - suspected_infection['first_culture_time'])
    .dt.total_seconds() / 3600
)
```

Finally, we filter the data to store only those for which the absolute value of delta is within 24 hours:

```python
suspected_infection = suspected_infection[suspected_infection['delta'].abs() <= 24]
```

We add the suspected infection time as a separate column storing the earlier of the two times:

```python
suspected_infection['infection_time'] = suspected_infection[['first_abx_time', 'first_culture_time']].min(axis=1)
```

## Identifying organ failure/dsyfunction

Next, we want to identify organ failures for calculating the sequential organ failure assessment score (SOFA score). It comprises six subscores corresponding to the condition (See reference 2) of
the:

1. Kidney (renal)
2. Coagulation
3. Liver
4. Central nervous system
5. Cardiovascular system
6. Respiratory system

To measure the first three, we will query the `labevents` table for the following item ids:

1. Kidney - creatinine (item id: 50912)
2. Coagulation - platelet count (item id: 51265)
3. Liver - bilirubin total (itemid: 50885)

We read one chunk at a time of the table, group the data into one of four bins based on their value
and then associate a severity label with them (0, 1, 2, 3, 4 - normal to abnormal).

For example, for renal, we do this:

```python
creat_itemid = 50912

renal_rows = []

# Renal - Creatinine
cr = chunk[chunk['ITEMID'] == creat_itemid].copy()
cr['renal_score'] = pd.cut(
    cr['VALUENUM'],
    bins=[-float('inf'), 1.2, 1.9, 3.4, 4.9, float('inf')], # bins for creatinine
    labels=[0, 1, 2, 3, 4] # assignemnt of severity score
).fillna(0).astype(int)
renal_rows.append(cr[['HADM_ID', 'CHARTTIME', 'renal_score']])
```

Once we have read all the data, stored the data for each chunk as a row in the list, we then
create dataframe for each of the three measurements:

```python

# Concatenate results
renal_scores = pd.concat(renal_rows)
coag_scores = pd.concat(coag_rows)
liver_scores = pd.concat(liver_rows)

```

We see that for some of the measurement, the `HADM_ID` is `NaN`, these are data for outpatients,
and will be filtered automatically later on.

Next, we will calculate the remaining three:

4. Central nervous system
5. Cardiovascular system
6. Respiratory system

For the central nervous system, 


## References

1. [MIMIC-III data description](https://mimic.mit.edu/docs/iii/tables/)
2. [Supplementary material of An optimal antibiotic selection framework for Sepsis patients using Artificial Intelligence](https://pmc.ncbi.nlm.nih.gov/articles/PMC11607445/)



