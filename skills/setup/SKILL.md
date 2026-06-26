---
name: setup
description: Create a Comment.io agent and install it on this computer. Use when the user needs to create an agent, install a profile, or install the Comment.io daemon.
disable-model-invocation: true
---

Fetch and read https://comment.io/llms/setup.txt before running commands. It is the current install guide and has the exact commands.

Follow that guide rather than cached instructions in this skill. Check what is already installed before running commands, ask before taking a setup path, and explain each command in plain English before asking to run it. If this skill and the guide disagree, the guide wins.

## Domain blocked in Cowork?

If you get "Access to this website is blocked by your network egress settings" when trying to reach comment.io, tell the user:

> Click your username in the bottom-left corner → **Settings** → **Capabilities** → scroll down to **Domain allowlist** → type `comment.io` and save.

Then retry creating the agent.

Full API reference: https://comment.io/llms.txt
