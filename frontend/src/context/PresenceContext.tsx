import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import { api, getWsUrl } from "../api/client";

export interface AgentPresence {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  employee_id?: string;
  pool_id?: string;
  status: "ready" | "paused" | "in_call" | "offline";
  pause_reason?: string | null;
  login_at?: string | null;
  logout_at?: string | null;
  ready_seconds: number;
  paused_seconds: number;
  talk_seconds?: number;
  ringing_seconds?: number;
  setup_seconds?: number;
  dispose_seconds?: number;
  total_calls_handled?: number;
  last_status_change?: string | null;
  last_activity?: string | null;
  is_active?: boolean;
}

export interface PresenceSummary {
  total_agents: number;
  online_count: number;
  ready_count: number;
  paused_count: number;
  in_call_count: number;
  offline_count: number;
}

interface PresenceContextType {
  myStatus: "ready" | "paused" | "in_call" | "offline";
  pauseReason: string | null;
  myPresence: AgentPresence | null;
  agents: AgentPresence[];
  summary: PresenceSummary;
  wsConnected: boolean;
  setPresenceStatus: (newStatus: "ready" | "paused" | "in_call" | "offline", pauseReason?: string) => Promise<void>;
  refreshPresence: () => Promise<void>;
  updateCallTelemetry: (stats: { ringing_seconds?: number; setup_seconds?: number; talk_seconds?: number; dispose_seconds?: number; calls_handled?: number }) => void;
}

