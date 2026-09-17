/**
 * API layer.  React never talks to a model directly:
 *   React -> server function (API layer) -> SatQuery Agent -> Model Registry -> Specialist adapter
 * These handlers are the drop-in equivalent of the FastAPI routes
 * (/analyze, /challenge, /ask-evidence) in the reference architecture.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  analyze,
  askEvidence,
  challenge,
  type AnalysisRequest,
  type AnalysisResult,
} from "./satquery/agent";

export const analyzeQuery = createServerFn({ method: "POST" })
  .inputValidator((data: AnalysisRequest) => data)
  .handler(async ({ data }) => analyze(data));

export const challengeAnswer = createServerFn({ method: "POST" })
  .inputValidator((data: { request: AnalysisRequest; primary: AnalysisResult }) => data)
  .handler(async ({ data }) => challenge(data.request, data.primary));

export const askAboutEvidence = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { question: string; request: AnalysisRequest; primary: AnalysisResult }) => data,
  )
  .handler(async ({ data }) => askEvidence(data.question, data.request, data.primary));
