---
title:  Downloading MIMIC-CXR-JPG data from Google cloud
date: 2024-07-09
categories:
- research
draft: true
---

I recently downloaded [MIMIC-CXR-JPG](https://physionet.org/content/mimic-cxr-jpg/2.1.0/#files), from Google cloud storage.
The reason I had to eventually use Google cloud storage download was because of the [suggestion](https://github.com/MIT-LCP/mimic-code/discussions/1725) that was offered
for working around the bandwidth constrained physionet.org servers.

Some notes that might help someone else.

Things to note:

1. Right off the bat, the first thing you want to keep in mind is the bucket's configured so that the downloader will bear the
cost of network transfer. See [Requester pays](https://cloud.google.com/storage/docs/using-requester-pays#using) to learn more.
It will come to about ~ 120 USD. You will need to ensure that you have a Google cloud project created and billing information configured.
(You may find [Google's Research Credits program](https://edu.google.com/intl/ALL_us/programs/credits/research/?modal_active=none) relevant and useful for your usecase)
3. You will need around ~ 570 GB disk space
4. Complete your credentials and training
5. Obtain access to the google cloud storage bucket by following links at [physionet](https://physionet.org/projects/mimic-cxr-jpg/2.1.0/request_access/3)
6. Setup [gcloud CLI](https://cloud.google.com/sdk/gcloud/)



## Downloading the data

## Finding missing images

In the initial download attempt, I had a few images that were not able to be downloaded due to network issues, so I used this script to download the ones that
were not downloaded:

```
# Run this Python script from within the directory where you downloaded the data
import os
import subprocess

not_found = 0
with open('IMAGE_FILENAMES') as f:
    for image in f.readlines():
        fname = image.rstrip('\n')
        try:
            os.stat(fname)
        except FileNotFoundError as e:
            not_found += 1
            print(f"{fname} not found. Downloading")
            print(subprocess.check_output(
                [
                "gcloud", "storage", "--billing-project", "<billing-project-id>", "cp",
                 f"gs://mimic-cxr-jpg-2.1.0.physionet.org/{fname}", f"{fname}"
                 ]
            ))
```

## Verifying the data

To ensure that the data downloaded is OK, we should verify the SHA256 sum:

```
$ sha256sum -c SHA256SUMS.txt  --quiet
```
