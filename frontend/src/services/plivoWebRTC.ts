import { api } from "../api/client";

export interface PlivoEndpointCredentials {
  username: string;
  password: string;
  sip_uri: string;
  plivo_number: string;
  app_id: string;
}

export type WebRTCCallState =
  | "IDLE"
  | "REGISTERING"
  | "READY"
  | "CALLING"
  | "RINGING"
  | "CONNECTED"
  | "MEDIA_CONNECTED"
  | "ENDED"
  | "FAILED";

export interface MediaDiagnostics {
  micPermission: boolean;
  localStream: boolean;
  localAudioTracks: number;
  localTrackLive: boolean;
  micDeviceName: string;
  remoteStream: boolean;
  remoteAudioTracks: number;
  remoteTrackLive: boolean;
  audioElementExists: boolean;
  audioElementMuted: boolean;
  audioElementVolume: number;
  audioElementPlaying: boolean;
}

class PlivoWebRTCService {
  private client: any = null;
  private isInitialized = false;
  private isConnected = false;
  private currentCall: any = null;
  private credentials: PlivoEndpointCredentials | null = null;
  private callState: WebRTCCallState = "IDLE";
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private initPromise: Promise<boolean> | null = null;
  private audioInputDeviceId: string = "default";
  private audioOutputDeviceId: string = "default";

  private diagnostics: MediaDiagnostics = {
    micPermission: false,
    localStream: false,
    localAudioTracks: 0,
    localTrackLive: false,
    micDeviceName: "Default Microphone",
    remoteStream: false,
    remoteAudioTracks: 0,
    remoteTrackLive: false,
    audioElementExists: false,
    audioElementMuted: false,
    audioElementVolume: 1,
    audioElementPlaying: false,
  };

