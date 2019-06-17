---
title:  Powershell Measuring seconds elapsed 
date: 2018-07-25
categories:
-  software
aliases:
- /powershell-measuring-seconds-elapsed.html
---

I have been working with [PowerShell](https://docs.microsoft.com/en-us/powershell/scripting/powershell-scripting?view=powershell-6) for
three months now, and my approach to using it has been pretty much google and trial - copying things, modifying things
till they work and learning new things on the way. This post talks about a discovery which I made today.

I had a script like this:

```
while ($health -ne 'healthy') {    
    $elapsedTime = $(get-date) - $StartTime
    Write-Output "--- Waiting for service to become ready - $($elapsedTime.Seconds) seconds"

    if ($elapsedTime.Seconds -lt 120)
    {
        Start-Sleep -s 30
        $health = docker inspect --format '{{ .State.Health.Status }}' service
    } else
    {        
        Write-Output '--- Recreating service'
        docker-compose up -d --no-deps --force-recreate service
        $StartTime = $(get-date)
    }
}

```

To my horror, I found that `$elapsedTime.Seconds` was going back to 0 after the second sleep interval i.e. 60 seconds. Hence,
the recreation service step was never being executed.

What's going on? Let's write a test script:

```
$StartTime = $(get-date)
$StartTime
$health = 'unhealthy'
while ($health -ne 'healthy') {

    $CurrentTime = $(get-date)
    $elapsedTime = $CurrentTime - $StartTime
    $elapsedTime
    $elapsedTime.Seconds
    Start-Sleep -s 5    
}

```

When you run the above script, a key part of the output which tells us the story is:

```
...

50

Ticks             : 551435810
Days              : 0
Hours             : 0
Milliseconds      : 143
Minutes           : 0
Seconds           : 55
TotalDays         : 0.000638235891203704
TotalHours        : 0.0153176613888889
TotalMilliseconds : 55143.581
TotalMinutes      : 0.919059683333333
TotalSeconds      : 55.143581

55

Ticks             : 601789252
Days              : 0
Hours             : 0
Milliseconds      : 178
Minutes           : 1
Seconds           : 0
TotalDays         : 0.000696515337962963
TotalHours        : 0.0167163681111111
TotalMilliseconds : 60178.9252
TotalMinutes      : 1.00298208666667
TotalSeconds      : 60.1789252

..

```

Notice how the `Seconds` property rolls back to 0 after the first 60 seconds? That's because, the `Minutes` property is now 1.

So, always use `TotalSeconds` instead of `Seconds`. Similarly, `TotalMinutes`, `TotalHours` and `TotalDays`.
