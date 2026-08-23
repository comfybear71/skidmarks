---
name: comfy-mcp
description: Use Comfy Cloud MCP and Comfy docs MCP. Read this before searching templates, submitting workflows, or generating on Comfy Cloud.
---

# Comfy MCP (Skidmarks arsenal)

Official product: [comfy.org/mcp](https://comfy.org/mcp). Docs: [docs.comfy.org/agent-tools/mcp](https://docs.comfy.org/agent-tools/mcp).

## Servers

| Name | URL | Auth |
|---|---|---|
| `comfy-cloud` | `https://cloud.comfy.org/mcp` | `X-API-Key` = `COMFY_CLOUD_API_KEY` |
| `comfy-docs` | `https://docs.comfy.org/mcp` | none (public docs search) |

Cursor cannot OAuth this host. Key is created at [platform.comfy.org/profile/api-keys](https://platform.comfy.org/profile/api-keys) (`comfyui-…`). Same key the desk already uses. Cloud MCP also needs a **Comfy Cloud subscription** — a credit top-up alone is not enough.

**Host lock:** ComfyUI Cloud only. Do not add local `comfy-mcp` / PC / RunPod.

## When to use which

- **How does a node / LTX / template work?** `comfy-docs` → `search_comfy_ui` then `query_docs_filesystem_comfy_ui`.
- **Find a workflow / model / node, then run it:** `comfy-cloud` discovery tools, then generate **only if Stuie said go**.
- **`/m` speech LTX** stays `workflow/LTX_2.3_IA2V_Cloud.json` + `src/lib/ltxCloudIa2v.ts`. Do not swap speech off that path via MCP.

## Cloud tools (listed live 2026-08-23, `comfyui-cloud` 0.40.1 — 41 tools)

Discovery: `search_templates`, `get_template`, `get_template_schema`, `search_models`, `search_nodes`, `get_node`, `cql`, `get_catalog_overview`, `get_prompting_guide`, `get_creative_technique`.

Generate: `run_template` (prefer a matching template), `submit_workflow` (API-format JSON), `partner_generate`, `upload_file`, `apply_slots`, `get_workflow_upload_url`.

Jobs: `get_job_status`, `wait_for_job`, `get_output`, `use_previous_output`, `cancel_job`, `get_queue`, `submit_batch`, `get_batch_status`, `get_batch_output`, `wait_for_batch`.

Saved / share / apps: `list_saved_workflows`, `get_saved_workflow`, `save_workflow`, `run_saved_workflow`, `share_workflow`, `import_shared_workflow`, `create_app`, `get_app_mode_url`, `get_workflow_canvas_url`.

Account: `estimate_credits`, `get_usage_report`, `get_billing_activity`, `get_server_info`. Ask before `report_session_summary`.

Typical flow: discover → `run_template` or `submit_workflow` → `wait_for_job` → `get_output`.

## Skidmarks locks

- Do not generate, batch, or spend Cloud credits until he says go.
- Do not wipe packs. Do not stitch. Do not mint a new `/m` job.
- IP-Adapter / refs = **single cast card**, not `plate_{slug}` turnaround sheets.
- Beauty / ID stills **768×512 or 512×768**. ID maps RGB, no alpha.
- Dump 13 `/workspace/ComfyUI` trees are self-hosted. Do not build them here.
- Prefer templates over inventing a graph. Export **Save (API Format)** if we submit our own JSON.
- Check `estimate_credits` / `get_billing_activity` before a batch.

Full note: `docs/COMFY_MCP.md`. Hub catalog: `docs/COMFY_WORKFLOWS.md`. Speech template id: `video_ltx2_3_ia2v`.
