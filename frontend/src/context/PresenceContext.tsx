import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useAuth } from "./AuthContext";
import { api, getWsUrl } from "../api/client";

export interface BreakCategoryStats {
  count: number;
  total_seconds: number;
}

export interface BreakStats {
  tea_break: BreakCategoryStats;
  lunch_break: BreakCategoryStats;
  personal_reason: BreakCategoryStats;
}

export interface BreakLogItem {
  type: string;
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
}

export interface CurrentBreak {
  type: string;
  start_time: string;
}

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
  current_break?: CurrentBreak | null;
  break_logs?: BreakLogItem[];
  total_break_seconds?: number;
  working_seconds?: number;
  gross_seconds?: number;
  ready_seconds: number;
  paused_seconds: number;
  talk_seconds?: number;
  ringing_seconds?: number;
  setup_seconds?: number;
  dispose_seconds?: number;
  total_calls_handled?: number;
  break_stats?: BreakStats;
  net_working_seconds?: number;
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
  isSubmittingStatus: boolean;
  netWorkingSeconds: number;
  grossLoginSeconds: number;
  totalBreakSeconds: number;
  activeBreakSeconds: number;
  readySeconds: number;
  talkSeconds: number;
  ringingSeconds: number;
  setupSeconds: number;
  disposeSeconds: number;
  stopCount: number;
  isShiftTargetReached: boolean;
  remainingSeconds: number;
  shiftTargetSeconds: number;

  setPresenceStatus: (newStatus: "ready" | "paused" | "in_call" | "offline", pauseReason?: string, forceOffline?: boolean) => Promise<void>;
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
  const [myStatus, setMyStatus] = useState<"ready" | "paused" | "in_call" | "offline">("offline");
  const [pauseReason, setPauseReason] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentPresence[]>([]);
  const [summary, setSummary] = useState<PresenceSummary>(defaultSummary);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [myPresence, setMyPresence] = useState<AgentPresence | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const myPresenceMemo = useMemo(() => {
    if (!user) return null;
    const uid = user.id || (user as any)._id;
    return agents.find((a) => a.id === uid || a.user_id === uid || (a as any).agentId === uid) || null;
  }, [agents, user]);

  const [nowTicker, setNowTicker] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowTicker(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const SHIFT_TARGET_SECONDS = 28800; // 8 Hours

  const grossLoginSeconds = useMemo(() => {
    if (!myPresence?.login_at) return myPresence?.gross_seconds || 0;
    if (myPresence?.status === "offline" && myPresence?.logout_at) {
      try {
        const s = new Date(myPresence.login_at).getTime();
        const e = new Date(myPresence.logout_at).getTime();
        return Math.max(0, Math.floor((e - s) / 1000));
      } catch {
        return myPresence?.gross_seconds || 0;
      }
    }
    try {
      const loginDt = new Date(myPresence.login_at).getTime();
      return Math.max(0, Math.floor((nowTicker - loginDt) / 1000));
    } catch {
      return 0;
    }
  }, [myPresence?.login_at, myPresence?.logout_at, myPresence?.status, myPresence?.gross_seconds, nowTicker]);

  const completedBreakSeconds = useMemo(() => {
    return (myPresence?.break_logs || []).reduce((acc: number, b: BreakLogItem) => {
      if (typeof b.duration_seconds === "number" && !isNaN(b.duration_seconds)) {
        return acc + b.duration_seconds;
      }
      if (b.start_time && b.end_time) {
        const s = new Date(b.start_time).getTime();
        const e = new Date(b.end_time).getTime();
        return acc + Math.max(0, Math.floor((e - s) / 1000));
      }
      return acc;
    }, 0);
  }, [myPresence?.break_logs]);

  const activeBreakSeconds = useMemo(() => {
    if (myPresence?.status === "paused" && myPresence?.current_break?.start_time) {
      try {
        const cbStart = new Date(myPresence.current_break.start_time).getTime();
        return Math.max(0, Math.floor((nowTicker - cbStart) / 1000));
      } catch {
        return 0;
      }
    }
    return 0;
  }, [myPresence?.status, myPresence?.current_break, nowTicker]);

  const totalBreakSeconds = completedBreakSeconds + activeBreakSeconds;

  // Login HR = Ready Time + Pause Time => Ready Time = Login HR - Pause Time
  const readySeconds = useMemo(() => {
    return Math.max(0, grossLoginSeconds - totalBreakSeconds);
  }, [grossLoginSeconds, totalBreakSeconds]);

  const calculatedWorkingSeconds = readySeconds;

  const talkSeconds = myPresence?.talk_seconds || 0;
  const ringingSeconds = myPresence?.ringing_seconds || 0;
  const setupSeconds = myPresence?.setup_seconds || 0;
  const disposeSeconds = myPresence?.dispose_seconds || 0;

  const stopCount = (myPresence?.break_logs || []).length + (myPresence?.status === "paused" ? 1 : 0);

  // 8-Hour shift target is evaluated directly against gross Login HR (breaks do NOT decrease shift progress)
  const isShiftTargetReached = grossLoginSeconds >= SHIFT_TARGET_SECONDS;


  const fetchPresenceData = useCallback(async () => {
    if (!user) return;
    try {
      const [agentList, summaryData, meData] = await Promise.all([
        api.get("/api/presence/agents").catch(() => []),
        api.get("/api/presence/summary").catch(() => defaultSummary),
        api.get("/api/agent/presence").catch(() => api.get("/api/presence/me").catch(() => null)),
      ]);

      if (Array.isArray(agentList)) {
        const uid = user.id || (user as any)._id;
        const meFromList = agentList.find((a: AgentPresence) => a.id === uid || a.user_id === uid || (a as any).agentId === uid);
        const me = meData || meFromList;
        if (me) {
          const rawStatus = me.status || "offline";
          const normalizedStatus = (rawStatus.toLowerCase().trim()) as "ready" | "paused" | "in_call" | "offline";
          setMyStatus(normalizedStatus);
          setPauseReason(me.pause_reason || null);
          const fullMe = { ...me, id: uid, user_id: uid, status: normalizedStatus };
          setAgents((prev) => {
            const idx = prev.findIndex((a) => a.id === uid || a.user_id === uid || (a as any).agentId === uid);
            if (idx !== -1) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], ...fullMe };
              return updated;
            }
            return [...prev, fullMe];
          });
        }
      }


      if (summaryData && typeof summaryData.ready_count === "number") {
        setSummary(summaryData);
      }
    } catch (err) {
      console.warn("[PRESENCE] Error loading presence data:", err);
    }
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

      if ((payload.type === "agent_presence_updated" || payload.event === "agent.status.changed") && (payload.data || payload.presence)) {
        const updated = (payload.data || payload.presence) as AgentPresence;
        const rawStatus = updated.status || payload.status || "offline";
        const normalizedStatus = (rawStatus.toLowerCase().trim()) as "ready" | "paused" | "in_call" | "offline";

        setAgents((prevAgents) => {
          const index = prevAgents.findIndex((a) => a.id === updated.id || a.user_id === updated.user_id);
          if (index !== -1) {
            const next = [...prevAgents];
            next[index] = { ...next[index], ...updated, status: normalizedStatus };
            return next;
          }
          return [...prevAgents, { ...updated, status: normalizedStatus }];
        });

        if (user && (updated.id === user.id || updated.user_id === user.id || payload.agentId === user.id)) {
          setMyStatus(normalizedStatus);
          setPauseReason(updated.pause_reason || null);
          setMyPresence((prev) => ({ ...prev, ...updated, status: normalizedStatus }));
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
        // Automatically sync authoritative presence from server on connect/reconnect
        fetchPresenceData();

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
  }, [user, handleWsMessage, fetchPresenceData]);

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

  const [isSubmittingStatus, setIsSubmittingStatus] = useState<boolean>(false);

  const setPresenceStatus = async (
    newStatus: "ready" | "paused" | "in_call" | "offline",
    newPauseReason?: string,
    forceOffline: boolean = false
  ) => {
    if (isSubmittingStatus) return;
    setIsSubmittingStatus(true);

    const prevStatus = myStatus;
    const prevPauseReason = pauseReason;

    // Optimistically set local state
    setMyStatus(newStatus);
    if (newPauseReason !== undefined) setPauseReason(newPauseReason);

    try {
      let response: any = null;
      const targetEndpoint = newStatus === "ready" ? "/api/agent/presence/ready"
        : newStatus === "paused" ? "/api/agent/presence/pause"
        : newStatus === "offline" ? "/api/agent/presence/offline"
        : "/api/presence/status";

      try {
        response = await api.post(targetEndpoint, {
          status: newStatus,
          reason: newPauseReason || null,
          pause_reason: newPauseReason || null,
          force_offline: forceOffline,
        });
      } catch {
        response = await api.post("/api/presence/status", {
          status: newStatus,
          pause_reason: newPauseReason || null,
          force_offline: forceOffline,
        });
      }


      if (response && (response.presence || response.status)) {
        const updated = (response.presence || response) as AgentPresence;
        if (updated) {
          const rawSt = updated.status || newStatus;
          const normSt = rawSt.toLowerCase().trim() as "ready" | "paused" | "in_call" | "offline";
          setMyStatus(normSt);
          if (updated.pause_reason !== undefined) setPauseReason(updated.pause_reason);
          setMyPresence((prev) => ({
            ...prev,
            ...updated,
            status: normSt,
            pause_reason: updated.pause_reason !== undefined ? updated.pause_reason : newPauseReason || null,
          }));
          setAgents((prev) => {
            const index = prev.findIndex((a) => a.id === updated.id || a.user_id === (updated.user_id || updated.id));
            if (index !== -1) {
              const next = [...prev];
              next[index] = { ...next[index], ...updated, status: normSt };
              return next;
            }
            return [...prev, { ...updated, status: normSt }];
          });
        }
      }

      await fetchPresenceData();
    } catch (err: any) {
      console.warn("[PRESENCE] Status update server error/rejection:", err?.response?.data || err?.message || err);
      // Rollback optimistic update to authoritative state
      setMyStatus(prevStatus);
      setPauseReason(prevPauseReason);
      await fetchPresenceData();
      throw err;
    } finally {
      setIsSubmittingStatus(false);
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
        isSubmittingStatus,
        netWorkingSeconds: calculatedWorkingSeconds,
        grossLoginSeconds,
        totalBreakSeconds,
        activeBreakSeconds,
        readySeconds,
        talkSeconds,
        ringingSeconds,
        setupSeconds,
        disposeSeconds,
        stopCount,
        isShiftTargetReached,
        remainingSeconds: Math.max(0, SHIFT_TARGET_SECONDS - grossLoginSeconds),
        shiftTargetSeconds: SHIFT_TARGET_SECONDS,
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
