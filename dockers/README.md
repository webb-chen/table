# Self-hosting with Docker

Two ways to run the project yourself — pick by what you need:

| | **Standalone (this directory)** | **Full-featured self-host** |
|---|---|---|
| Tables, collaboration, API, automation | ✅ | ✅ |
| AI features (chat, agents) | ❌ | ✅ |
| App Builder (build & deploy apps) | ❌ | ✅ |
| Sandboxes / previews | ❌ | ✅ |
| Footprint | one machine, app + PostgreSQL | one machine (Docker) or a Kubernetes cluster |
| Where | [`examples/standalone/`](examples/standalone/) | [webb-chen/table](https://github.com/webb-chen/table) |

Just want to try the project without deploying anything? Build the Docker image from this repository.

Already running standalone and want the AI features later? Your data stays in
place — the full-featured deployment attaches a runtime plane next to your
existing app. See the
[upgrade guide](https://github.com/webb-chen/table).
