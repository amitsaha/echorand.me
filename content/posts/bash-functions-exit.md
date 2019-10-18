---
title:  Bash functions and exit
date:  2019-10-18 
categories:  infrastructure
---


Monday was just beginning to roll on as Monday does, I had managed to work out the VPN issues and had
just started to do some planned work. Then, slack tells me that new deployment had just been pushed out successfully, but
the service was actually down. Now, we had HTTP healthchecks which was hitting a specific endpoint but apparently
that was successful, but functionally the service was down. So I check the service logs, which shows something like this:

```
Oct 14 00:03:35 ip-192-168-6-113.eu-central-1.compute.internal docker[20833]: The environment file is invalid!
Oct 14 00:03:35 ip-192-168-6-113.eu-central-1.compute.internal docker[20833]: Failed to parse dotenv file due to an unexpected escape sequence..
```

This was a PHP service which was using [phpdotenv](https://github.com/vlucas/phpdotenv) to load the environment variables
from a file. Okay, so we have found the issue which we can now fix. 

However, I think why didn't the whole startup script just abort when it got this error? This is how our startup script 
looked like at this stage:

```bash
#!/usr/bin/env bash

CHOWN_BIN=/usr/bin/chown
GREP_BIN=/usr/bin/grep


function _check_migrations() {
  php$PHP_VERSION $APPLICATION_ROOT/artisan migrate:status | $GREP_BIN -c 'No'
}

FAILED_MIGRATIONS_COUNT=$(_check_migrations)
if [ $FAILED_MIGRATIONS_COUNT != "0" ]
then
  echo "ERROR: Cannot start while there are $FAILED_MIGRATIONS_COUNT unapplied migrations!!!"
  exit 1
fi


$CHOWN_BIN -R $PHP_FPM_USER:$PHP_FPM_GROUP $APPLICATION_ROOT
$PHP_FPM_BIN -y $PHP_FPM_CONF --nodaemonize &

CHILD_PID=$!
wait $CHILD_PID

```
The error above was happening when the `_check_migrations` function was being called. Since we didn't have a
`-e` in the Bash script, the script continued executing (hence starting the `php-fpm` workers) even though the `php artisan`
command had failed to execute successfully.

So I thought ok, i will just add a `set -e` to the script above:

```diff
diff --git a/scripts/app.sh b/scripts/app.sh
index 6df3af8..3553eff 100755
--- a/scripts/app.sh
+++ b/scripts/app.sh
@@ -1,4 +1,5 @@
 #!/usr/bin/env bash
+set -e
 
 CHOWN_BIN=/usr/bin/chown
 GREP_BIN=/usr/bin/grep
```

So, I tried the above and what happened? The script will error out if the `php` command above runs successfully and
if the output doensn't have the word `No` (i.e. no migrations need to be applied). Why? That's how `grep` works. If it
doesn't find a match, the exit code is non-zero. Frantic googling later, I next have another fix:

```diff
index 3553eff..64d0f60 100755
--- a/scripts/app.sh
+++ b/scripts/app.sh
@@ -11,7 +11,9 @@ function _term() {
 }
 
 function _check_migrations() {
-  php$PHP_VERSION $APPLICATION_ROOT/artisan migrate:status | $GREP_BIN -c 'No'
+  # we have the last | cat so that the overall exit code is that of cat in case
+  # of the first two commands executing successfully
+  php$PHP_VERSION $APPLICATION_ROOT/artisan migrate:status | $GREP_BIN -c 'No' | cat
 }
 
```

This fails again, since `grep` was the problem, but obviously I was in a hurry to think. Then I think i know of this
thing called, `-o pipefail`, let me try that:

```diff
index 64d0f60..150fd76 100755
--- a/scripts/app.sh
+++ b/scripts/app.sh
@@ -1,5 +1,5 @@
 #!/usr/bin/env bash
-set -e
+set -eo pipefail
 
 CHOWN_BIN=/usr/bin/chown
 GREP_BIN=/usr/bin/grep
```

But that doesn't work either since `grep` is the problem! So, I decide to lose the conciseness and do this:

```diff
index 150fd76..6a9457a 100755
--- a/scripts/app.sh
+++ b/scripts/app.sh
@@ -1,5 +1,4 @@
 #!/usr/bin/env bash
-set -eo pipefail
 
 CHOWN_BIN=/usr/bin/chown
 GREP_BIN=/usr/bin/grep
@@ -13,7 +12,12 @@ function _term() {
 function _check_migrations() {
   # we have the last | cat so that the overall exit code is that of cat in case
   # of the first two commands executing successfully
-  php$PHP_VERSION $APPLICATION_ROOT/artisan migrate:status | $GREP_BIN -c 'No' | cat
+  status=`php$PHP_VERSION $APPLICATION_ROOT/artisan migrate:status`
+  exit_status=$?
+  if [ $exit_status -ne 0 ]; then
+    exit $exit_status
+  fi
+  echo $status | $GREP_BIN -c 'No'
 }
 ```
 
 This works as in it will exit the script if there is an error running the `php` command which is what we want, else proceed
 as earlier. Or so I thougt.
 
 It turns out when you cal a Bash function using the syntax `$()` you are actually invoking a subshell (duh!) which means
 exiting in the Bash function, only exits from that shell - which makes sense but I didn't know that. That means,
 the original issue I sought out to fix wouldn't actually be fixed. Anyway, here's the fixed version:
 
 ```bash
 #!/usr/bin/env bash

CHOWN_BIN=/usr/bin/chown
GREP_BIN=/usr/bin/grep

# Helper functions
function _term() {
  echo 'Caught SIGTERM signal!'
  kill -15 $CHILD_PID
}

php$PHP_VERSION $APPLICATION_ROOT/artisan migrate:status
exit_status=$?
if [[ $exit_status -ne 0 ]]; then
  exit $exit_status
fi
FAILED_MIGRATION_COUNT=`php$PHP_VERSION $APPLICATION_ROOT/artisan migrate:status | $GREP_BIN -c 'No'`
if [ $FAILED_MIGRATION_COUNT != "0" ]; then
  echo "ERROR: Cannot start while there are $FAILED_MIGRATIONS_COUNT unapplied migrations!!!"
  exit 1
fi

trap _term SIGTERM

$CHOWN_BIN -R $PHP_FPM_USER:$PHP_FPM_GROUP $APPLICATION_ROOT
$PHP_FPM_BIN -y $PHP_FPM_CONF --nodaemonize &

CHILD_PID=$!

wait $CHILD_PID
```

Essentially, i have now running `php artisan migrate:status` twice. First to check if the `.env` file can be read
successfully and error out if not. Second, actually check for the migrations. We can make it more concise, but who
knows what will break? 

If you really want to use a Bash function and also exit early, this [link](https://stackoverflow.com/a/9894126) will help.

Here's some test code:

```bash
function foo() {
	echo "in foo, exiting"
	exit 1
}

function bar() {
	echo "In bar"
}

bar
# this invocation will exit the script
foo
# this invocation will not exit the script
f=$( foo )
echo $f
echo "hi there"
```
