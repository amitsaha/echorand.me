---
title:  Scheduled task to prune docker images on Windows server
date: 2019-01-21
categories:
-  infrastructure
aliases:
- /scheduled-task-to-prune-docker-images-on-windows-server.html
---

Windows docker images can be bulky and on a server that you are deploying your application as docker images, the free disk space
becomes a metric to watch out for. The following script will setup a Scheduled tasks to be run at a 7.0 PM UTC which will prune
all unused images:


```
# Scheduled tasks
if (-Not (Test-Path "C:\ScheduledScripts"))
{
    mkdir C:\ScheduledScripts
}

$command="docker image prune --all -f"
$command | Out-File -encoding ASCII C:\ScheduledScripts\DockerImagePrune.ps1

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-command C:\ScheduledScripts\DockerImagePrune.ps1'
$trigger = New-ScheduledTaskTrigger -Daily -At 07:00pm #UTC
$prncipal = New-ScheduledTaskPrincipal -GroupId "BUILTIN\Administrators" -RunLevel Highest
Register-ScheduledTask -Action $action -Trigger $trigger -Principal $prncipal -TaskName "\PowerShell\PruneUnusedDockerImages" -Description "Prune unused docker images"
```

That's it, and the result:

![Free disk space after scheduled task]({filename}/images/free_disk_space.png "Docker images being pruned")
