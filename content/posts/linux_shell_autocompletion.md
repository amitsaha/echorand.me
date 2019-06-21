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

Let's learn more about the minions that gets to work when we press `<TAB>` or `<TAB><TAB>` on a popular Linux shell, `bash`.

## Setting up

Let's get a fresh Fedora 30 VM in a Vagrant box and set it up:

```
$ # Get fedora vagrant box
$ # vagrant init
$ # ..
$ vagrant up
...
$ vagrant ssh
```

Once we are in the VM:

```
 $ sudo dnf remove bash-completion
 $ sudo dnf install bpftrace
 $ curl https://raw.githubusercontent.com/iovisor/bpftrace/master/tools/execsnoop.bt -o execsnoop.bt
 $ curl https://raw.githubusercontent.com/iovisor/bpftrace/master/tools/statsnoop.bt -o statsnoop.bt
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



These environment variables are related to autocompletion:

- `COMP_LINE`: This is the entire line of the command we pressed `<TAB><TAB>` on.
- `COMP_TYPE`: This is the type of completion that is being done, `63` is the ASCII code for `?`. According to the [manual](https://www.gnu.org/software/bash/manual/html_node/Bash-Variables.html#Bash-Variables), this is the operation which will list completions after successive tabs
- `COMP_KEY`: This is the ASCII code of the key which triggered the auto-completion. 9 [stands for](https://en.wikipedia.org/wiki/Tab_key#Tab_characters)
the TAB key
- `COMP_POINT`: This is the cursor position where the `<TAB><TAB>` was pressed

(As an aside, ([show-key](https://linux.die.net/man/1/showkey)) is pretty cool. It shoes you the ASCII code of a presssed key).

It's worth mentioning here that the data provided to completion handlers and how the handler sends
back the suggestions is different when the handler is a shell function.

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

Now, on Terminal 2, let's install the `bash-completion` package:

```
$ sudo dnf install bash-completion
```

Then `exec bash` to get a new shell. On Terminal 2, run:

```
$ sudo bpftrace execnsnoop.bt

```
On Terminal 1, type, in `$ git <TAB>`, we will not see any auto-completion being performed. 


On Terminal 2, now we will see something like:

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


Let's now ask the question - how did installing the `bash-completion` package magically bring our
auto-completion machinery into motion? The short answer is a bunch of bash magic happening. Let's
see what the long answer is.

## Magic of `bash-completion` package

Let's start by listing all the files that this package creates on our system:

```
$ sudo dnf download bash-completion
$ rpm -qlp bash-completion-2.8-6.fc30.noarch.rpm 
/etc/bash_completion.d
..
/etc/profile.d/bash_completion.sh
..
/usr/share/bash-completion/bash_completion

...
/usr/share/bash-completion/completions
/usr/share/bash-completion/completions/2to3
/usr/share/bash-completion/completions/7z
/usr/share/bash-completion/completions/7za
/usr/share/bash-completion/completions/_cal
/usr/share/bash-completion/completions/_chfn
...
...
/usr/share/pkgconfig/bash-completion.pc
```

The entry point for the completion machinery is the script `/etc/profile.d/bash_completion.sh`
which then sources the file `/usr/share/bash-completion/bash_completion`. It is in this file that
we see a whole bunch of things happening.

As we start reading the file from the top, we see completions for various commands being setup. Let's
look at a few.

As a first example:

```
# user commands see only users
complete -u groups slay w sux
```

The `-u` switch  of the `complete` command is a shortcut to specify that the auto-completion suggestions
for the commands, `groups`, `slay` and `sux` should be the user names on the system.

The second example we will look at is:

```
# type and which complete on commands
complete -c command type which
```

Here we are specifying via the `-c` switch that the suggested completions for the `command`, `type` and `which` commands should be 
all possible command names on the system.

Both the above are examples of pre-defined list of auto-completions that a program author can take advantage of.

Earlier in this post, we saw how we can invoke external programs for auto-completion suggestions. We can also define
shell functions. Here's an example from the above file:

```
complete -F _service service
```

`_service` is a function defined in the same file which uses various other helpers and external commands
to come up with the list of services on the system.


An interesting completion that is setup in this file is a "dynamic" completion handler:

```
complete -D -F _completion_loader
```

The `-D` switch setups a default completion handler for any command for which a compspec is not found. The default
handler is set to the bash function, `_completion_loader` which is:

```
_completion_loader () 
{ 
    local cmd="${1:-_EmptycmD_}";
    __load_completion "$cmd" && return 124;
    complete -F _minimal -- "$cmd" && return 124
}
```

The `__load_completion` function essentially looks for a bash script named as, `command-name`, `command-name.bash`
and `_command-name` in the following locations (preferring whichever it finds first):

```
/home/<user-name>/.local/share/bash-completion/completions/
/usr/local/share/bash-completion/completions/
/usr/share/bash-completion/completions/
```

If it finds one, it sources it. Let's see it in action. On Terminal 2:


```
$ sudo bpftrace ./statsoop.bt
```

On Terminal 1, `exec bash` to start a new bash shell and type in `git <TAB>`. On Terminal 2, we will 
see something like:


```
577    bash               2 /home/vagrant/.local/share/bash-completion/completions/git
577    bash               2 /home/vagrant/.local/share/bash-completion/completions/git.bash
577    bash               2 /home/vagrant/.local/share/bash-completion/completions/_git
577    bash               2 /usr/local/share/bash-completion/completions/git
577    bash               2 /usr/local/share/bash-completion/completions/git.bash
577    bash               2 /usr/local/share/bash-completion/completions/_git
577    bash               0 /usr/share/bash-completion/completions/git
```
The third column in the above output is the return code of the `stat` system call. A non-zero
number there means the file doesn't exist. If we now create a file:

```
$ cat ~/.local/share/bash-completion/completions/git

