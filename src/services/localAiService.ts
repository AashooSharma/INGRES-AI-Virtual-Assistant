import { GroundwaterDataService, BlockData } from "./groundwaterDataService";
import { ChartData } from "../components/charts/echarts/ChartRenderer";

export interface AIResult {
  text: string;
  chart?: ChartData | null;
  source: "ollama" | "offline-rag";
  modelUsed?: string;
}

export class LocalAiService {
  private static OLLAMA_BASE_URL = "http://127.0.0.1:11434";
  private static PREFERRED_MODELS = ["qwen3:4b", "gemma3:4b", "gemma4:e2b", "moondream:latest", "llama3.2"];

  /**
   * Check if local Ollama server is running and get available models
   */
  public static async getAvailableOllamaModels(): Promise<string[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const res = await fetch(`${this.OLLAMA_BASE_URL}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map((m: { name: string }) => m.name);
    } catch {
      return [];
    }
  }

  /**
   * Select best available local model from user's installed models
   */
  public static selectBestModel(availableModels: string[]): string {
    for (const pref of this.PREFERRED_MODELS) {
      const match = availableModels.find(
        (m) => m === pref || m.startsWith(pref.split(":")[0])
      );
      if (match) return match;
    }
    return availableModels[0] || "qwen3:4b";
  }

  /**
   * Send prompt to local Ollama
   */
  public static async queryOllama(
    prompt: string,
    modelName: string
  ): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const res = await fetch(`${this.OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: 1024,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) return null;
      const json = await res.json();
      return json.response || null;
    } catch (e) {
      console.warn("[LocalAiService] Ollama query failed, falling back to offline RAG:", e);
      return null;
    }
  }

  /**
   * Generate high-quality deterministic response + charts completely offline
   */
  public static generateOfflineRAGResponse(
    query: string,
    year: string = "2024-2025"
  ): AIResult {
    const q = query.toLowerCase().trim();

    // 1. Analytical query (Top / Worst / Safe rankings)
    const isRanking = q.includes("top") || q.includes("worst") || q.includes("highest") || q.includes("lowest") || q.includes("safe");
    if (isRanking) {
      const analyticsText = GroundwaterDataService.getAnalyticsContext(query, year);
      const isSafe = q.includes("safe") || q.includes("lowest");

      // Extract blocks for chart
      const matches = GroundwaterDataService.searchLocation(query, year);
      const chartBlocks = matches.slice(0, 5);

      let chart: ChartData | null = null;
      if (chartBlocks.length > 0) {
        chart = {
          type: "bar",
          title: isSafe ? "Lowest Extraction Units (Safe)" : "Highest Groundwater Extraction Units",
          subtitle: `Stage of Extraction (%) - CGWB ${year}`,
          xAxis: {
            data: chartBlocks.map((b) => b.name),
            name: "Assessment Unit",
          },
          series: [
            {
              name: "Stage (%)",
              data: chartBlocks.map((b) => Number(b.stage.toFixed(1))),
            },
          ],
        };
      }

      return {
        text: `### 📊 Groundwater Resource Assessment Ranking (${year})\n\n${analyticsText}\n\n` +
          `**Key Insights:**\n` +
          `- Units with Stage > 100% are categorized as **Over-Exploited**, requiring immediate recharge interventions and pumping limits.\n` +
          `- Units with Stage < 70% are **Safe** with sustainable extraction levels.\n` +
          `- Source: Central Ground Water Board (CGWB) & INGRES Portal.`,
        chart,
        source: "offline-rag",
      };
    }

    // 2. Location-specific query
    const matches = GroundwaterDataService.searchLocation(query, year);
    if (matches && matches.length > 0) {
      const primary = matches[0];
      const netBalance = primary.extractable_ham - primary.extraction_ham;
      const isDeficit = netBalance < 0;

      let statusEmoji = "🟢";
      let statusDesc = "Safe (Sustainable extraction below 70%)";
      if (primary.stage > 100 || primary.category.includes("over")) {
        statusEmoji = "🔴";
        statusDesc = "Over-Exploited (Extraction exceeds annual natural recharge)";
      } else if (primary.stage >= 90 || primary.category.includes("critical")) {
        statusEmoji = "🟠";
        statusDesc = "Critical (Extraction between 90% and 100%)";
      } else if (primary.stage >= 70) {
        statusEmoji = "🟡";
        statusDesc = "Semi-Critical (Extraction between 70% and 90%)";
      }

      const reportText = `### ${statusEmoji} Official CGWB Assessment: **${primary.name}** (${year})

**Administrative Unit:** ${primary.name}${primary.district ? ` | District: **${primary.district}**` : ""}${primary.state ? ` | State: **${primary.state}**` : ""}

| Parameter | Official Value | Status / Unit |
| :--- | :--- | :--- |
| **Annual Extractable Resource** | \`${primary.extractable_ham.toLocaleString()} ham\` | Total available groundwater |
| **Current Annual Extraction** | \`${primary.extraction_ham.toLocaleString()} ham\` | Irrigation, Domestic & Industry |
| **Stage of Extraction** | \`${primary.stage.toFixed(2)}%\` | **${primary.category.toUpperCase()}** |
| **Net Annual Balance** | \`${Math.abs(netBalance).toLocaleString()} ham\` | ${isDeficit ? "⚠️ Net Deficit (Stress)" : "✅ Net Surplus"} |
| **Normal Annual Rainfall** | \`${primary.rainfall.toFixed(1)} mm\` | Meteorological Dept & CGWB |

#### 📋 Diagnostic & Recommendations:
- **Assessment Status**: ${statusDesc}
- ${isDeficit ? "**Recommended Action**: Mandate artificial recharge structures (check dams, injection wells) and promote micro-irrigation (Drip/Sprinkler) to reverse depletion." : "**Recommended Action**: Maintain current sustainable withdrawal rates and monitor observation wells post-monsoon."}
- *Data Source: Ministry of Jal Shakti, Central Ground Water Board (INGRES Portal).*`;

      // Interactive Chart
      const chart: ChartData = {
        type: "bar",
        title: `Groundwater Balance: ${primary.name}`,
        subtitle: `Extractable vs Extraction (${year}) in Hectare-Meters (ham)`,
        xAxis: {
          data: ["Extractable Resource", "Total Extraction"],
          name: "Metric",
        },
        series: [
          {
            name: "Water Volume (ham)",
            data: [
              Number(primary.extractable_ham.toFixed(1)),
              Number(primary.extraction_ham.toFixed(1)),
            ],
          },
        ],
      };

      return {
        text: reportText,
        chart,
        source: "offline-rag",
      };
    }

    // 3. Fallback General Information
    return {
      text: `### 🌊 GroundSense Virtual Assistant (INGRES - CGWB)

I can provide verified groundwater assessment data for **37 States/UTs, 735 Districts, and over 7,000 Blocks across India** from the official Central Ground Water Board (CGWB) records.

**Try asking queries like:**
- *"What is the groundwater status of Varanasi?"*
- *"Show groundwater data for Jaipur"*
- *"Top over-exploited blocks in Punjab"*
- *"Groundwater assessment of Pune"*
- *"Show rainfall and extraction in Amritsar"*`,
      chart: null,
      source: "offline-rag",
    };
  }