const defaultSummary: PresenceSummary = {
  total_agents: 0,
  online_count: 0,
  ready_count: 0,
  paused_count: 0,
  in_call_count: 0,
  offline_count: 0,
};

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export const PresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [myStatus, setMyStatus] = useState<"ready" | "paused" | "in_call" | "offline">("ready");
  const [pauseReason, setPauseReason] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentPresence[]>([]);
  const [summary, setSummary] = useState<PresenceSummary>(defaultSummary);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const myPresence = agents.find((a) => a.id === user?.id || a.user_id === user?.id) || null;

  const fetchPresenceData = useCallback(async () => {
    if (!user) return;
    try {
      const [agentList, summaryData] = await Promise.all([
        api.get("/api/presence/agents").catch(() => []),
        api.get("/api/presence/summary").catch(() => defaultSummary),
      ]);

      if (Array.isArray(agentList)) {
        setAgents(agentList);
        const me = agentList.find((a: AgentPresence) => a.id === user.id || a.user_id === user.id);
        if (me) {
          setMyStatus(me.status || "ready");
          setPauseReason(me.pause_reason || null);
        }
      }

      if (summaryData && typeof summaryData.ready_count === "number") {
        setSummary(summaryData);
      }
    } catch (err) {
      console.warn("[PRESENCE] Error loading presence data:", err);
    }
  }, [user]);

  // Live 1-second ticker for real-time telemetry updates
  useEffect(() => {
    if (!user) return;
    const ticker = setInterval(() => {
      setAgents((prev) =>
        prev.map((agent) => {
          if (agent.id === user.id || agent.user_id === user.id) {
            if (agent.status === "ready") {
              return { ...agent, ready_seconds: (agent.ready_seconds || 0) + 1 };
            } else if (agent.status === "paused") {
              return { ...agent, paused_seconds: (agent.paused_seconds || 0) + 1 };
            } else if (agent.status === "in_call") {
              return { ...agent, talk_seconds: (agent.talk_seconds || 0) + 1 };
            }
          }
          return agent;
        })
      );
    }, 1000);
    return () => clearInterval(ticker);
  }, [user]);

  // Handle incoming presence updates & activity logs from WebSocket stream
  const handleWsMessage = useCallback((event: MessageEvent) => {
    try {
      const payload = JSON.parse(event.data);

      if (payload.type === "lead_activity_updated" && payload.data) {
        window.dispatchEvent(new CustomEvent("lead_activity_updated", { detail: payload.data }));
      }

      if (payload.type === "call_completed" && payload.data) {
        const { user_id, agent_id, total_calls_handled, talk_seconds } = payload.data;
        const targetId = user_id || agent_id;
        setAgents((prevAgents) =>
          prevAgents.map((agent) => {
            if (agent.id === targetId || agent.user_id === targetId) {
              const currentCalls = agent.total_calls_handled || 0;
              const nextCalls = typeof total_calls_handled === "number" ? total_calls_handled : currentCalls + 1;
              return {
                ...agent,
                total_calls_handled: nextCalls,
                talk_seconds: typeof talk_seconds === "number" ? talk_seconds : (agent.talk_seconds || 0),
              };
            }
            return agent;
          })
        );
      }

      if (payload.type === "agent_presence_updated" && payload.data) {
        const updated = payload.data as AgentPresence;

        setAgents((prevAgents) => {
          const index = prevAgents.findIndex((a) => a.id === updated.id || a.user_id === updated.user_id);
          if (index !== -1) {
            const next = [...prevAgents];
            next[index] = { ...next[index], ...updated };
            return next;
          }
          return [...prevAgents, updated];
        });

        if (user && (updated.id === user.id || updated.user_id === user.id)) {
          setMyStatus(updated.status);
          setPauseReason(updated.pause_reason || null);
        }

        setAgents((currentAgents) => {
          const total = currentAgents.length;
          const ready = currentAgents.filter((a) => a.status === "ready").length;
          const paused = currentAgents.filter((a) => a.status === "paused").length;
          const inCall = currentAgents.filter((a) => a.status === "in_call").length;
          const offline = currentAgents.filter((a) => a.status === "offline").length;
          const online = ready + paused + inCall;

          setSummary({
            total_agents: total,
            online_count: online,
            ready_count: ready,
            paused_count: paused,
            in_call_count: inCall,
            offline_count: offline,
          });
          return currentAgents;
        });
      }
    } catch {
      // Ignore control messages
    }
  }, [user]);

  const connectWebSocket = useCallback(() => {
    if (!user) return;
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const wsUrl = getWsUrl("/global");
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 15000);
      };

      ws.onmessage = (evt) => handleWsMessage(evt);

      ws.onclose = () => {
        setWsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };

      ws.onerror = () => {
        setWsConnected(false);
        try { ws.close(); } catch {}
      };
    } catch (err) {
      setWsConnected(false);
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 5000);
    }
  }, [user, handleWsMessage]);

  useEffect(() => {
    if (user) {
      fetchPresenceData();
      connectWebSocket();
    }

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        try { socketRef.current.close(); } catch {}
      }
    };
  }, [user, fetchPresenceData, connectWebSocket]);

  const setPresenceStatus = async (
    newStatus: "ready" | "paused" | "in_call" | "offline",
    newPauseReason?: string
  ) => {
    setMyStatus(newStatus);
    if (newPauseReason !== undefined) setPauseReason(newPauseReason);

    try {
      let response: any = null;
      try {
        response = await api.post("/api/presence/status", {
          status: newStatus,
          pause_reason: newPauseReason || null,
        });
      } catch (primaryErr: any) {
        if (primaryErr?.status === 404 || (primaryErr?.message && primaryErr.message.includes("404"))) {
          response = await api.post("/api/presence/status-update", {
            status: newStatus,
            pause_reason: newPauseReason || null,
          });
        } else {
          throw primaryErr;
        }
      }

      if (response && response.presence) {
        const updated = response.presence as AgentPresence;
        setAgents((prev) => {
          const index = prev.findIndex((a) => a.id === updated.id || a.user_id === updated.user_id);
          if (index !== -1) {
            const next = [...prev];
            next[index] = { ...next[index], ...updated };
            return next;
          }
          return [...prev, updated];
        });
      }
    } catch (err: any) {
      console.warn("[PRESENCE] Status update server warning:", err?.message || err);
    }
  };

  const updateCallTelemetry = (stats: {
    ringing_seconds?: number;
    setup_seconds?: number;
    talk_seconds?: number;
    dispose_seconds?: number;
    calls_handled?: number;
  }) => {
    if (!user) return;
    setAgents((prev) =>
      prev.map((agent) => {
        if (agent.id === user.id || agent.user_id === user.id) {
          return {
            ...agent,
            ringing_seconds: (agent.ringing_seconds || 0) + (stats.ringing_seconds || 0),
            setup_seconds: (agent.setup_seconds || 0) + (stats.setup_seconds || 0),
            talk_seconds: (agent.talk_seconds || 0) + (stats.talk_seconds || 0),
            dispose_seconds: (agent.dispose_seconds || 0) + (stats.dispose_seconds || 0),
            total_calls_handled: (agent.total_calls_handled || 0) + (stats.calls_handled || 0),
          };
        }
        return agent;
      })
    );
  };

  return (
    <PresenceContext.Provider
      value={{
        myStatus,
        pauseReason,
        myPresence,
        agents,
        summary,
        wsConnected,
        setPresenceStatus,
        refreshPresence: fetchPresenceData,
        updateCallTelemetry,
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error("usePresence must be used within a PresenceProvider");
  }
  return context;
};