  // ──────────────────────────────────────────────
  // SDK script loader
  // ──────────────────────────────────────────────
  private async ensureScriptLoaded(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    if ((window as any).Plivo) return true;

    return new Promise((resolve) => {
      let script = document.querySelector('script[src*="plivo.min.js"]') as HTMLScriptElement;
      if (!script) {
        script = document.createElement("script");
        script.src = "/plivo.min.js";
        script.async = true;
        document.head.appendChild(script);
      }

      const checkInterval = setInterval(() => {
        if ((window as any).Plivo) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);

      script.onerror = () => {
        clearInterval(checkInterval);
        console.error("[PLIVO] Failed to load Plivo Browser SDK script.");
        resolve(false);
      };

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(!!(window as any).Plivo);
      }, 5000);
    });
  }

  // ──────────────────────────────────────────────
  // Microphone
  // ──────────────────────────────────────────────
  public async initializeMicrophone(): Promise<boolean> {
    try {
      if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;

      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          deviceId: this.audioInputDeviceId !== "default"
            ? { exact: this.audioInputDeviceId }
            : undefined,
        },
        video: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;

      // CRITICAL: Plivo SDK reads window.localStream for outbound call audio.
      (window as any).localStream = stream;

      const tracks = stream.getAudioTracks();
      const firstTrack = tracks[0];

      this.diagnostics.micPermission = true;
      this.diagnostics.localStream = true;
      this.diagnostics.localAudioTracks = tracks.length;
      this.diagnostics.localTrackLive = firstTrack ? firstTrack.readyState === "live" && firstTrack.enabled : false;
      this.diagnostics.micDeviceName = firstTrack?.label || "Default Microphone";

      console.log("[PLIVO] Microphone initialized");
      console.log(`[MEDIA] Local audio tracks: ${tracks.length}`);
      console.log(`[MEDIA] Local audio track state: ${firstTrack?.readyState || "none"}`);

      this.notifyStateChange();
      return true;
    } catch (err) {
      console.warn("[PLIVO] Microphone initialization failed:", err);
      this.diagnostics.micPermission = false;
      this.diagnostics.localStream = false;
      this.diagnostics.localAudioTracks = 0;
      this.diagnostics.localTrackLive = false;
      this.notifyStateChange();
      return false;
    }
  }

  // ──────────────────────────────────────────────
  // Pre-create SDK's internal remote audio element
  // ──────────────────────────────────────────────
  private ensureRemoteAudioElement(): void {
    if (typeof document === "undefined") return;

    const SDK_REMOTE_ID = "plivo_webrtc_remoteview";
    let elem = document.getElementById(SDK_REMOTE_ID) as HTMLAudioElement;
    if (!elem) {
      elem = document.createElement("audio");
      elem.id = SDK_REMOTE_ID;
      elem.autoplay = true;
      elem.setAttribute("playsinline", "true");
      elem.setAttribute("data-devicetype", "speakerDevice");
      elem.hidden = true;
      document.body.appendChild(elem);
      console.log(`[MEDIA] Created SDK remote audio element #${SDK_REMOTE_ID}`);
    }
    elem.autoplay = true;
    elem.muted = false;
    elem.volume = 1.0;
  }

  // ──────────────────────────────────────────────
  // Initialize & Login
  // ──────────────────────────────────────────────
  public async initialize(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    // Already ready
    if (this.isInitialized && this.isConnected && this.client?.isLoggedIn) {
      console.log("[PLIVO] Already logged in, WEBRTC READY");
      this.setCallState("READY");
      return true;
    }

    // Deduplicate concurrent calls
    if (this.initPromise) {
      console.log("[PLIVO] Registration already in progress, awaiting…");
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<boolean> {
    try {
      this.setCallState("REGISTERING");
      console.log("[PLIVO] SDK initialization starting");

      // 1. Load SDK
      const hasSDK = await this.ensureScriptLoaded();
      if (!hasSDK) {
        console.error("[PLIVO] SDK script failed to load");
        this.setCallState("FAILED");
        return false;
      }
      console.log("[PLIVO] SDK script loaded");

      // 2. Microphone
      await this.initializeMicrophone();

      // 3. Fetch endpoint credentials
      const creds: PlivoEndpointCredentials = await api.get("/api/calls/plivo/endpoint");
      this.credentials = creds;
      console.log(`[PLIVO] Endpoint credentials received: username=${creds.username}`);

      if (!creds.username || !creds.password) {
        console.error("[PLIVO] Endpoint registration failed: No credentials");
        this.setCallState("FAILED");
        return false;
      }

      // 4. Pre-create remote audio element
      this.ensureRemoteAudioElement();

      // 5. Resolve the SDK constructor
      const PlivoConstructor = (window as any).Plivo;
      if (!PlivoConstructor || typeof PlivoConstructor !== "function") {
        console.error("[PLIVO] window.Plivo is not a constructor");
        this.setCallState("FAILED");
        return false;
      }

      // 6. Create client instance (singleton)
      if (!this.client) {
        // Clear cached instance to force fresh creation
        try { delete (window as any)._PlivoInstance; } catch {}

        const options = {
          debug: "ALL",
          permOnClick: true,
          codecs: ["OPUS", "PCMU"],
        };

        let rawClient = new PlivoConstructor(options);
        if (rawClient && rawClient.client && typeof rawClient.on !== "function") {
          rawClient = rawClient.client;
        }
        this.client = rawClient;

        console.log("[PLIVO] SDK initialized");
        console.log(`[PLIVO] SDK version: ${this.client?.version || "2.1.4"}`);
        console.log(`[PLIVO] Client type: ${typeof this.client}`);
        console.log(`[PLIVO] Has .on(): ${typeof this.client?.on === "function"}`);
        console.log(`[PLIVO] Has .login(): ${typeof this.client?.login === "function"}`);
        console.log(`[PLIVO] Has .call(): ${typeof this.client?.call === "function"}`);
      }

      // 7. Register events and login
      const bareUsername = creds.username.split("@")[0];
      console.log(`[PLIVO] Login/register starting for: ${bareUsername}`);

      const result = await this._loginToPlivo(bareUsername, creds.password);

      if (result) {
        console.log("[PLIVO] SDK login successful");
        console.log("[PLIVO] WEBRTC READY");
      } else {
        console.error("[PLIVO] SDK login FAILED");
      }

      return result;
    } catch (err) {
      console.error("[PLIVO] Initialization exception:", err);
      this.setCallState("FAILED");
      return false;
    } finally {
      this.initPromise = null;
    }
  }

  private _loginToPlivo(username: string, password: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (!this.client) {
        console.error("[PLIVO] No client instance for login");
        resolve(false);
        return;
      }

      let resolved = false;
      const done = (success: boolean) => {
        if (resolved) return;
        resolved = true;
        if (success) {
          this.isConnected = true;
          this.isInitialized = true;
          this.setCallState("READY");
          window.dispatchEvent(new CustomEvent("plivo_webrtc_connected"));
        } else {
          this.isConnected = false;
          this.setCallState("FAILED");
        }
        resolve(success);
      };

      // ── Register ALL SDK events via .on() only ──
      // The Plivo SDK constructor inherits EventEmitter.
      // Events MUST be registered via .on(), NOT via property assignment.
      const client = this.client;
      const registerOn = typeof client.on === "function" ? client.on.bind(client) : null;

      if (!registerOn) {
        console.error("[PLIVO] client.on is not a function — cannot register events");
        console.error("[PLIVO] Client keys:", Object.keys(client || {}));
        done(false);
        return;
      }

      // ── onConnectionChange: WebSocket level ──
      registerOn("onConnectionChange", (data: any) => {
        const state = data?.state || data;
        console.log(`[PLIVO] WebSocket state: ${state}`);
        // "connected" = WebSocket open. NOT login. Do NOT resolve here.
        // "registered" = SIP REGISTER 200 OK received internally.
        // But we still wait for the actual "onLogin" event.
      });

      // ── onLogin: SIP REGISTER succeeded AND SDK is ready ──
      registerOn("onLogin", () => {
        console.log("[PLIVO] SIP registration response received");
        console.log("[PLIVO] onLogin event fired — endpoint is registered");
        console.log(`[PLIVO] client.isLoggedIn = ${client.isLoggedIn}`);
        done(true);
      });

      // ── onLoginFailed: SIP REGISTER failed ──
      registerOn("onLoginFailed", (cause: any) => {
        console.error(`[PLIVO] onLoginFailed: ${cause}`);
        console.error(`[PLIVO] Login error cause: ${JSON.stringify(cause)}`);
        done(false);
      });

      // ── onLogout ──
      registerOn("onLogout", () => {
        console.warn("[PLIVO] onLogout event — endpoint unregistered");
        this.isConnected = false;
        this.isInitialized = false;
        this.setCallState("IDLE");
      });

      // ── Call events ──
      registerOn("onIncomingCall", (callerName: any, extraHeaders: any) => {
        console.log("[PLIVO] Incoming call:", callerName);
        window.dispatchEvent(new CustomEvent("plivo_webrtc_incoming", { detail: { callerName, extraHeaders } }));
      });

      registerOn("onCallRemoteRinging", (data: any) => {
        console.log("[PLIVO] Call ringing (remote)");
        this.setCallState("RINGING");
      });

      registerOn("onCallAnswered", (data: any) => {
        console.log("[PLIVO] Call answered");
        this.currentCall = data;
        this.setCallState("CONNECTED");
        window.dispatchEvent(new CustomEvent("plivo_webrtc_answered", { detail: data }));

        // Start monitoring for remote audio
        this.monitorRemoteAudio();
      });

      registerOn("onCallTerminated", (data: any) => {
        console.log("[PLIVO] Call terminated:", data?.reason || "");
        this.currentCall = null;
        this.remoteStream = null;
        this.diagnostics.remoteStream = false;
        this.diagnostics.remoteAudioTracks = 0;
        this.diagnostics.remoteTrackLive = false;
        this.diagnostics.audioElementPlaying = false;
        this.setCallState("ENDED");
        setTimeout(() => {
          if (this.isConnected) this.setCallState("READY");
        }, 1000);
        window.dispatchEvent(new CustomEvent("plivo_webrtc_terminated", { detail: data }));
      });

      registerOn("onCallFailed", (reason: any) => {
        console.error("[PLIVO] Call failed:", reason);
        this.currentCall = null;
        this.setCallState("FAILED");
        setTimeout(() => {
          if (this.isConnected) this.setCallState("READY");
        }, 1000);
      });

      registerOn("onMediaPermission", (data: any) => {
        console.log("[PLIVO] Media permission:", data?.status);
        if (data?.stream) {
          (window as any).localStream = data.stream;
          console.log("[PLIVO] SDK acquired localStream via onMediaPermission");
        }
      });

      registerOn("onMediaConnected", (stream: any) => {
        console.log("[PLIVO] onMediaConnected — remote stream available");
        this.bindRemoteStream(stream);
      });

      // ── Initiate login ──
      console.log(`[PLIVO] Calling client.login("${username}", "****")`);

      try {
        client.login(username, password);
        console.log("[PLIVO] client.login() called — waiting for onLogin or onLoginFailed…");
      } catch (err) {
        console.error("[PLIVO] client.login() threw:", err);
        done(false);
        return;
      }

      // Safety net: if neither onLogin nor onLoginFailed fires after 30s,
      // check isLoggedIn as a fallback
      setTimeout(() => {
        if (resolved) return;

        if (client.isLoggedIn) {
          console.warn("[PLIVO] Login timeout — but isLoggedIn=true, treating as success");
          done(true);
        } else {
          console.error("[PLIVO] Login timeout after 30s — isLoggedIn=false");
          console.error(`[PLIVO] WebSocket readyState: ${(client as any)?.phone?.transport?.ws?.readyState ?? "unknown"}`);
          console.error(`[PLIVO] isLoggedIn: ${client.isLoggedIn}`);
          done(false);
        }
      }, 30000);
    });
  }

  // ──────────────────────────────────────────────
  // Remote audio binding
  // ──────────────────────────────────────────────
  private bindRemoteStream(stream: any): void {
    if (!stream) return;
    this.remoteStream = stream;

    const tracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
    const firstTrack = tracks[0];

    this.diagnostics.remoteStream = true;
    this.diagnostics.remoteAudioTracks = tracks.length;
    this.diagnostics.remoteTrackLive = firstTrack ? firstTrack.readyState === "live" : true;

    console.log("[MEDIA] Remote stream received");
    console.log(`[MEDIA] Remote audio tracks: ${tracks.length}`);
    console.log(`[MEDIA] Remote audio track state: ${firstTrack?.readyState || "live"}`);

    const allIds = ["plivo_webrtc_remoteview", "plivo-remote-audio", "plivo_audio", "remoteAudio"];
    allIds.forEach((id) => {
      let elem = document.getElementById(id) as HTMLAudioElement;
      if (!elem) {
        elem = document.createElement("audio");
        elem.id = id;
        elem.autoplay = true;
        elem.setAttribute("playsinline", "true");
        document.body.appendChild(elem);
      }

      elem.srcObject = stream;
      elem.muted = false;
      elem.volume = 1.0;
      elem.autoplay = true;

      elem.play()
        .then(() => {
          console.log(`[MEDIA] Audio playback started (#${id})`);
          this.diagnostics.audioElementPlaying = true;
        })
        .catch((err) => {
          console.warn(`[MEDIA] Audio playback deferred on #${id}:`, err);
        });
    });

    this.diagnostics.audioElementExists = true;
    this.setCallState("MEDIA_CONNECTED");
    this.notifyStateChange();
  }

  /**
   * Poll the SDK's remoteView element for a stream after call() is invoked.
   */
  private monitorRemoteAudio(): void {
    let attempts = 0;
    const maxAttempts = 300;

    const poller = setInterval(() => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(poller);
        return;
      }

      // Check SDK's own remote audio element
      const sdkElem = document.getElementById("plivo_webrtc_remoteview") as HTMLAudioElement;
      if (sdkElem?.srcObject) {
        const stream = sdkElem.srcObject as MediaStream;
        const tracks = stream.getAudioTracks();

        if (tracks.length > 0) {
          clearInterval(poller);
          console.log(`[MEDIA] SDK remoteView has ${tracks.length} audio track(s), state: ${tracks[0].readyState}`);
          this.bindRemoteStream(stream);
        }
      }

      // Also check the client's internal remoteView
      if (this.client?.remoteView?.srcObject) {
        const stream = this.client.remoteView.srcObject as MediaStream;
        if (stream.getAudioTracks().length > 0) {
          clearInterval(poller);
          this.bindRemoteStream(stream);
        }
      }
    }, 100);
  }

  // ──────────────────────────────────────────────
  // Make call
  // ──────────────────────────────────────────────
  public async makeCall(destinationNumber: string): Promise<boolean> {
    try {
      console.log("[PLIVO] Outbound call requested");
      this.setCallState("CALLING");

      if (!this.client || !this.isConnected || !this.client.isLoggedIn) {
        console.log("[PLIVO] Not ready — initializing first…");
        const ok = await this.initialize();
        if (!ok) {
          console.error("[PLIVO] Outbound call failed: WebRTC not ready");
          this.setCallState("FAILED");
          return false;
        }
      }

      // Double-check readiness
      if (!this.client?.isLoggedIn) {
        console.error("[PLIVO] Outbound call blocked: client.isLoggedIn is false");
        this.setCallState("FAILED");
        return false;
      }

      // Ensure window.localStream is set
      if (this.localStream) {
        (window as any).localStream = this.localStream;
      } else {
        await this.initializeMicrophone();
      }

      // Ensure remote audio element
      this.ensureRemoteAudioElement();

      const cleanPhone = destinationNumber.replace(/\D/g, "");
      const formattedNumber = cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`;
      const callerId = this.credentials?.plivo_number || "+918031826757";

      console.log("[PLIVO] Starting outbound call");
      console.log(`[PLIVO] Destination: ${formattedNumber}`);
      console.log(`[PLIVO] CallerID: ${callerId}`);
      console.log(`[MEDIA] window.localStream present: ${!!(window as any).localStream}`);

      if (typeof this.client.call !== "function") {
        console.error("[PLIVO] client.call is not a function");
        this.setCallState("FAILED");
        return false;
      }

      this.client.call(formattedNumber, { callerId });
      console.log("[PLIVO] client.call() invoked successfully");

      // Start monitoring for remote audio
      this.monitorRemoteAudio();
      return true;
    } catch (err) {
      console.error("[PLIVO] Make call exception:", err);
      this.setCallState("FAILED");
      return false;
    }
  }

  // ──────────────────────────────────────────────
  // Call controls
  // ──────────────────────────────────────────────
  public answer(): void {
    if (typeof this.client?.answer === "function") {
      try {
        this.client.answer();
        console.log("[PLIVO] client.answer() invoked successfully");
      } catch (err) {
        console.warn("[PLIVO] Answer error:", err);
      }
    } else {
      console.warn("[PLIVO] client.answer is not a function");
    }
  }

  public reject(): void {
    if (typeof this.client?.reject === "function") {
      try {
        this.client.reject();
        console.log("[PLIVO] client.reject() invoked successfully");
      } catch (err) {
        console.warn("[PLIVO] Reject error:", err);
      }
    }
    this.currentCall = null;
    this.setCallState("READY");
  }

  public hangup(): void {
    if (typeof this.client?.hangup === "function") {
      try {
        this.client.hangup();
      } catch (err) {
        console.warn("[PLIVO] Hangup error:", err);
      }
    }
    this.currentCall = null;
    this.setCallState("ENDED");
    setTimeout(() => {
      if (this.isConnected) this.setCallState("READY");
    }, 1000);
  }

  public mute(): void {
    if (typeof this.client?.mute === "function") {
      this.client.mute();
    }
  }

  public unmute(): void {
    if (typeof this.client?.unmute === "function") {
      this.client.unmute();
    }
  }

  // ──────────────────────────────────────────────
  // Accessors
  // ──────────────────────────────────────────────
  public getCredentials(): PlivoEndpointCredentials | null {
    return this.credentials;
  }

  public getCallState(): WebRTCCallState {
    return this.callState;
  }

  public getDiagnostics(): MediaDiagnostics {
    return { ...this.diagnostics };
  }

  public async getAudioDevices(): Promise<{ inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }> {
    if (typeof window === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return { inputs: [], outputs: [] };
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      inputs: devices.filter((d) => d.kind === "audioinput"),
      outputs: devices.filter((d) => d.kind === "audiooutput"),
    };
  }

  public async setAudioInputDevice(deviceId: string): Promise<boolean> {
    this.audioInputDeviceId = deviceId;
    return this.initializeMicrophone();
  }

  public async setAudioOutputDevice(deviceId: string): Promise<boolean> {
    this.audioOutputDeviceId = deviceId;
    try {
      const elementIds = ["plivo_webrtc_remoteview", "plivo-remote-audio", "plivo_audio", "remoteAudio"];
      for (const id of elementIds) {
        const elem = document.getElementById(id) as any;
        if (elem && typeof elem.setSinkId === "function") {
          await elem.setSinkId(deviceId);
        }
      }
      return true;
    } catch (err) {
      console.warn("[MEDIA] Output device change failed:", err);
      return false;
    }
  }

  // ──────────────────────────────────────────────
  // Internal state management
  // ──────────────────────────────────────────────
  private setCallState(state: WebRTCCallState) {
    this.callState = state;
    this.notifyStateChange();
  }

  private notifyStateChange() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("plivo_webrtc_state_change", {
          detail: { state: this.callState, diagnostics: this.getDiagnostics() },
        })
      );
    }
  }
}

export const plivoWebRTC = new PlivoWebRTCService();
