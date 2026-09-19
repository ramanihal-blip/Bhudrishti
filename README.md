# Earth Insight AI

Build a functional, professional prototype web application called:

BHUDRISHTI — SATQUERY AI

Tagline: “Ask the Earth. Get the Insight.”

IMPORTANT:

This is a working prototype for a Smart India Hackathon project, NOT a landing page, presentation, or static UI mockup.

Prioritize a polished, functional demo that can be completed quickly. Do NOT spend time implementing model training or real fine-tuning. Build the architecture so real open-source Hugging Face/remote-sensing models can be connected later.

TECH STACK:

- React + JavaScript + HTML/CSS frontend

- FastAPI/Python backend architecture

- Do not connect the frontend directly to AI models

- Architecture must be:

  React → FastAPI → SatQuery Agent → Specialist Model Registry → Analysis → Evidence → Answer

==================================================

CORE CONCEPT

SatQuery AI is an agentic remote-sensing assistant.

User provides:

1. Natural-language text query OR voice query

2. One or two satellite/remote-sensing images

The system determines the appropriate workflow and specialist.

Show this architecture clearly in the UI:

QUERY

↓

SATQUERY AGENT

↓

SATELLITE DATA DOCTOR

↓

TASK + MODALITY DETECTION

↓

SPECIALIST MODEL SELECTION

↓

REMOTE-SENSING ANALYSIS

↓

EVIDENCE

↓

ANSWER + CONFIDENCE

↓

OPTIONAL VERIFICATION

Do NOT make this look like a generic chatbot.

==================================================

MAIN UI

Create a modern scientific/geospatial dashboard.

Header:

BHUDRISHTI

SATQUERY AI

“Ask the Earth. Get the Insight.”

Main workspace should contain:

LEFT/INPUT AREA:

- Text query input

- Microphone button for voice input

- Upload Image 1

- Upload Image 2

- Drag-and-drop support

- Show uploaded filename, dimensions and format

- Response length selector:

  - 100–200 words

  - 200–300 words

- Example query cards

- ANALYZE button

RIGHT/RESULT AREA:

- Agent status

- Final answer

- Evidence

- Confidence/uncertainty

- Verification

- Execution trace

Use attractive cards, icons, progress states, tabs and clear scientific visualization.

==================================================

EXAMPLE QUERIES

Provide clickable example queries:

“Describe the land-cover and major objects visible in this image.”

“Is there a water body in this image?”

“Highlight the water body referred to in the query.”

“What changed between these two dates, and where did the change occur?”

“Use the optical and SAR images together to identify built-up and water-covered regions.”

“Has the built-up area increased, decreased, or remained unchanged?”

Clicking an example should populate the query box.

==================================================

SATELLITE DATA DOCTOR

Before analysis, run a visible validation stage.

Check:

- number of images

- file format

- dimensions

- modality

- metadata when available

- georeferencing when available

- whether two images are compatible

- whether the pair appears bi-temporal or optical-SAR

Supported main formats:

- GeoTIFF

- TIFF

- PNG/JPEG for prototype/demo images

Show:

✓ READY FOR ANALYSIS

or

⚠ INPUT ISSUE DETECTED

Never silently pretend incompatible images are valid.

For prototype/demo files where complete satellite metadata is unavailable, clearly label the validation as “Prototype validation” instead of fabricating metadata.

==================================================

SATQUERY AGENT

Implement a deterministic prototype SatQuery Agent.

It should inspect:

- query text

- number of images

- image type/modality when available

Then select one or more specialists.

Create a visible Model Registry with five replaceable specialist modules:

1. CAPTIONING SPECIALIST

   Input: one image

   Task: scene/land-cover description

2. VQA SPECIALIST

   Input: one image + question

   Task: remote-sensing visual question answering

3. GROUNDING SPECIALIST

   Input: image + query

   Task: identify/highlight a requested region

4. CHANGE ANALYSIS SPECIALIST

   Input: two corresponding images

   Task: detect and describe changes

5. OPTICAL-SAR SPECIALIST

   Input: optical/multispectral + SAR pair

   Task: joint cross-modal interpretation

These must be separate modules/adapters, NOT one generic model.

For the prototype, use deterministic/demo analysis adapters where real models are unavailable. Make the interfaces ready for future Hugging Face/open-source models.

Never fabricate real model confidence or satellite statistics.

==================================================

AUTOMATIC ROUTING

Implement routing such as:

“Describe this image”

→ Captioning Specialist

“Is there a water body?”

→ VQA Specialist

“Highlight the water body”

→ Grounding Specialist

“What changed between these images?”

→ Change Analysis Specialist

“Use optical and SAR together...”

→ Optical-SAR Specialist

Show the selected specialist in the execution trace.

==================================================

PROCESSING UI

When ANALYZE is clicked, show an animated but truthful workflow:

Understanding query...

✓

Validating imagery...

✓

Determining image configuration...

✓

Selecting specialist...

✓

Running analysis...

✓

Generating evidence...

✓

Preparing answer...

✓

Do not expose hidden chain-of-thought.

