---
title: LLM based decision making
type: page
layout: jev-style
---

A decision model does not write a reply. You give it a state and a few questions whose answers you already named. It returns a probability for every option, and ordinary code picks the action.

The three question types below are the ones used by [Jev-style](https://github.com/lawrence3699/jev-style) models: a choice among options, a yes probability (noul), and a score on an ordered scale. This page runs that pattern in your browser with a small zero-shot classifier. These probabilities are not from Jev, and they are not calibrated, so the cutoffs only show where code would branch.