  /**
   * Main entrypoint: Queries Local Ollama if available, otherwise generates Smart Offline RAG
   */
  public static async processQuery(
    query: string,
    year: string = "2024-2025"
  ): Promise<AIResult> {
    // 1. Check if Ollama is available
    const availableModels = await this.getAvailableOllamaModels();

    if (availableModels.length > 0) {
      const selectedModel = this.selectBestModel(availableModels);
      console.log(`[LocalAiService] Using local Ollama model: ${selectedModel}`);

      // Get verified ground truth data context
      let groundTruth = GroundwaterDataService.getAnalyticsContext(query, year);
      if (!groundTruth) {
        groundTruth = GroundwaterDataService.getContextForPrompt(query, year);
      }

      const prompt = `You are GroundSense, the official AI Virtual Assistant for INGRES (India Ground Water Resource Estimation System), Ministry of Jal Shakti, Government of India.
Answer the user's question accurately using ONLY this verified ground truth assessment data:

${groundTruth || "No specific block match found in index. Provide general CGWB guidance."}

User Question: "${query}"

Guidelines:
1. State the exact figures (Extractable Resource in ham, Total Extraction in ham, Stage of Extraction in %, Category, and Rainfall in mm).
2. Clearly mention the official category (Safe, Semi-Critical, Critical, or Over-Exploited).
3. Offer constructive water conservation recommendations.
4. Format in clean Markdown tables and bullet points.`;

      const ollamaResponse = await this.queryOllama(prompt, selectedModel);

      if (ollamaResponse) {
        // Also provide chart if a location was matched
        const offlineResult = this.generateOfflineRAGResponse(query, year);
        return {
          text: ollamaResponse,
          chart: offlineResult.chart,
          source: "ollama",
          modelUsed: selectedModel,
        };
      }
    }

    // If Ollama is not active, use Smart Offline RAG
    return this.generateOfflineRAGResponse(query, year);
  }
}
