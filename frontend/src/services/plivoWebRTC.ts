import { api } from "../api/client";

export interface PlivoEndpointCredentials {
  username: string;
  password: string;
  sip_uri: string;
  plivo_number: string;
  app_id: string;
}

class PlivoWebRTCService {
  private client: any = null;
  private isInitialized = false;
  private isConnected = false;
  private currentCall: any = null;
  private credentials: PlivoEndpointCredentials | null = null;

  public async initialize(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    // Check if Plivo SDK script is loaded
    if (!(window as any).Plivo) {
      console.warn("[Plivo WebRTC] Plivo SDK not found on window object. Ensure script is loaded.");
      return false;
    }

    if (this.isInitialized && this.isConnected) {
      return true;
    }

    try {
      // 1. Request Browser Microphone Access
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true }).catch((err) => {
          console.warn("[Plivo WebRTC] Microphone permission notice:", err);
        });
      }

      // 2. Fetch Endpoint credentials from backend
      const creds: PlivoEndpointCredentials = await api.get("/api/calls/plivo/endpoint");
      this.credentials = creds;

      if (!creds.username || !creds.password) {
        console.warn("[Plivo WebRTC] No endpoint credentials returned.");
        return false;
      }

      // 3. Initialize Plivo Client
      const PlivoSDK = (window as any).Plivo;
      this.client = new PlivoSDK.Client();

      this.client.on("onIncomingCall", (data: any) => {
        console.log("[Plivo WebRTC] Incoming Call:", data);
        window.dispatchEvent(new CustomEvent("plivo_webrtc_incoming", { detail: data }));
      });

      this.client.on("onCallAnswered", (data: any) => {
        console.log("[Plivo WebRTC] Call Answered:", data);
        this.currentCall = data;
        window.dispatchEvent(new CustomEvent("plivo_webrtc_answered", { detail: data }));
      });

      this.client.on("onCallTerminated", (data: any) => {
        console.log("[Plivo WebRTC] Call Terminated:", data);
        this.currentCall = null;
        window.dispatchEvent(new CustomEvent("plivo_webrtc_terminated", { detail: data }));
      });

      this.client.on("onLogin", () => {
        console.log("[Plivo WebRTC] Successfully logged into Plivo WebRTC Endpoint!");
        this.isConnected = true;
        window.dispatchEvent(new CustomEvent("plivo_webrtc_connected"));
      });

      this.client.on("onLoginFailed", (reason: any) => {
        console.warn("[Plivo WebRTC] Login failed:", reason);
        this.isConnected = false;
      });

      // 4. Log in to Plivo Endpoint
      const fullUsername = creds.username.includes("@") ? creds.username : `${creds.username}@phone.plivo.com`;
      this.client.login(fullUsername, creds.password);
      this.isInitialized = true;
      return true;
    } catch (err) {
      console.warn("[Plivo WebRTC] Initialization error:", err);
      return false;
    }
  }

  public async makeCall(destinationNumber: string): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        const ok = await this.initialize();
        if (!ok) console.warn("[Plivo WebRTC] Proceeding with backend REST fallback...");
      }

      const cleanPhone = destinationNumber.replace(/\D/g, "");
      const formattedNumber = cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`;
      const callerId = this.credentials?.plivo_number || "+918031826757";

      if (this.client && typeof this.client.call === "function") {
        console.log(`[Plivo WebRTC] Initiating in-browser call from microphone to ${formattedNumber}...`);
        this.client.call(formattedNumber, { callerId });
        return true;
      }
      return false;
    } catch (err) {
      console.warn("[Plivo WebRTC] Make call error:", err);
      return false;
    }
  }

  public hangup(): void {
    if (this.client && typeof this.client.hangup === "function") {
      try {
        this.client.hangup();
      } catch (err) {
        console.warn("[Plivo WebRTC] Hangup error:", err);
      }
    }
    this.currentCall = null;
  }

  public mute(): void {
    if (this.client && typeof this.client.mute === "function") {
      this.client.mute();
    }
  }

  public unmute(): void {
    if (this.client && typeof this.client.unmute === "function") {
      this.client.unmute();
    }
  }

  public getCredentials(): PlivoEndpointCredentials | null {
    return this.credentials;
  }
}

export const plivoWebRTC = new PlivoWebRTCService();
