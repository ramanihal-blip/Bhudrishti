# 🛰️ BhuDrishti — SatQuery AI

### Ask the Earth. Get the Insight.

BhuDrishti — SatQuery AI is an **agentic, multimodal AI assistant for remote-sensing image analysis**. It allows users to interact with satellite imagery using **natural-language text or voice queries** instead of requiring them to understand complex remote-sensing workflows.

The system accepts single satellite images, bi-temporal image pairs, and co-registered optical-SAR image pairs. SatQuery AI understands the user's query, validates the uploaded imagery, identifies the required analysis task, selects the appropriate specialized AI model, performs the analysis, and returns an **evidence-grounded result**.

---

## 🌍 The Problem

Remote-sensing imagery is widely used for:

- Agriculture
- Disaster management
- Urban planning
- Forest monitoring
- Water-resource assessment
- Infrastructure mapping
- Environmental analysis

However, many remote-sensing AI systems are designed for **one predefined task**. Users may need to understand satellite sensors, image formats, GIS workflows, model selection, and task-specific parameters before obtaining useful information.

A simple question such as:

> "What changed between these two dates?"

may require multiple decisions involving image selection, sensor type, temporal comparison, processing methods, and interpretation.

The challenge is therefore not simply having satellite data or AI models.

**The challenge is connecting a simple human question to the correct remote-sensing analysis workflow.**

---

## 💡 Our Solution

SatQuery AI introduces an **agentic query-driven approach**.

Instead of forcing one general-purpose AI model to perform every remote-sensing task, SatQuery uses multiple **specialized remote-sensing AI models**.

The SatQuery Agent acts as the orchestrator.

### Core workflow

```text
User Query + Satellite Image(s)
              ↓
       Input Validation
              ↓
       Query Understanding
              ↓
       Agentic Model Selection
              ↓
     Specialist AI Analysis
              ↓
      Result Integration
              ↓
      Evidence Generation
              ↓
       Verified Insight
