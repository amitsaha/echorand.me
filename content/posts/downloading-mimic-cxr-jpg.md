---
title:  Downloading MIMIC-CXR-JPG data from Google cloud
date: 2024-07-14
categories:
- research
---

I recently downloaded [MIMIC-CXR-JPG](https://physionet.org/content/mimic-cxr-jpg/2.1.0/#files), from Google cloud storage.
The reason I had to eventually use Google cloud storage download was because of the [suggestion](https://github.com/MIT-LCP/mimic-code/discussions/1725) that was offered
for working around the bandwidth constrained physionet.org servers.

These are some notes that might help someone else.

Before you get started:

1. Right off the bat, the first thing you want to keep in mind is the bucket's configured so that the downloader will bear the
cost of network transfer. See [Requester pays](https://cloud.google.com/storage/docs/using-requester-pays#using) to learn more.
It will come to about ~ 120 USD. You will need to ensure that you have a Google cloud project created and billing information configured.
(You may find [Google's Research Credits program](https://edu.google.com/intl/ALL_us/programs/credits/research/?modal_active=none) relevant and useful for your use case)
2. You will need around ~ 570 GB disk space
3. Complete your Physionet credentials and training
4. Obtain access to the google cloud storage bucket by following links at [physionet](https://physionet.org/projects/mimic-cxr-jpg/2.1.0/request_access/3)
5. Setup [gcloud CLI](https://cloud.google.com/sdk/gcloud/)


## Downloading the data

The data downloading command will be as follows:

```
$ gcloud storage --billing-project phd-work-427010 \ # this is how you specify what Google cloud project the transfer cost will be charged to
  cp -r   "gs://mimic-cxr-jpg-2.1.0.physionet.org/IMAGE_FILENAMES"   \
          "gs://mimic-cxr-jpg-2.1.0.physionet.org/LICENSE.txt"   \
          "gs://mimic-cxr-jpg-2.1.0.physionet.org/README"   \
          "gs://mimic-cxr-jpg-2.1.0.physionet.org/SHA256SUMS.txt"  \
          "gs://mimic-cxr-jpg-2.1.0.physionet.org/files"  \
          "gs://mimic-cxr-jpg-2.1.0.physionet.org/mimic-cxr-2.0.0-chexpert.csv.gz"  \
          "gs://mimic-cxr-jpg-2.1.0.physionet.org/mimic-cxr-2.0.0-metadata.csv.gz"  \
          "gs://mimic-cxr-jpg-2.1.0.physionet.org/mimic-cxr-2.0.0-negbio.csv.gz" \
          "gs://mimic-cxr-jpg-2.1.0.physionet.org/mimic-cxr-2.0.0-split.csv.gz"  \
          "gs://mimic-cxr-jpg-2.1.0.physionet.org/mimic-cxr-2.1.0-test-set-labeled.csv" . # this will create a directory tree inside the directory where you are executing the command from
``` 


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
files/p10/p10375986/s59475126/44685902-a2ada121-02735bc5-bf1bf167-adfd2ae5.jpg: FAILED
files/p11/p11131026/s59741822/08c22db9-5bef7d06-d904ec15-7bbfe57f-416dbdc1.jpg: FAILED
files/p11/p11607063/s58298420/235c7af4-ef2ba0dc-7dc251ea-a2571f33-d37c8185.jpg: FAILED
files/p11/p11785297/s58022353/3b64bf5a-021ff5ae-137c22d1-5529364f-1415c640.jpg: FAILED
files/p11/p11920643/s55676416/4d70ff33-43ad77af-22ff047c-19f6ceb1-aae49eea.jpg: FAILED
files/p13/p13283178/s55081421/026de108-3310a177-7c01791c-7eb32cff-b076122f.jpg: FAILED
files/p13/p13628037/s54872639/f845ad66-716c76dd-da718912-8b0ff596-b30d25cb.jpg: FAILED
files/p13/p13694166/s55805720/df57d48e-566984d2-fbe39e6e-0c68fc55-380f1217.jpg: FAILED
files/p14/p14656449/s56499991/67a4e5cd-50d441d3-42294f94-363ac071-17cfc342.jpg: FAILED
files/p14/p14690121/s50057475/34ad06d4-475863f1-f3712cec-783c3b99-308cf886.jpg: FAILED
files/p17/p17405329/s55291678/283084bb-0f4994a7-d7622b32-d7f18f75-d8dde41b.jpg: FAILED
files/p17/p17490145/s55463370/803fcbd8-2e38a5c7-cca96a50-ce5660cb-83ecc3a1.jpg: FAILED
files/p18/p18459824/s52186356/2eb68b2f-0742cb3d-b8c9db5b-9c9d74f9-69e31cc1.jpg: FAILED
files/p18/p18690742/s56844948/f4f63777-6a8a6b60-d6cb0718-9256537a-2ca41831.jpg: FAILED
sha256sum: WARNING: 14 computed checksums did NOT match
```

As you can see, there were a few mismatches. 

Of course that's not great, so I redownloaded the images once more, however the result was the same.

Finally, I decided that I will download the above files into a different directory and compare the
freshly downloaded version with the originally downloaded version. Running the `diff` command resulted
in no differences between the two versions.

I reported the issue on the [MIT-LCP/mimic-code](https://github.com/MIT-LCP/mimic-code/issues/1763) repository.


