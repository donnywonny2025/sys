# Pipeline Rules: The Immutable Trinity
**Me (Jeff) -> You (Antigravity) -> Hermes**

## The Law
1. **Never build a script if Hermes can do it.** I am the orchestrator, Hermes is the execution engine.
2. If Jeff wants to check weather, I don't write `check_weather.sh`. I curl the Hermes Gateway API (Port 8642) and say: "Hermes, check the weather and push it to Port 3111."
3. If Jeff wants to check mail, I don't run `check_mail.sh`. I tell Hermes to use its `apple-mail` skill to read the mail and push it to the dashboard.
4. **The Exception:** The ONLY time I write raw scripts outside of Hermes is if we are doing something fundamentally beyond Hermes's architectural capability (like setting up the React auto-saving whiteboard bridge we just built).
5. For all data retrieval, processing, and agentic tasks, the flow is strictly offloaded to Hermes via the REST API.

## The Hermes Request Pattern (CURL)
When a task needs to be done, I ping the Hermes HTTP server with instructions, and Hermes uses its own tools to accomplish it.

```bash
curl -s http://localhost:8642/v1/chat/completions \
  -H "Authorization: Bearer hermes-system-local-key" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "system", "content": "You are the execution engine. Retrieve the user\'s unread mail using your skills, format it as JSON, and curl it via POST to the dashboard at http://localhost:3111/api/push under the type \"email\"."},
      {"role": "user", "content": "Sync my mail to the dashboard now."}
    ]
  }'
```

This ensures we use Hermes's built-in reasoning, skills, and tools, rather than reinventing the wheel with localized bash scripts for every small task.
