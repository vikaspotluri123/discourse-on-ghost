---
layout: default
title: Checker
parent: Configuration
---

# DoG Configuration Checker

Getting multiple pieces of software to play well together can be frustrating. The DoG Configuration Checker can report potential setup issues for you to review.

In your installation directory, run:

```bash
node node_modules/@potluri/discourse-on-ghost/build/targets/check.js
```

## Checks

Here are the checks that are currently run:

{% include auto-checker.md %}
