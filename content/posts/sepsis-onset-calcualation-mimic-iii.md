---
title:  Sepsis onset calculation from MIMIC-III data using sepsis-3 criteria
date: 2025-11-10
categories:
- research
---

In this blog post, I am going to desribe how we can calculate sepsis onset time using
sepsis-3 criteria for the MIMIC-III patient data.

- [Reading the relevant tables](#reading-the-relevant-tables)
- [Sepsis-3 Criteria](#sepsis-3-criteria)
- [Operationalization in code](#operationalization-in-code)
- [Identifying the onset of suspected infection](#identifying-the-onset-of-suspected-infection)
  - [Time of drawing of the first culture](#time-of-drawing-of-the-first-culture)
  - [Time of administering of antibiotics](#time-of-administering-of-antibiotics)
  - [Identifying infection onset](#identifying-infection-onset)
- [Identifying organ failure/dsyfunction](#identifying-organ-failuredsyfunction)
  - [Calculation of total SOFA score](#calculation-of-total-sofa-score)
- [Finding sepsis onset time](#finding-sepsis-onset-time)
- [Code](#code)
- [Data access](#data-access)
- [Assumptions](#assumptions)
- [References](#references)


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

For the **central nervous system**, we calculate the Glasgow Coma Scale (GCS) score, 
measuring the following by reading the `chartevents` table:

A. Eye response (item id: 223900, 220739)
B. Verbal response (item id: 223901)
C. Motor response (item id: 223902)

We read the data one chunk at a time, and accumulate them in a list:

```python

gcs_rows = []

gcs_chunk = chunk[chunk['ITEMID'].isin(
    gcs_itemids['EYE'] + gcs_itemids['VERBAL'] + gcs_itemids['MOTOR']
)].copy()
gcs_rows.append(gcs_chunk)
```

Then, we create a dataframe, and process the individual scores and calculate the final score that
will be used for SOFA calculation:

```python

gcs_all = pd.concat(gcs_rows)
gcs_all = gcs_all.dropna(subset=['VALUENUM'])

# Take the maximum when multiple measurements exist for the hour
gcs_all['CHARTTIME'] = pd.to_datetime(gcs_all['CHARTTIME']).dt.floor('h')
gcs_pivot = gcs_all.pivot_table(index=['HADM_ID', 'CHARTTIME'], 
                                columns='ITEMID', values='VALUENUM', aggfunc='max').reset_index()
gcs_pivot.columns.name = None

# Rename columns for clarity
gcs_pivot = gcs_pivot.rename(columns={
    223900: 'eye',
    220739: 'eye_alt',
    223901: 'verbal',
    223902: 'motor'
})

# Fill missing eye from alternate
gcs_pivot['eye'] = gcs_pivot['eye'].combine_first(gcs_pivot['eye_alt'])

# Ensure all three components exist
for col in ['eye', 'verbal', 'motor']:
    if col not in gcs_pivot.columns:
        gcs_pivot[col] = np.nan

# Total GCS calculation (NaNs allowed)
gcs_pivot['gcs_total'] = gcs_pivot[['eye', 'verbal', 'motor']].sum(axis=1, min_count=1)

# Fill fully missing GCS with 15 (assume alert) 
# TODO alternative - forward fill
gcs_pivot['gcs_total'] = gcs_pivot['gcs_total'].fillna(15)

# CNS SOFA scoring bins and severity allocation
gcs_pivot['cns_score'] = pd.cut(
    gcs_pivot['gcs_total'],
    bins=[-float('inf'), 5, 8, 11, 14, 15],
    labels=[4, 3, 2, 1, 0]
).astype(int)

# Final GCS score output
cns_scores = gcs_pivot[['HADM_ID', 'CHARTTIME', 'cns_score']]
```


For **Cardio vascular system** score, we read the following data from different tables:

1. Mean arterial pressure (MAP) from `chartevents`
2. Vasopressors from `inputevents_mv` and `inputevents_cv`
   1. Dopamine
   2. Dobutamine
   3. Epinephrine
   4. Norepinephrine

Based on the rate of the vasopressor administration and the MAP, a severity score is assigned.
See reference [2], Page 7 for the severity score assignment.

To see the calculation of the cardiovascular score, see the notebook, [Cardiovascular Score Standalone.ipynb](https://github.com/amitsaha/mimic-ml/blob/main/mimic-iii/sepsis-onset/Cardiovascular%20Score%20Standalone.ipynb) in the associated GitHub repository for this post.

For calculating the **respiratory system** score, we calculate the P/F ratio
(P: PaO2 - Partial pressure of oxygen), (F: Fraction of inspired oxygen),
by reading the following data:

1. Fraction of inspired oxygen (FiO2) from `charevents` (item id: 223835, 3420)
2. Partial pressure of oxygen(PaO2) from `labevents` (item id: 50821)

### Calculation of total SOFA score

Once we have the subscores, we calculate the total SOFA score:

```
from functools import reduce
score_dfs = [
    renal_scores,    
    coag_scores,
    liver_scores,
    cardio_scores,
    cns_scores,
    resp_scores
]

# Merge all on HADM_ID + CHARTTIME
sofa_df = reduce(lambda left, right: pd.merge(left, right, how='outer', on=['HADM_ID', 'CHARTTIME']), score_dfs)

# Fill missing scores with 0
for col in sofa_df.columns:
    if '_score' in col:
        sofa_df[col] = sofa_df[col].fillna(0).astype(int)

# Calculate total SOFA score
sofa_df['total_sofa_score'] = sofa_df[[col for col in sofa_df.columns if '_score' in col]].sum(axis=1)
```

## Finding sepsis onset time

Now, we have the suspected infection time and the organ dysfunction data via the SOFA score, we can
now use the Sepsis-3 criteria to detect the sepsis onset:

```python
# Merge SOFA with infection time
merged = pd.merge(sofa_df, suspected_infection[['HADM_ID', 'infection_time']], on='HADM_ID', how='inner')

# Time diff in hours for each row
merged['time_diff_hours'] = (merged['CHARTTIME'] - merged['infection_time']).dt.total_seconds() / 3600

# Pre- and post-infection windows (24 h before and after)
pre_window = merged[(merged['time_diff_hours'] >= -24) & (merged['time_diff_hours'] < 0)]
post_window = merged[(merged['time_diff_hours'] >= 0) & (merged['time_diff_hours'] <= 48)]

# Get baseline SOFA (lowest in 24h before)
baseline_sofa = pre_window.groupby('HADM_ID')['total_sofa_score'].min().reset_index()
baseline_sofa.columns = ['HADM_ID', 'baseline_sofa']

# Join baseline with post-infection SOFA
post_with_baseline = pd.merge(post_window, baseline_sofa, on='HADM_ID', how='left')
post_with_baseline['sofa_delta'] = post_with_baseline['total_sofa_score'] - post_with_baseline['baseline_sofa']

# First time SOFA delta ≥ 2 = Sepsis Onset
sepsis_onset = (
    post_with_baseline[post_with_baseline['sofa_delta'] >= 2]
    .sort_values(['HADM_ID', 'CHARTTIME'])
    .groupby('HADM_ID')
    .first() # take the earliest charttime for the HADM_ID
    .reset_index()
)

# Output: earliest time of sepsis
sepsis_onset = sepsis_onset[['HADM_ID', 'CHARTTIME']].rename(columns={'CHARTTIME': 'sepsis_onset_time'})
```

With MIMIC-III data, the sepsis onset dataframe should have the shape:

```
sepsis_onset.shape
(1731, 2)
```

## Code

You can find jupyter notebooks [here](https://github.com/amitsaha/mimic-ml/tree/main/mimic-iii/sepsis-onset):

1. [Sepsis onset time calculation](https://github.com/amitsaha/mimic-ml/blob/main/mimic-iii/sepsis-onset/Updated%20-%20Sepsis%20onset%20time%20calculation%20.ipynb)
2. [Cardiovascular score calculation](https://github.com/amitsaha/mimic-ml/blob/main/mimic-iii/sepsis-onset/Cardiovascular%20Score%20Standalone.ipynb)

## Data access

See [here](https://mimic.mit.edu/docs/gettingstarted/).

## Assumptions

1. The sepsis onset is determined at an admission level, rather than an ICU stay level

## References

1. [MIMIC-III data description](https://mimic.mit.edu/docs/iii/tables/)
2. [Supplementary material of An optimal antibiotic selection framework for Sepsis patients using Artificial Intelligence](https://pmc.ncbi.nlm.nih.gov/articles/PMC11607445/)