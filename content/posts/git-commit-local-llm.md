---
title:  Local LLM notes
date: 2026-11-01
categories:
-  software
---

I am using `ollama` on Windows PC.

## Generate git commit message

Uses [qwen3-coder:30b](https://ollama.com/library/qwen3-coder:30b):

Powershell:

```
git commit -am (ollama run qwen3-coder:30b "create a single line commit message for $(git diff)").Trim()
```

What's interesting (perhaps not) is that when `git diff` is empty, it prints some boilerplate:

```
ollama run qwen3-coder:30b "create a single line commit message for $(git diff)"
"feat: add new feature to improve user experience"

PS C:\Users\amits\work\personal-gitea\therapy-counselling-profession> ollama run qwen3-coder:30b "create a single line commit message for $(git diff)"
"Add user authentication and authorization features"
```

Changing the prompt to this, helps:

```
ollama run qwen3-coder:30b "create a single line commit message for this git diff: $(git diff). If
no change is provided, print a message saying so"
```

Now, we see this when provided an empty git diff

```
I'd be happy to help you create a commit message, but I don't see any git diff provided in your request. Could you please share
the git diff you'd like me to analyze and create a single-line commit message for?

If you don't have a specific change to provide, I can show you what the message would look like in that case:

No changes provided - please supply a git diff to generate a commit message
```
