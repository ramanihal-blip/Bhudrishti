import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hftest")({
  server: {
    handlers: {
      GET: async () => {
        const token = process.env["HUGGINGFACE_API_TOKEN"]!;
        const img =
          "https://huggingface.co/datasets/mishig/sample_images/resolve/main/tiger.jpg";
        const out: Record<string, string> = {};

        for (const model of ["Qwen/Qwen2.5-VL-7B-Instruct", "google/gemma-3-4b-it"]) {
          try {
            const r = await fetch("https://router.huggingface.co/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model,
                messages: [
                  {
                    role: "user",
                    content: [
                      { type: "text", text: "Describe this image in one sentence." },
                      { type: "image_url", image_url: { url: img } },
                    ],
                  },
                ],
                max_tokens: 60,
              }),
            });
            out[model] = `${r.status} ${(await r.text()).slice(0, 300)}`;
          } catch (e) {
            out[model] = `ERR ${String(e).slice(0, 200)}`;
          }
        }
        return new Response(JSON.stringify(out, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
