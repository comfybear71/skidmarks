# ComfyUI workflow templates

`MOVIES_ROOT` points at the PC's `MY MOVIES` tree, which does not exist on
Vercel — there it resolves into per-invocation `/tmp` and is always empty, so
the animate phase could never find a template. Templates committed here are
carried by the deploy and are checked after `MOVIES_ROOT`, so the PC keeps
using its own copies unchanged.

All three loaders share one lookup, `loadWorkflowTemplate()` in
`src/lib/workflowTemplates.ts` — pass a file name (and optional `subdir` /
`extraCandidates`) and it searches `MOVIES_ROOT`, any extra paths, then the
repo copy, in that order. Adding a new template to the arsenal is a call to
that helper, not a new candidate-path array.

Expected files:

| Path | Used by |
| --- | --- |
| `workflow/LTX_2.3_IA2V_Cloud.json` | `src/lib/ltxCloudIa2v.ts` — mobile animate |
| `workflow/LTX_Director_2_Workflow_Hotfix.json` | `src/lib/ltxSmoke.ts` |
| `workflow/lipsync/WF_lipsync_v1d.json` | `src/lib/lipsyncSmoke.ts` |

## Export the API format, not the UI format

The loaders read a node graph keyed by node id, where each node has
`class_type` and `inputs` — that is ComfyUI's **API** shape. In ComfyUI use
**Workflow → Export (API)**, not plain Export or Save; the UI format has a
`nodes` array instead and will not patch correctly.
