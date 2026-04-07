---
title:  DevOps Notes
date: 2021-04-07
categories:
- software
draft: true
---


Overall, the idea is that you run as many automated checks/processes as possible before the code is merged into your main/master repository and 
deployed to production so that you can:

 1. Prevent bad code from being merged - bringing down your systems post deployment
 2. Ensure code quality
 3. Ensure uniform code style
 4. Unit tests and integration tests are run before code is merged
 5. Code reviewers understand what they are reviewing
 6. Code mergers know how the change being merged can be reverted
 7. Secrets are not being committed accidentally to version control
The techniques have come to be referred to "shifting left" (imagine that left is the developer's laptop and the right is the production system): https://about.gitlab.com/topics/ci-cd/shift-left-devops/ 

Before the PR is created

 1. linting, code formatting and unit-test (if cheap) - generally, you will only run these processes here for the directories/code files that was changed
 2. Setup an appropriate .gitignore file so that secrets are not accidentally committed
 3. Commit message templates
 4. PR templates: What will this change do, how will this change be reverted, is there any DB operation that is also being rolled out? Will this change work with both the previous and future version of the data? How is this change going to be monitored? HTTP status? Logs?
 5. Have appropriate developer guides so that their system is setup correctly to ensure the git hooks are run

Please look for tools you can use to do this, but https://typicode.github.io/husky/ might be a good start for 1-3 and then for (4), github has their own guide.

After the PR is created

After a PR Is created, we will run the same checks we did for (1) above. In addition:
 1. We run more tests - perhaps integration tests
 2. We will run some code quality tools here - like codeql for example 
 3. We might also run some test coverage tools here to ensure that the new code continues to have code coverage - this is tricky, as higher code coverage isn't necessarily an indication for working code, but it's a start
 4. You enforce how many approvals the PR needs and who can approve
 
After the PR is merged

Let's say your organization uses only two branches - develop and main/master.

All code changes are first merged into develop which gets deployed to a development environment

Then the change is promoted to production by creating a PR for the master branch, which when merged gets deployed into production. 

You configure the deployment environment based on the branch in your CI workflow.

Either way, before the actual cut-over happens to the new code (new stack), you will run a bunch of checks - HTTP API checks that will directly be configured to hit the new stack, and only if the tests pass, is the traffic cut over.

Note that you could also have a single "master" branch and then simply promote the change from development to production.

You can implement manual reviews and checks using: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/review-deployments 


Ongoing management

 1. Secrets stored in the CI tool, and is retrieved at CI build time
 2. Any secrets that developers need access to are never committed - typically, via ensuring that `.env` files are in `.gitignore`. The secrets themselves are then only accessible by developers 
 3. Vulnerability scanning in dependencies
 4. Vulnerability scanning in built artifacts - e.g. docker images
 5. Generally consider static checks for your application code as well as any infrastructure code if possible in your CI. For eg. https://learnkube.com/validating-kubernetes-yaml  or https://github.com/CoverGenius/kubelint 


This is one book that really helped me understand devops/infrastructure in a very wholistic manner: https://www.amazon.com.au/Web-Operations-John-Allspaw/dp/1449377440 and some talks by the writer: https://www.youtube.com/results?search_query=web%20operations%20john%20allspaw 

At Atlassian i used to work on the development team for https://spinnaker.io/docs/concepts/ - which is a dedicated deployment platform, it is complex and you may not need it at this point, but it might help you learn a lot of new things, so happy to discuss it too.

