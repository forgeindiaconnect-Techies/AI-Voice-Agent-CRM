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
  status_since?: string | null;
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
  nowTicker: number;
  myStatus: "ready" | "paused" | "in_call" | "offline";
  displayStatus: "AVAILABLE" | "ON_BREAK" | "IN_CALL" | "OFFLINE";
  pauseReason: string | null;
  breakType: "LUNCH" | "TEA" | "PERSONAL" | string | null;
  breakStartedAt: string | null;
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
  maxBreakSeconds: number;
  isMaxBreakReached: boolean;
  remainingBreakSeconds: number;

  setPresenceStatus: (newStatus: "ready" | "paused" | "in_call" | "offline", pauseReason?: string, forceOffline?: boolean) => Promise<void>;
  startBreak: (breakType: string) => Promise<void>;
  resumeWork: () => Promise<void>;
  goOffline: (forceOffline?: boolean) => Promise<void>;
  goOnline: () => Promise<void>;
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
  const pauseStartedAtRef = useRef<number | null>(null);
  const isUnmountedRef = useRef<boolean>(false);
  const reconnectAttemptsRef = useRef<number>(0);
  const isAuthErrorRef = useRef<boolean>(false);

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
    if (myStatus === "paused" || myPresence?.status === "paused") {
      const startTimeVal = myPresence?.current_break?.start_time || myPresence?.last_status_change || myPresence?.status_since;
      if (startTimeVal) {
        try {
          const cbStart = new Date(startTimeVal).getTime();
          return Math.max(0, Math.floor((nowTicker - cbStart) / 1000));
        } catch {
          // Fallback below
        }
      }
      if (pauseStartedAtRef.current) {
        return Math.max(0, Math.floor((nowTicker - pauseStartedAtRef.current) / 1000));
      }
    }
    return 0;
  }, [myStatus, myPresence?.status, myPresence?.current_break, myPresence?.last_status_change, myPresence?.status_since, nowTicker]);

  const MAX_BREAK_SECONDS = 3780; // 1 Hour 3 Minutes
  const totalBreakSeconds = completedBreakSeconds + activeBreakSeconds;
  const isMaxBreakReached = totalBreakSeconds >= MAX_BREAK_SECONDS;
  const remainingBreakSeconds = Math.max(0, MAX_BREAK_SECONDS - totalBreakSeconds);

  // Login HR = Ready Time + Pause Time => Ready Time = Login HR - Pause Time
  const readySeconds = useMemo(() => {
    return Math.max(0, grossLoginSeconds - totalBreakSeconds);
  }, [grossLoginSeconds, totalBreakSeconds]);

  const calculatedWorkingSeconds = readySeconds;

  const talkSeconds = myPresence?.talk_seconds || 0;
  const ringingSeconds = myPresence?.ringing_seconds || 0;
  const setupSeconds = myPresence?.setup_seconds || 0;
  const disposeSeconds = myPresence?.dispose_seconds || 0;

  const stopCount = (myPresence?.break_logs || []).length + (myPresence?.status === "paused" || myStatus === "paused" ? 1 : 0);

  // 8-Hour shift target is evaluated directly against gross Login HR (breaks do NOT decrease shift progress)
  const isShiftTargetReached = grossLoginSeconds >= SHIFT_TARGET_SECONDS;


  const fetchPresenceData = useCallback(async () => {
    if (!user) return;
    try {
      const [agentList, summaryData, meData, activeSession] = await Promise.all([
        api.get("/api/presence/agents").catch(() => []),
        api.get("/api/presence/summary").catch(() => defaultSummary),
        api.get("/api/agent/presence").catch(() => api.get("/api/presence/me").catch(() => null)),
        api.get("/api/agent/session/active").catch(() => null),
      ]);

      if (Array.isArray(agentList)) {
        const uid = user.id || (user as any)._id;
        const meFromList = agentList.find((a: AgentPresence) => a.id === uid || a.user_id === uid || (a as any).agentId === uid);
        const me = meData || meFromList;
        if (me || activeSession) {
          const rawStatus = (activeSession?.raw_status || me?.status || "offline");
          const normalizedStatus = (rawStatus.toLowerCase().trim()) as "ready" | "paused" | "in_call" | "offline";
          setMyStatus(normalizedStatus);
          setPauseReason(activeSession?.currentBreak?.reason || me?.pause_reason || null);
          const fullMe = {
            ...me,
            ...activeSession,
            id: uid,
            user_id: uid,
            status: normalizedStatus,
            login_at: activeSession?.loginTime || me?.login_at,
            logout_at: activeSession?.logoutTime || me?.logout_at,
            current_break: activeSession?.currentBreak || me?.current_break,
            break_logs: activeSession?.breakLogs || me?.break_logs,
          };
          setMyPresence((prev) => ({ ...prev, ...fullMe }));
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
      if (!event.data) return;
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
          let updatedList: AgentPresence[];
          const index = prevAgents.findIndex((a) => a.id === updated.id || a.user_id === updated.user_id);
          if (index !== -1) {
            updatedList = [...prevAgents];
            updatedList[index] = { ...updatedList[index], ...updated, status: normalizedStatus };
          } else {
            updatedList = [...prevAgents, { ...updated, status: normalizedStatus }];
          }

          const total = updatedList.length;
          const ready = updatedList.filter((a) => a.status === "ready").length;
          const paused = updatedList.filter((a) => a.status === "paused").length;
          const inCall = updatedList.filter((a) => a.status === "in_call").length;
          const offline = updatedList.filter((a) => a.status === "offline").length;
          const online = ready + paused + inCall;

          setSummary({
            total_agents: total,
            online_count: online,
            ready_count: ready,
            paused_count: paused,
            in_call_count: inCall,
            offline_count: offline,
          });

          return updatedList;
        });

        if (user && (updated.id === user.id || updated.user_id === user.id || payload.agentId === user.id)) {
          setMyStatus(normalizedStatus);
          setPauseReason(updated.pause_reason || null);
          setMyPresence((prev) => ({ ...prev, ...updated, status: normalizedStatus }));
        }
      }
    } catch {
      // Control messages (pong, etc.)
    }
  }, [user]);

  const connectWebSocket = useCallback(() => {
    if (!user || isUnmountedRef.current || isAuthErrorRef.current) return;

    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const wsUrl = getWsUrl("/global");
      if (!wsUrl || wsUrl.includes("undefined")) {
        console.warn("[SESSION WS] Skipping invalid WS URL resolution:", wsUrl);
        return;
      }

      console.log("[SESSION WS] Connecting to:", wsUrl);
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      let isClosedByCleanup = false;

      ws.onopen = () => {
        if (isClosedByCleanup || isUnmountedRef.current) {
          try { ws.close(); } catch {}
          return;
        }
        setWsConnected(true);
        reconnectAttemptsRef.current = 0;
        isAuthErrorRef.current = false;
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

      ws.onmessage = (evt) => {
        if (!isClosedByCleanup && !isUnmountedRef.current) {
          handleWsMessage(evt);
        }
      };

      ws.onclose = (evt: CloseEvent) => {
        setWsConnected(false);
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        if (isClosedByCleanup || isUnmountedRef.current) {
          return; // Cleanup triggered close: do NOT auto-reconnect
        }

        if (evt.code === 4001 || evt.code === 4003 || evt.code === 1008) {
          console.warn("[SESSION WS] Auth rejected by backend. Halting reconnect.");
          isAuthErrorRef.current = true;
          return;
        }

        const attempt = reconnectAttemptsRef.current + 1;
        reconnectAttemptsRef.current = attempt;
        const delay = Math.min(3000 * Math.pow(1.5, attempt - 1), 30000);

        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) {
            connectWebSocket();
          }
        }, delay);
      };

      ws.onerror = (err) => {
        console.warn("[SESSION WS] Socket error:", err);
        setWsConnected(false);
      };
    } catch (err) {
      console.warn("[SESSION WS] Error establishing socket:", err);
      setWsConnected(false);
    }
  }, [user, handleWsMessage, fetchPresenceData]);

  useEffect(() => {
    isUnmountedRef.current = false;
    isAuthErrorRef.current = false;

    if (user) {
      fetchPresenceData();
      connectWebSocket();
    }

    return () => {
      isUnmountedRef.current = true;
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onclose = null;
        socketRef.current.onerror = null;
        try { socketRef.current.close(); } catch {}
        socketRef.current = null;
      }
    };
  }, [user]);

  const [isSubmittingStatus, setIsSubmittingStatus] = useState<boolean>(false);

  const displayStatus: "AVAILABLE" | "ON_BREAK" | "IN_CALL" | "OFFLINE" = useMemo(() => {
    if (myStatus === "ready") return "AVAILABLE";
    if (myStatus === "paused") return "ON_BREAK";
    if (myStatus === "in_call") return "IN_CALL";
    return "OFFLINE";
  }, [myStatus]);

  const breakType = useMemo(() => {
    if (myStatus !== "paused") return null;
    const r = myPresence?.current_break?.type || pauseReason || "";
    const u = r.toUpperCase();
    if (u.includes("LUNCH")) return "LUNCH";
    if (u.includes("TEA") || u.includes("REFRESHMENT")) return "TEA";
    return "PERSONAL";
  }, [myStatus, myPresence?.current_break?.type, pauseReason]);

  const breakStartedAt = useMemo(() => {
    if (myStatus !== "paused") return null;
    return myPresence?.current_break?.start_time || myPresence?.last_status_change || null;
  }, [myStatus, myPresence?.current_break?.start_time, myPresence?.last_status_change]);

  const setPresenceStatus = async (
    newStatus: "ready" | "paused" | "in_call" | "offline",
    newPauseReason?: string,
    forceOffline: boolean = false
  ) => {
    if (isSubmittingStatus) return;

    if (newStatus === "paused" && completedBreakSeconds >= MAX_BREAK_SECONDS) {
      throw new Error("Maximum daily break limit of 1 hr 3 min reached. You cannot take any more breaks today.");
    }

    if (newStatus === "offline" && !forceOffline && grossLoginSeconds < SHIFT_TARGET_SECONDS) {
      throw new Error("Shift incomplete. You must complete 8 hours of login shift time (including breaks) before going offline.");
    }

    setIsSubmittingStatus(true);

    const prevStatus = myStatus;
    const prevPauseReason = pauseReason;

    // Optimistically set local state
    setMyStatus(newStatus);
    if (newPauseReason !== undefined) setPauseReason(newPauseReason);

    if (newStatus === "paused") {
      if (!pauseStartedAtRef.current) pauseStartedAtRef.current = Date.now();
    } else if (newStatus === "ready") {
      pauseStartedAtRef.current = null;
    }

    try {
      let response: any = null;

      // Primary REST route targeting /api/agent/session/*
      const primaryEndpoint = newStatus === "ready"
        ? (prevStatus === "paused" ? "/api/agent/session/resume" : "/api/agent/session/start")
        : newStatus === "paused" ? "/api/agent/session/break"
        : newStatus === "offline" ? "/api/agent/session/logout"
        : "/api/presence/status";

      const fallbackEndpoint = newStatus === "ready" ? "/api/agents/me/break/resume"
        : newStatus === "paused" ? "/api/agents/me/break/start"
        : newStatus === "offline" ? "/api/agents/me/offline"
        : "/api/presence/status";

      console.log("[SESSION API] Sending outbound status change to:", primaryEndpoint, {
        status: newStatus,
        pause_reason: newPauseReason || null,
        force_offline: forceOffline,
      });

      try {
        response = await api.post(primaryEndpoint, {
          break_type: newPauseReason || null,
          reason: newPauseReason || null,
          status: newStatus,
          pause_reason: newPauseReason || null,
          force_offline: forceOffline,
        });
      } catch {
        try {
          response = await api.post(fallbackEndpoint, {
            break_type: newPauseReason || null,
            reason: newPauseReason || null,
            status: newStatus,
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
      }

      console.log("[SESSION API] Received server response:", response);

      if (response && (response.presence || response.status)) {
        const updated = (response.presence || response) as AgentPresence;
        if (updated && updated.status) {
          const rawSt = updated.status || newStatus;
          const normSt = (rawSt.toLowerCase().trim()) as "ready" | "paused" | "in_call" | "offline";
          setMyStatus(normSt);
          if (updated.pause_reason !== undefined) setPauseReason(updated.pause_reason);
          setMyPresence((prev) => ({
            ...prev,
            ...updated,
            status: normSt,
            pause_reason: updated.pause_reason !== undefined ? updated.pause_reason : newPauseReason || null,
          }));
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

  const startBreak = async (selectedBreakType: string) => {
    return setPresenceStatus("paused", selectedBreakType);
  };

  const resumeWork = async () => {
    return setPresenceStatus("ready");
  };

  const goOffline = async (forceOffline: boolean = true) => {
    if (myStatus === "in_call") {
      throw new Error("Cannot go offline while an active call is in progress. Please complete disposition first.");
    }
    return setPresenceStatus("offline", undefined, forceOffline);
  };

  const goOnline = async () => {
    return setPresenceStatus("ready");
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
        nowTicker,
        myStatus,
        displayStatus,
        pauseReason,
        breakType,
        breakStartedAt,
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
        maxBreakSeconds: MAX_BREAK_SECONDS,
        isMaxBreakReached,
        remainingBreakSeconds,
        setPresenceStatus,
        startBreak,
        resumeWork,
        goOffline,
        goOnline,
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
