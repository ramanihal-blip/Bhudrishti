/**
 * API layer.  React never talks to a model directly:
 *   React -> server function (API layer) -> SatQuery Agent -> Model Registry -> Specialist adapter
 * The Hugging Face adapter is loaded inside the handlers so the API token and
 * the model-calling code stay server-side only.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  analyze,
  askEvidence,
  challenge,
  routeQuery,
  type AnalysisRequest,
  type AnalysisResult,
} from "./satquery/agent";

async function callModel(req: AnalysisRequest, query: string) {
  const { runHuggingFace } = await import("./satquery/hf.server");
  const routed = req.forceSpecialist
    ? { specialistId: req.forceSpecialist }
    : routeQuery(query, req.images);
  return runHuggingFace(routed.specialistId, query, req.imageData?.[0] ?? null, req.lengthPreference);
}

export const analyzeQuery = createServerFn({ method: "POST" })
  .inputValidator((data: AnalysisRequest) => data)
  .handler(async ({ data }) => analyze(data, await callModel(data, data.query)));

export const challengeAnswer = createServerFn({ method: "POST" })
  .inputValidator((data: { request: AnalysisRequest; primary: AnalysisResult }) => data)
  .handler(async ({ data }) => challenge(data.request, data.primary));

export const askAboutEvidence = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { question: string; request: AnalysisRequest; primary: AnalysisResult }) => data,
  )
  .handler(async ({ data }) =>
    askEvidence(
      data.question,
      data.request,
      data.primary,
      await callModel(data.request, data.question),
    ),
  );
