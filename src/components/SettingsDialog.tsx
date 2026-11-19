import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Key,
  Cpu,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsSaved?: () => void;
}

export const AVAILABLE_MODELS = [
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash (Recommended)",
    badge: "Fastest & Latest",
    desc: "Best performance, fast response, low latency for groundwater analytics.",
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    badge: "High Free Quota",
    desc: "Very stable, generous free limits in Google AI Studio.",
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    badge: "Deep Reasoning",
    desc: "For complex multi-factor hydrological policy & long trend reasoning.",
  },
  {
    id: "local-ollama",
    name: "Local Ollama (qwen3:4b / gemma3:4b)",
    badge: "Local / Free",
    desc: "Runs completely locally on your machine via localhost:11434 with zero API key.",
  },
];

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onOpenChange,
  onSettingsSaved,
}) => {
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    if (open) {
      const storedKey =
        localStorage.getItem("USER_GEMINI_API_KEY") ||
        import.meta.env.VITE_GEMINI_API_KEY ||
        "";
      const storedModel =
        localStorage.getItem("USER_GEMINI_MODEL") ||
        import.meta.env.VITE_GEMINI_MODEL ||
        "gemini-2.5-flash";
      setApiKey(storedKey);
      setSelectedModel(storedModel);
      setTestStatus("idle");
      setTestMessage("");
    }
  }, [open]);

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      setTestStatus("error");
      setTestMessage("Please enter an API Key first.");
      return;
    }

    setTestStatus("testing");
    setTestMessage("Verifying with Google AI Studio...");

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`
      );
      if (response.ok) {
        setTestStatus("success");
        setTestMessage("✅ API Key is valid and active!");
      } else {
        const errorData = await response.json();
        setTestStatus("error");
        setTestMessage(
          `❌ Failed: ${errorData.error?.message || "Invalid API key"}`
        );
      }
    } catch {
      setTestStatus("error");
      setTestMessage("Network error: Could not reach Google AI Studio.");
    }
  };

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem("USER_GEMINI_API_KEY", apiKey.trim());
    } else {
      localStorage.removeItem("USER_GEMINI_API_KEY");
    }
    localStorage.setItem("USER_GEMINI_MODEL", selectedModel);

    if (onSettingsSaved) {
      onSettingsSaved();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
                AI Assistant Settings
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Configure Google AI Studio API & select the optimal LLM for groundwater analytics.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* API Key Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-amber-500" />
                Google AI Studio API Key
              </Label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium hover:underline"
              >
                Get Free Key <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestStatus("idle");
                }}
                className="pr-20 text-sm font-mono border-slate-300 dark:border-slate-700 focus-visible:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="text-slate-500">
                Stored safely in your local browser (`localStorage`).
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestKey}
                disabled={testStatus === "testing" || !apiKey}
                className="h-7 text-xs"
              >
                {testStatus === "testing" ? "Testing..." : "Test Key"}
              </Button>
            </div>

            {testMessage && (
              <div
                className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-medium ${
                  testStatus === "success"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200"
                    : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200"
                }`}
              >
                {testStatus === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{testMessage}</span>
              </div>
            )}
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-blue-500" />
              Assistance LLM Model
            </Label>

            <div className="grid grid-cols-1 gap-2">
              {AVAILABLE_MODELS.map((model) => (
                <div
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    selectedModel === model.id
                      ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-500"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {model.name}
                    </span>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        selectedModel === model.id
                          ? "bg-blue-600 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {model.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {model.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t border-slate-100 dark:border-slate-800 flex sm:justify-between items-center gap-2">
          <p className="text-[11px] text-slate-400">
            Fallback: Built-in Offline Deterministic RAG is always active.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-4"
            >
              Save Settings
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