_my_git_completion()
{
	COMPREPLY="checkout"
}
complete -F _my_git_completion git
```

Now, if we `exec bash` and type in `git <TAB>`, we will see that `checkout` is inserted and on Terminal 2, 
we will see:

```
577    bash               0 /home/vagrant/.local/share/bash-completion/completions/git
```

We use the special variable `COMPREPLY` to send back the auto-completion suggestions to the
shell.

In this section, we looked at how `bash-completion` enables auto-completion from a very high-level
and also saw how auto-completions are looked up dynamically rather than all being loaded at the
beginning of a shell session.

## `compgen` built-in command

While looking at the contents of `/usr/share/bash-completion/bash_completion`, you may have noticed the `compgen`
command. `compgen` is a shell builtin to generate a set of pre-defined completion options. For example, `compgen -c`
will list all possible commands, `compgen -f` will list all the files in the current directory and `compgen -d` will
list all the sub-directories. Further, we can use the "action" option to generate a list of signals (`compgen -A signal`),
list of shell functions (`compgen -A function`) and others.

## Learning more

So far, we have delved a bit into how auto-completion works in Bash, there's definitely a lot we haven't
discussed. The following links are worth looking into:

- [Programmable completion builtins](https://www.gnu.org/software/bash/manual/html_node/Programmable-Completion-Builtins.html#Programmable-Completion-Builtins)
- [Bash programmable completion](https://spin.atomicobject.com/2016/02/14/bash-programmable-completion/)
- [StackOverflow question #1](https://unix.stackexchange.com/questions/261687/is-it-possible-to-configure-bash-to-autocomplete-with-one-tab-like-zsh/461079)
- [StackOverflow question #2](https://stackoverflow.com/questions/12044574/getting-complete-and-menu-complete-to-work-together)
- [Unix stackexchange question](https://unix.stackexchange.com/questions/166908/is-there-anyway-to-get-compreply-to-be-output-as-a-vertical-list-of-words-instea)
- [bash-completion package source](https://github.com/scop/bash-completion)

## Bash completion for applications

If you are a command line application author or someone distributing one via operating system packages, you essentially have
to craft Bash completion scripts and then make sure they are registered at the beginning of a user session. The latter is
usually achieved by placing the scripts in `/usr/share/bash-completion/completions/<command-name>` and then letting
the dynamic loading machinery to automatically load the completion script when the user types in `git <TAB>` or 
`git <TAB><TAB>`. Of course, crafting these scripts can be non-trivial, and hence various command line frameworks
support generating these scripts. Since these command line frameworks are aware of the various options, sub-commands
and the flags of your application, it only makes sense to have this functionality. They also allow you to augment the
generated completions with additional data as per your application's requirements. 

See this [hacker news thread](https://news.ycombinator.com/item?id=19950563) for pointers to a number of efforts that
have been undertaken by people provide alternatives to manually writing bash completion scripts. 
In the thread, one of the comments is a link to [Shellac Protocol Proposal](https://github.com/oilshell/oil/wiki/Shellac-Protocol-Proposal)
which makes a proposal for how we could take a different approach to auto-completion for Linux commands. The idea is to aim for
a shell aganostic approach to auto-completion that different compatible clients can take advatange of.

Next, we will see how certain projects are tackling this issue of Bash completion.

### Cobra (Golang)

### Click (Python)

### Clap (Rust)

### complete (Golang)

### dargs (Golang)

### shell_completion (Rust)

Couple of other projects which I found interesting from the same thread are [complete](https://github.com/posener/complete)
and the [shell_completion](https://github.com/JoshMcguigan/shell_completion) project. Another interesting project which
I came across was [dargs](https://github.com/aelsabbahy/dargs) which is in a similar spirit as the `complete` project.