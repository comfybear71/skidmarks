# Comfy MCP — arsenal

Logged **2026-08-23** from [comfy.org/mcp](https://comfy.org/mcp) and [docs.comfy.org/agent-tools/mcp](https://docs.comfy.org/agent-tools/mcp). Public beta — names may move.

This is how agents drive **ComfyUI Cloud**. It is not a second LTX launcher on this Next.js VM.

## Connect

Project file: `.cursor/mcp.json`

| Server | URL | Auth |
|---|---|---|
| `comfy-cloud` | `https://cloud.comfy.org/mcp` | `X-API-Key: $COMFY_CLOUD_API_KEY` |
| `comfy-docs` | `https://docs.comfy.org/mcp` | none |

Cursor does **not** speak MCP OAuth today. Use a key from [platform.comfy.org/profile/api-keys](https://platform.comfy.org/profile/api-keys) (`comfyui-…`). Same value as desk Animate (`COMFY_CLOUD_API_KEY` in `.env.example`). Official Comfy docs also mention `COMFY_API_KEY` — we keep one name.

**Subscription (2026-08-23):** he said he is **fully subscribed**, not credits-only. Do not treat the Comfy plan as a blocker. Still ask before a generate — GPU time is real money.

Read-only check the same day: `get_server_info` = authenticated API key on `https://cloud.comfy.org`. `get_billing_activity` shows Cloud GPU jobs already running (`cloud_workflow_executed`, `rtx_pro_6000`). The API did not return a plan name string.

**Host lock:** ComfyUI Cloud only. No local `comfy-mcp` binary. No PC / RunPod / `/workspace/ComfyUI` tree.

Desk already queues LTX at `https://cloud.comfy.org` via `src/lib/comfyCloudClient.ts`. MCP is the **agent** side of that same host (templates, nodes, graphs, batches). `/m` speech stays `workflow/LTX_2.3_IA2V_Cloud.json`.

## What the agent can do

1. Discover — `search_templates`, `search_models`, `search_nodes`, `cql`.
2. Run — prefer `run_template`. Custom graph = API-format JSON + `submit_workflow` (+ `upload_file` for a still).
3. Wait — `wait_for_job` then `get_output`.
4. Batch — `submit_batch` / `wait_for_batch` when he asks for a loop.
5. Save / share — `save_workflow`, `share_workflow`, `create_app` (shareable URL, only exposed inputs).

Partner models on the same toolset: Flux, Seedance, Kling, MiniMax, ElevenLabs, HY3D, and others via `partner_generate`. Credits are real money. Do not fire these unless he says go.

Live `tools/list` on 2026-08-23 (`comfyui-cloud` **0.40.1**) returned **41** tools, including extras the marketing page does not name: `estimate_credits`, `get_creative_technique`, `get_catalog_overview`, `get_workflow_upload_url`, `get_usage_report`, `get_billing_activity`. Docs MCP returned `search_comfy_ui`, `query_docs_filesystem_comfy_ui`, `submit_feedback`.

## Docs MCP (`comfy-docs`)

Read-only. `search_comfy_ui` then `query_docs_filesystem_comfy_ui` (`head` / `cat` / `rg` on `.mdx` paths). Prefer this over guessing Comfy node names.

## Do not

- Hardcode keys in git.
- Install local Comfy on this VM.
- Swap `/m` lip-sync off Cloud LTX-2.3 IA2V.
- Feed `plate_{slug}` turnaround sheets into IP-Adapter.
- Run dump 15 `comfyRunner.js` (`127.0.0.1:8188` + disk symlinks).
- Generate onto a live pack until he names the test.

Hub catalog (616+ templates, researched 2026-08-23): `docs/COMFY_WORKFLOWS.md`. Speech id on Cloud is `video_ltx2_3_ia2v`.