==================================================

RESULT

Display:

FINAL ANSWER

Then:

Confidence / Evidence Status:

- High confidence

- Moderate confidence

- Low confidence

- Insufficient evidence

Only use confidence states supported by the prototype analysis. Do not invent numerical confidence values.

Show:

- selected task

- specialist used

- input configuration

- relevant result information

==================================================

EVIDENCE MODE

After the answer display:

“Would you like to see the evidence?”

[SHOW EVIDENCE]

When selected, display an attractive evidence workspace containing, where applicable:

- original image

- processed image

- highlighted region

- bounding box

- before/after images

- change visualization

- coordinates if available

- statistics only when actually calculated

- selected specialist

- execution stages

Add a section:

“WHY DID SATQUERY SAY THIS?”

Example workflow:

Input validated

↓

Query classified

↓

Specialist selected

↓

Image processed

↓

Evidence extracted

↓

Answer generated

This is an observable workflow summary, NOT hidden reasoning.

==================================================

ASK THE EVIDENCE

Add a follow-up input:

“Ask about this evidence…”

Examples:

“Where exactly?”

“How much area changed?”

“Show that region.”

The prototype should route these questions to the appropriate specialist/analysis adapter and update the evidence/result panel.

==================================================

CHALLENGE MY ANSWER

Add a button:

CHALLENGE MY ANSWER

When clicked, run an independent prototype consistency check using another compatible specialist/analysis adapter.

Display either:

✓ CONSISTENT FINDINGS

or

⚠ ANALYSIS DISAGREEMENT DETECTED

If disagreement occurs, clearly show:

Primary analysis:

...

Verification analysis:

...

Status:

Requires caution / conflicting evidence

Do not claim verification proves absolute correctness.

==================================================

BI-TEMPORAL DEMO

When two compatible images are supplied and the query is about change:

Show:

BEFORE

AFTER

CHANGE EVIDENCE

Provide a simple visual change overlay/highlight where technically possible.

Show:

- detected change description

- affected region

- statistics only if calculated from the images

- confidence/evidence status

==================================================

OPTICAL + SAR DEMO

When two images are supplied and the workflow is identified as optical + SAR:

Show:

OPTICAL IMAGE

SAR IMAGE

COMBINED ANALYSIS

Explain that optical provides spectral/contextual information while SAR provides complementary structural information.

Display a prototype integrated interpretation.

==================================================

MODEL REGISTRY PANEL

Create a small “Specialist Model Registry” panel showing:

Captioning Specialist

VQA Specialist

Grounding Specialist

Change Analysis Specialist

Optical-SAR Specialist

For each show:

- task

- input

- output

- status: Prototype Adapter / Ready for Model Integration

Make it obvious that these are independently replaceable modules.

==================================================

TECHNOLOGY / FUTURE MODEL INTEGRATION

Include a small technical architecture section showing:

React

↓

FastAPI

↓

SatQuery Agent

↓

Model Registry

↓

Specialist Models

↓

Raster/Geospatial Processing

↓

Evidence + Verification

Mention future integration points for:

PyTorch

Hugging Face Transformers

Whisper

Rasterio

GDAL

GeoPandas

OpenCV

Leaflet

Do not claim these real models are already running unless they actually are.

==================================================

DOWNLOAD REPORT

Add:

DOWNLOAD ANALYSIS REPORT

Generate a simple downloadable report containing:

- query

- input images

- selected task

- specialist used

- execution summary

- final answer

- confidence/evidence status

- verification result

- evidence information

==================================================

IMPORTANT PROTOTYPE RULES

1. Prioritize a working end-to-end demo over implementing advanced production infrastructure.

2. Do NOT implement model training/fine-tuning.

3. Do NOT require OpenAI, Gemini, Claude, AWS, Azure, Mapbox or paid APIs.

4. Keep specialist models modular so real open-source/Hugging Face models can later replace the prototype adapters.

5. Do not fabricate satellite metadata, statistics, coordinates, confidence scores or model outputs.

6. If real analysis cannot be performed on an uploaded file, clearly label the result as a prototype/demo analysis rather than pretending it is scientifically verified.

7. Use local/open-source architecture wherever practical.

8. Make the UI visually impressive enough for an SIH evaluator demonstration.

9. Avoid a generic chatbot appearance. Make it look like a professional remote-sensing analysis workstation.

10. Make every major button functional. Avoid decorative buttons that do nothing.

11. Keep the implementation compact and reliable. Do not over-engineer.

12. Build the complete prototype in this project rather than stopping at a landing page.

FINAL PRIORITY:

A polished end-to-end demonstration is more important than production-scale infrastructure.

The evaluator should be able to:

Upload image(s)

→ enter/speak a query

→ see Data Doctor validation

→ see SatQuery Agent select a specialist

→ see processing

→ receive an answer

→ open evidence

→ inspect execution trace

→ challenge the answer

→ ask a follow-up evidence question

→ download a report.

Build this now.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/41d01ddf-6b03-4a91-98c9-859a5d14fbc6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
