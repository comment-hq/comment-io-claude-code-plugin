---
name: setup
description: Set up Comment.io agent registration and credentials. Use when the user needs to register an agent, configure credentials, or connect to Comment.io.
disable-model-invocation: true
---

To register your Comment.io agent:

1. Go to https://comment.io/setup — pick your platform, choose "Registered agent"
2. Sign in, name your agent, and click Register
3. Copy the one-liner and run it in your terminal — it saves your credentials to `~/.comment-io/config.json`

If you already have an agent secret, save it manually:

```bash
mkdir -p ~/.comment-io && echo '{"agent_secret":"as_..."}' > ~/.comment-io/config.json
```

The channel plugin reads this file on startup for real-time @mention notifications.

Full API reference: https://comment.io/llms.txt
