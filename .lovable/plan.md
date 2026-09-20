# Simplify the BHUDRISHTI user interface

## Changes
- Remove the visible agent pipeline, model registry, technical architecture, execution trace, model names, specialist names, routing details, and inference-provider references.
- Replace the detailed stage list with one clean analysis status using plain-language progress messages.
- Keep the answer and evidence views, but simplify labels and verification/follow-up copy so they describe results rather than internal implementation.
- Remove technical model details from the downloaded user report while retaining the actual answer, evidence, and verification result.
- Preserve the existing upload, voice input, analysis, evidence, challenge, follow-up, download, backend, routing, and AI behavior.

## Verification
- Scan all rendered interface copy for hidden implementation terminology.
- Check the upload-to-result flow in the preview at desktop and mobile widths.

## Technical details
- Limit changes to presentation components and route-level display/report formatting.
- Keep all existing server functions, AI calls, analysis data, and internal types unchanged.
