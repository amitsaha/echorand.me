---
title:  Notes on Bash auto-completion on Linux
date: 2019-06-14
categories:
-  software
aliases:
- /notes-on-bash-auto-completion-on-linux.html
draft: true
---

If you are using Bash in default, `vi mode`, this post aims to shed some light on how auto-completions work.

What happens when you press `<command> <TAB>` or `<command> <TAB><TAB>`? You get a bunch of suggestions with one of them
just the one you had in mind you were going to type. Auto completions in shells are super helpful and as we will find
out, quite a bit goes on behind the scenes. Before we go too further into my investigations and findings, I  must credit the author of 
this [blog post](https://www.joshmcguigan.com/blog/shell-completions-pure-rust/) - it triggered
my curiosity and made me find time out to learn more about something I use everyday, but didn't know much about how
it worked.

Let's learn more about the minions that gets to work when we press `<TAB>` or `<TAB><TAB>` on a popular Linux shell, `BASH`.

## Setting up

Let's get a fresh Fedora 30 VM in a Vagrant box and set it up:

```
$ # Get fedora vagrant box
$ # vagrant init
$ # ..
$ vagrant up
...
$ vagrant ssh
 $ sudo dnf remove bash-completion
 $ sudo dnf install bpftrace
 $ curl https://raw.githubusercontent.com/iovisor/bpftrace/master/tools/execsnoop.bt -o execsnoop.bt
```

On a terminal, (Terminal 1), type in `$ git <TAB><TAB>` (the space between `git` and `<TAB><TAB>` is important). 
The only suggestions you get will be the files in the
directory you are in. Not very helpful suggestions, you say. I know - and that's because we uninstalled a 
package which would have magically done that for us. (`bash-completion`). Let's keep it that way for 
now.

## DIY bash completion

When we type in `$git <TAB><TAB>`, we expect to see suggestions of the git sub-commands, such as `status`, `clone`,
and `checkout`. Let's aim to achieve that.

First, create a file, `/tmp/git_suggestions`, put in the following snippet and make it executeable 
(`chmod +x /tmp/git_suggestions`):

```

#!/bin/bash

echo "status"
echo "checkout"
echo "clone"
echo "branch"
```

This script prints four git subcommands - one on each line. Now, execute the command from Terminal 1:

```
$  complete -C "/tmp/git_suggestions" git
```

The `complete` bash built-in is a way to tell bash what we want it to do when we ask for completing a command.
The `-C` option asks it to call a specified external program. There are various other options some of which we
will learn later on in this post.

Next, type in `git <TAB><TAB>`, you will see that you are now suggested four options for your next command/option:

```
[vagrant@ip-10-0-2-15 temp]$ git <TAB><TAB>
branch    checkout  clone     status    

```

Note that each of the suggestion is a line printed by the above script. Let's delve further into this.

## Exec snooping 

Open a new terminal (Terminal 2) and execute the following:

```
$ sudo bpftrace ./execnsoop.bt
```

Now, go back to Terminal 1, and type `$git <TAB><TAB>`. 

On Terminal 2, you will see something like:

```
49916      15949 /tmp/git_suggestions git
```

The first column is how long the external program executed for in milliseconds (the number seem weird to me, but that's
a different problem). The second column gives us the process ID and the third column shows us the external program 
along with the arguments it was executed it. We can see that the script `/tmp/git_suggestions` is executed and the
command for which the auto-completion suggestions are being shown is provided as the first argument.


Now, go back to Terminal 1, and type:

```
$ git chec<TAB>
```

On Terminal 2, we will see:

```
189064     16701/tmp/git_suggestions git chec git
```

We see that the script `/tmp/git_suggestions` is now being called with three arguments:

- `git`: The command we are trying to ask BASH to suggest auto-completions for
- `chec`: The word we are asking for completions for
- `git`: The word before the word we are asking for completions for

Let's discuss this a bit. When we press `TAB`, bash tries to find out a matching auto-completion "handler" for the command 
and if it finds one, invokes the handler. When invoking the handler, it calls the handler providing data about the command
it is attempting to provide auto-completion suggestions for. The output of the handler is then parsed by bash and each separate 
line in the output is suggested as possible candidates for the auto-completion.

Let's discuss more about the data provided to completion handlers.

## Data provided to completion handlers

We will update our `/tmp/git_suggestions` script to be as follows:

```
#!/bin/bash

echo "status"
echo "checkout"
echo "clone"
echo "branch"

# Print the envrionment variables relevant to bash autocompletion
env | grep COMP > /tmp/log
```

We add a line at the end to print all environment variables having COMP in them and log it to
a file. Now, if we go back to Terminal 1, and type `$git checkout <TAB><TAB>`, we will again see:

```

$ git checkout <TAB><TAB>
branch                   clone                    checkout                 status 

```

Let's display the contents of `/tmp/log` on Terminal 2:

```
$ cat /tmp/log 
COMP_POINT=4
COMP_LINE=git 
COMP_TYPE=63
COMP_KEY=9
```



These environment variables are related to Bash autocompletion:

- `COMP_LINE`: This is the entire line of the command we pressed `<TAB><TAB>` on
- `COMP_TYPE`: This is the type of completion that is being done, `63` is the ASCII code for `?`. According to the [manual](https://www.gnu.org/software/bash/manual/html_node/Bash-Variables.html#Bash-Variables),
this is the operation which will list completions after successive tabs
- `COMP_KEY`: This is the ASCII code of the key which triggered the auto-completion. 9 [stands for](https://en.wikipedia.org/wiki/Tab_key#Tab_characters)
the TAB key
- `COMP_POINT`: This is the cursor position where the `<TAB><TAB>` was pressed

(As an aside, ([show-key](https://linux.die.net/man/1/showkey)) is pretty cool. It shoes you the ASCII code of a presssed key).

## Single `<TAB>` and double `<TAB><TAB>`

It's only while working on this article, I realized that a double `<TAB><TAB>` was necessary to display all the possible
auto-completions in most cases. Let's look into that. A single `<TAB>` will aim to complete (not list) the current command
with the largest common prefix among all the suggestions. If there is no common prefix, it will not do anything. 

Let's verify that by changing the `/tmp/git_suggestions` script to be as follows:

```
#!/bin/bash

echo "status"
# Print the envrionment variables relevant to bash autocompletion
env | grep COMP > /tmp/log

```

Since the script will now print only one value as the suggestion for auto-completion, it will complete
the `git` command by inserting `status`.

Now, if we go to Terminal 1, we will see the following when we press `$ git <TAB>`:

```
$ git status
```

Now, let's go back to Terminal 2, and do:

```
$ cat /tmp/log

COMP_POINT=4
COMP_LINE=git 
COMP_TYPE=9
COMP_KEY=9
```

Let's compare the values of these variables to the previous double `<TAB>` suggestion:

- The values of COMP_POINT and COMP_LINE are different are the same as the previous example
- The value of COMP_KEY is the same, 9 corresponding to the TAB key
- The value of COMP_TYPE is 9 which corresponds to the ASCII code of the TAB key and 
  the Bash manual refers to this as "normal" completion.

Update the `/tmp/git_suggestions` script to be as follows:

```
#!/bin/bash

echo "checkout"
echo "check"

# Print the envrionment variables relevant to bash autocompletion
env | grep COMP > /tmp/log
```

Now, let's go back to Terminal 1, and type in: `$ git <TAB>`, we will now see this:

```
$ git check
```

`checkout` and `check` share the common prefix, `check` and hence is inserted at the cursor upon
pressing a single `<TAB>`.

Let's now update the `/tmp/git_suggestions` script as follows:

```
#!/bin/bash

echo "checkout"
echo "branch"

# Print the envrionment variables relevant to bash autocompletion
env | grep COMP > /tmp/log

```

Now, if we go back to Terminal 1 and type in `$git <TAB>`, we will not see any completion since
there is no common prefix between the two words "checkout" and "branch". 

If you have your terminal bell turned on and your computer's speaker switched on, you should hear a bell 
when this happens.


## Getting good old BASH completion back

Now, on Terminal 2, let's install the `bash-completion` package and then exec bash to get a new
shell. On Terminal 1, run:

```
$ sudo bpftrace execnsnoop.bt

```
On Terminal 2, type, in `$ git <TAB>`, we will not see any auto-completion being performed. 


On Terminal 1, now we will see something like:

```
95607      1470  git --list-cmds=list-mainporcelain,others,nohelpers,alias,list-complete,config
```

While trying to make auto-completion suggestions, the above command is being executed. However, it
seems like the suggestions do not have any common prefix, hence no completion is being performed. Let's
verify that.


`commonprefix.py` is a Python program, which we will use to verify this:

```
# thanks to https://stackoverflow.com/a/6718435
import fileinput
import os

suggestions = []
for line in fileinput.input():
    suggestions.append(line.rstrip('\n'))

print(os.path.commonprefix(suggestions))

```

Now, let's see if the suggestions had a common prefix:

```
$ git --list-cmds=list-mainporcelain,others,nohelpers,alias,list-complete,config | python3 commonprefix.py
```

This verifies that there were no common prefix among all the suggestions and hence <TAB> didn't
bring up any suggestion.



## `complete` built-in command

Let's revisit the `complete` built-in. Previously, we used `complete -C` to specify a command to be executed
when an auto-completion is attempted for the `git` command. The next switch we will explore is `complete -p`:

```

```

## `compgen` built-in command


## Other COMP_TYPE values and readline variables


## Putting the pieces together

What does bash-completion package do?







https://www.joshmcguigan.com/blog/shell-completions-pure-rust/

https://spin.atomicobject.com/2016/02/14/bash-programmable-completion/

https://unix.stackexchange.com/questions/261687/is-it-possible-to-configure-bash-to-autocomplete-with-one-tab-like-zsh/461079

https://stackoverflow.com/questions/12044574/getting-complete-and-menu-complete-to-work-together

https://unix.stackexchange.com/questions/166908/is-there-anyway-to-get-compreply-to-be-output-as-a-vertical-list-of-words-instea
