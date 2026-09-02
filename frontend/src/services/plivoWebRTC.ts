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

  private async ensureScriptLoaded(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    if ((window as any).Plivo || (window as any).plivoWebSDK || (window as any).plivo) {
      return true;
    }

    return new Promise((resolve) => {
      let script = document.querySelector('script[src*="plivo.min.js"]') as HTMLScriptElement;
      if (!script) {
        script = document.createElement("script");
        script.src = "/plivo.min.js";
        script.async = true;
        document.head.appendChild(script);
      }

      const checkInterval = setInterval(() => {
        if ((window as any).Plivo || (window as any).plivoWebSDK || (window as any).plivo) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);

      script.onload = () => {
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(!!((window as any).Plivo || (window as any).plivoWebSDK || (window as any).plivo));
        }, 100);
      };

      script.onerror = () => {
        clearInterval(checkInterval);
        console.warn("[PLIVO] Failed to load Plivo Browser SDK script.");
        resolve(false);
      };

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(!!((window as any).Plivo || (window as any).plivoWebSDK || (window as any).plivo));
      }, 4000);
    });
  }

  public async initializeMicrophone(): Promise<boolean> {
    try {
      if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;

      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          deviceId: this.audioInputDeviceId !== "default" ? { exact: this.audioInputDeviceId } : undefined,
        },
        video: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;

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

  public async initialize(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    this.setCallState("REGISTERING");
    console.log("[PLIVO] Endpoint registering");

    const hasSDK = await this.ensureScriptLoaded();
    if (!hasSDK) {
      console.warn("[PLIVO] SDK missing on window object.");
      this.setCallState("FAILED");
      return false;
    }

    if (this.isInitialized && this.isConnected) {
      this.setCallState("READY");
      return true;
    }

    try {
      await this.initializeMicrophone();

      const creds: PlivoEndpointCredentials = await api.get("/api/calls/plivo/endpoint");
      this.credentials = creds;

      if (!creds.username || !creds.password) {
        console.warn("[PLIVO] Endpoint registration failed: No credentials");
        this.setCallState("FAILED");
        return false;
      }

      if (typeof window !== "undefined") {
        try {
          delete (window as any)._PlivoInstance;
        } catch {}
      }

      const PlivoSDK = (window as any).Plivo || (window as any).plivoWebSDK || (window as any).plivo;
      let ClientClass: any = null;

      if (typeof PlivoSDK === "function") {
        ClientClass = PlivoSDK;
      } else if (PlivoSDK && typeof PlivoSDK.Client === "function") {
        ClientClass = PlivoSDK.Client;
      }

      if (!ClientClass || typeof ClientClass !== "function") {
        console.warn("[PLIVO] Plivo Client constructor missing on window object.");
        this.setCallState("FAILED");
        return false;
      }

      const clientOptions = {
        debug: "ALL",
        permOnClick: true,
        codecs: ["OPUS", "PCMU"],
      };

      this.client = new ClientClass(clientOptions);

      if (this.client && !this.client.options) {
        this.client.options = clientOptions;
      }

      console.log("[PLIVO] SDK initialized");

      const bareUsername = creds.username.split("@")[0];

      return new Promise<boolean>((resolve) => {
        let timeoutTimer: any = null;

        const onLoginSuccess = () => {
          if (timeoutTimer) clearTimeout(timeoutTimer);
          console.log("[PLIVO] Endpoint registered");
          this.isConnected = true;
          this.isInitialized = true;
          this.setCallState("READY");
          window.dispatchEvent(new CustomEvent("plivo_webrtc_connected"));
          resolve(true);
        };

        const onLoginError = (reason: any) => {
          if (timeoutTimer) clearTimeout(timeoutTimer);
          console.warn("[PLIVO] Endpoint registration failed:", reason);
          this.isConnected = false;
          this.setCallState("FAILED");
          resolve(false);
        };

        const bindEvent = (target: any, event: string, handler: Function) => {
          if (!target) return;
          if (typeof target.on === "function") {
            try { target.on(event, handler); } catch {}
          }
          if (typeof target.client?.on === "function") {
            try { target.client.on(event, handler); } catch {}
          }
          if (typeof target.addListener === "function") {
            try { target.addListener(event, handler); } catch {}
          }
          if (event.startsWith("on") && typeof target[event] !== "function") {
            target[event] = handler;
          }
        };

        bindEvent(this.client, "onIncomingCall", (data: any) => {
          console.log("[PLIVO] Incoming call:", data);
          window.dispatchEvent(new CustomEvent("plivo_webrtc_incoming", { detail: data }));
        });

        const bindStreamToAudio = (stream: any) => {
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

          const elementIds = ["plivo-remote-audio", "plivo_audio", "remoteAudio"];
          elementIds.forEach((id) => {
            let elem = document.getElementById(id) as HTMLAudioElement;
            if (!elem) {
              elem = document.createElement("audio");
              elem.id = id;
              elem.autoplay = true;
              elem.setAttribute("playsinline", "true");
              document.body.appendChild(elem);
            }

            elem.srcObject = stream;
            this.diagnostics.audioElementExists = true;
            this.diagnostics.audioElementMuted = elem.muted;
            this.diagnostics.audioElementVolume = elem.volume;

            console.log(`[MEDIA] Audio element attached (#${id})`);

            elem.play()
              .then(() => {
                this.diagnostics.audioElementPlaying = true;
                console.log(`[MEDIA] Audio playback started (#${id})`);
                this.setCallState("MEDIA_CONNECTED");
                console.log("[PLIVO] Remote media connected");
              })
              .catch((err) => {
                console.warn(`[MEDIA] Audio playback deferred/blocked on #${id}:`, err);
              });
          });

          this.notifyStateChange();
        };

        bindEvent(this.client, "onMediaStream", (stream: any) => {
          bindStreamToAudio(stream);
        });

        bindEvent(this.client, "onCallAnswered", (data: any) => {
          console.log("[PLIVO] Call answered");
          this.currentCall = data;
          this.setCallState("CONNECTED");
          console.log("[PLIVO] Local media connected");

          const stream = data?.stream || data?.mediaStream || (this.client as any)?.remoteStream;
          if (stream) bindStreamToAudio(stream);
          window.dispatchEvent(new CustomEvent("plivo_webrtc_answered", { detail: data }));
        });

        bindEvent(this.client, "onCallRinging", () => {
          console.log("[PLIVO] Call ringing");
          this.setCallState("RINGING");
        });

        bindEvent(this.client, "onCallTerminated", (data: any) => {
          console.log("[PLIVO] Call terminated");
          this.currentCall = null;
          this.remoteStream = null;
          this.diagnostics.remoteStream = false;
          this.diagnostics.remoteAudioTracks = 0;
          this.diagnostics.remoteTrackLive = false;
          this.diagnostics.audioElementPlaying = false;
          this.setCallState("ENDED");
          setTimeout(() => this.setCallState("READY"), 1000);
          window.dispatchEvent(new CustomEvent("plivo_webrtc_terminated", { detail: data }));
        });

        bindEvent(this.client, "onLogin", onLoginSuccess);
        bindEvent(this.client, "onLoginFailed", onLoginError);

        timeoutTimer = setTimeout(() => {
          console.warn("[PLIVO] Login timeout");
          resolve(this.isConnected);
        }, 5000);

        const loginFn = this.client?.login || (this.client as any)?.client?.login;
        if (typeof loginFn === "function") {
          loginFn.call(this.client, bareUsername, creds.password);
        } else {
          console.warn("[PLIVO] client.login function not found on SDK instance:", this.client);
          this.setCallState("FAILED");
          resolve(false);
        }
      });
    } catch (err) {
      console.warn("[PLIVO] Initialization exception:", err);
      this.setCallState("FAILED");
      return false;
    }
  }

  public async makeCall(destinationNumber: string): Promise<boolean> {
    try {
      console.log("[PLIVO] Outbound call requested");
      this.setCallState("CALLING");

      if (!this.client || !this.isConnected) {
        const ok = await this.initialize();
        if (!ok) {
          console.warn("[PLIVO] Outbound call failed: WebRTC not ready");
          this.setCallState("FAILED");
          return false;
        }
      }

      const cleanPhone = destinationNumber.replace(/\D/g, "");
      const formattedNumber = cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`;
      const callerId = this.credentials?.plivo_number || "+918031826757";

      const callFn = this.client?.call || (this.client as any)?.client?.call;
      if (typeof callFn === "function") {
        console.log(`[PLIVO] Dialing WebRTC stream to ${formattedNumber} (CallerID: ${callerId})...`);
        callFn.call(this.client, formattedNumber, { callerId });
        return true;
      }
      this.setCallState("FAILED");
      return false;
    } catch (err) {
      console.warn("[PLIVO] Make call exception:", err);
      this.setCallState("FAILED");
      return false;
    }
  }

  public hangup(): void {
    const hangupFn = this.client?.hangup || (this.client as any)?.client?.hangup;
    if (typeof hangupFn === "function") {
      try {
        hangupFn.call(this.client);
      } catch (err) {
        console.warn("[PLIVO] Hangup error:", err);
      }
    }
    this.currentCall = null;
    this.setCallState("ENDED");
    setTimeout(() => this.setCallState("READY"), 1000);
  }

  public mute(): void {
    const muteFn = this.client?.mute || (this.client as any)?.client?.mute;
    if (typeof muteFn === "function") {
      muteFn.call(this.client);
    }
  }

  public unmute(): void {
    const unmuteFn = this.client?.unmute || (this.client as any)?.client?.unmute;
    if (typeof unmuteFn === "function") {
      unmuteFn.call(this.client);
    }
  }

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
      const elementIds = ["plivo-remote-audio", "plivo_audio", "remoteAudio"];
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
