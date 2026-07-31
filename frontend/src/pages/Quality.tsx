import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import {
  ShieldCheck,
  CheckSquare,
  Volume2,
  BookOpen,
  User,
  Calendar,
  TrendingUp,
  Sparkles,
  MessageSquare,
  Award,
  ChevronRight,
  Clock,
  Play,
  Pause
} from "lucide-react";

type CallLog = {
  id: string;
  lead_id: string;
  agent_id: string;
  pool_id: string;
  direction: string;
  status: string;
  outcome: string;
  duration_seconds: number;
  notes?: string;
  ai_summary?: string;
  transcript?: string;
  started_at: string;
  ended_at?: string;
  quality_evaluation?: {
    coaching_notes: string;
    ai_quality_score: number;
    compliance_score: number;
    sentiment: string;
    evaluated_by: string;
    evaluated_at: string;
  };
};

export default function Quality() {
  const { showToast } = useToast();
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [loading, setLoading] = useState(true);

  // Audio Playback simulation state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);

  // Form Evaluation state
  const [coachingNotes, setCoachingNotes] = useState("");
  const [aiQualityScore, setAiQualityScore] = useState(85);
  const [complianceScore, setComplianceScore] = useState(90);
  const [sentiment, setSentiment] = useState("positive");

  const loadData = useCallback(async () => {
    try {
      const data = await api.get("/api/calls?status_filter=completed");
      setCalls(data);
    } catch (err: any) {
      showToast(err.message || "Failed to load completed calls.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Audio simulation timer
  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        setPlayProgress(p => {
          if (p >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return p + 2;
        });
      }, 500);
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  const selectCallToAudit = (call: CallLog) => {
    setSelectedCall(call);
    setIsPlaying(false);
    setPlayProgress(0);
    
    // Pre-fill form if evaluation exists
    if (call.quality_evaluation) {
      setCoachingNotes(call.quality_evaluation.coaching_notes);
      setAiQualityScore(call.quality_evaluation.ai_quality_score);
      setComplianceScore(call.quality_evaluation.compliance_score);
      setSentiment(call.quality_evaluation.sentiment);
    } else {
      setCoachingNotes("");
      setAiQualityScore(80);
      setComplianceScore(85);
      setSentiment("neutral");
    }
  };

  async function handleSaveEvaluation(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCall) return;
    try {
      await api.post(`/api/calls/${selectedCall.id}/quality`, {
        coaching_notes: coachingNotes,
        ai_quality_score: Number(aiQualityScore),
        compliance_score: Number(complianceScore),
        sentiment
      });
      showToast("Quality audit evaluation successfully submitted.", "success");
      loadData();
      
      // Update selected call details
      setSelectedCall(prev => {
        if (!prev) return null;
        return {
          ...prev,
          quality_evaluation: {
            coaching_notes: coachingNotes,
            ai_quality_score: Number(aiQualityScore),
            compliance_score: Number(complianceScore),
            sentiment,
            evaluated_by: "Current User",
            evaluated_at: new Date().toISOString()
          }
        };
      });
    } catch (err: any) {
      showToast(err.message || "Evaluation submit failed.", "error");
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Sticky Header Panel */}
      <div className="sticky top-0 z-20 bg-[#f4f6fb] -mx-4 md:-mx-6 px-4 md:px-6 py-2 md:py-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-forgeBlue" />
              <span>Call Quality Auditing Console</span>
            </h1>
            <p className="text-sm text-gray-500 font-medium">Audit agent conversations, inspect speech transcripts, and rate guidelines compliance</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Completed Calls Log List */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-1 flex flex-col max-h-[700px]">
          <h2 className="text-base font-black text-gray-800 mb-4 flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-forgeBlue" />
            <span>Completed Shift Logs</span>
          </h2>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-forgeBlue border-t-transparent mb-3"></div>
              <p className="text-xs text-gray-400 font-bold">Loading call history...</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              {calls.map(c => (
                <div
                  key={c.id}
                  onClick={() => selectCallToAudit(c)}
                  className={`p-4 border rounded-2xl transition cursor-pointer text-left space-y-2 ${
                    selectedCall?.id === c.id
                      ? "border-forgeBlue bg-blue-50/30"
                      : "bg-gray-50/50 hover:bg-white"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-forgeBlue text-xs">{c.lead_id}</span>
                    <span className="text-[10px] text-gray-400 font-bold flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />
                      {Math.floor(c.duration_seconds / 60)}:{String(c.duration_seconds % 60).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-xs font-bold text-gray-700">Agent: {c.agent_id}</div>
                      <div className="text-[10px] text-gray-400 font-semibold">{new Date(c.started_at).toLocaleString()}</div>
                    </div>
                    {c.quality_evaluation ? (
                      <span className="bg-green-50 border border-green-200 text-green-700 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <Award className="h-3 w-3" />
                        <span>Audited ({c.quality_evaluation.ai_quality_score})</span>
                      </span>
                    ) : (
                      <span className="bg-slate-100 border text-slate-500 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {calls.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-12 font-medium">No completed calls logs found.</p>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Audio details and audit form */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCall ? (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
              
              {/* Call identity panel */}
              <div className="bg-slate-50 border p-4 rounded-2xl flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-extrabold text-gray-800 text-base">Conversation ID: {selectedCall.id.slice(-8).toUpperCase()}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 font-semibold">
                    <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> Agent: {selectedCall.agent_id}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Date: {new Date(selectedCall.started_at).toLocaleString()}</span>
                  </div>
                </div>
                
                {/* Audio mock player */}
                <div className="flex items-center gap-3 bg-white border px-4 py-2 rounded-xl shadow-xs self-start md:self-center">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-2 bg-forgeBlue text-white hover:bg-blue-800 rounded-full transition"
                    aria-label={isPlaying ? "Pause Recording" : "Play Recording"}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <div className="w-32 bg-gray-100 h-2 rounded-full overflow-hidden relative">
                    <div
                      className="bg-forgeBlue h-full rounded-full transition-all duration-300"
                      style={{ width: `${playProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 font-bold font-mono">
                    {isPlaying ? "PLAYING" : "RECORDING"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left side: transcript summary */}
                <div className="space-y-4">
                  {/* AI Summary */}
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm mb-1.5 flex items-center gap-1">
                      <Sparkles className="h-4 w-4 text-forgeBlue animate-pulse" />
                      <span>AI Conversation Summary</span>
                    </h4>
                    <div className="border rounded-2xl p-4 bg-gray-50/50 text-xs font-semibold text-gray-500 leading-relaxed max-h-36 overflow-y-auto">
                      {selectedCall.ai_summary || "AI Summary not generated for this voice channel log."}
                    </div>
                  </div>

                  {/* Transcript */}
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm mb-1.5 flex items-center gap-1">
                      <BookOpen className="h-4 w-4 text-forgeBlue" />
                      <span>Call Speech Transcript</span>
                    </h4>
                    <div className="border rounded-2xl p-4 bg-gray-50/50 text-xs font-semibold text-gray-500 leading-relaxed h-72 overflow-y-auto space-y-3 font-mono">
                      {selectedCall.transcript ? (
                        selectedCall.transcript.split("\n").map((line, idx) => (
                          <div key={idx} className="border-b border-gray-100 pb-1.5 last:border-b-0">
                            {line}
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-400 italic">No audio speech data recorded.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: Auditing evaluation form */}
                <form onSubmit={handleSaveEvaluation} className="space-y-4 border-l pl-0 md:pl-6 border-gray-100">
                  <h3 className="font-black text-gray-800 text-sm uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Award className="h-4.5 w-4.5 text-forgeGold" />
                    <span>Evaluation Scorecard</span>
                  </h3>
                  
                  {/* AI Quality slider */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-gray-600">AI Quality Score</label>
                      <span className="text-xs font-extrabold text-forgeBlue">{aiQualityScore} / 100</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={aiQualityScore}
                      onChange={e => setAiQualityScore(Number(e.target.value))}
                      className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-forgeBlue"
                    />
                  </div>

                  {/* Compliance slider */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-gray-600">Compliance & Guidelines Score</label>
                      <span className="text-xs font-extrabold text-forgeBlue">{complianceScore} / 100</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={complianceScore}
                      onChange={e => setComplianceScore(Number(e.target.value))}
                      className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-forgeBlue"
                    />
                  </div>

                  {/* Sentiment select */}
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Customer Sentiment Analysis</label>
                    <select
                      value={sentiment}
                      onChange={e => setSentiment(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 font-bold text-gray-700"
                    >
                      <option value="positive">Positive (Satisfied, cooperative)</option>
                      <option value="neutral">Neutral (General business exchange)</option>
                      <option value="negative">Negative (Frustrated, argumentative)</option>
                    </select>
                  </div>

                  {/* Coaching notes */}
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Supervisor Coaching Notes</label>
                    <textarea
                      placeholder="Add specific coaching guidelines, positive call highlights, or compliance correctives..."
                      value={coachingNotes}
                      onChange={e => setCoachingNotes(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 text-xs bg-gray-50 h-32 text-gray-700 focus:outline-none focus:ring-2 focus:ring-forgeBlue"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-forgeBlue hover:bg-blue-800 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>Submit Evaluation Audit</span>
                  </button>
                </form>

              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl py-24 text-center border border-gray-100 text-gray-400">
              <ChevronRight className="h-10 w-10 mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-semibold">Select a completed call from the left menu to audit recording parameters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
