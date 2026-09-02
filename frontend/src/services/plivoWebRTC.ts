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
        console.warn("[Plivo WebRTC] Failed to load Plivo Browser SDK script.");
        resolve(false);
      };

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(!!((window as any).Plivo || (window as any).plivoWebSDK || (window as any).plivo));
      }, 4000);
    });
  }

  public async initialize(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    // Check & wait if Plivo SDK script is loaded
    const hasSDK = await this.ensureScriptLoaded();
    if (!hasSDK) {
      console.warn("[Plivo WebRTC] Plivo SDK not found on window object. Proceeding with REST fallback.");
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
      const PlivoSDK = (window as any).Plivo || (window as any).plivoWebSDK || (window as any).plivo;
      if (!PlivoSDK || typeof PlivoSDK.Client !== "function") {
        console.warn("[Plivo WebRTC] Plivo.Client constructor missing on SDK object.");
        return false;
      }
      this.client = new PlivoSDK.Client();

      // 4. Log in to Plivo Endpoint with Promise awaiting onLogin
      const bareUsername = creds.username.split("@")[0];
      
      return new Promise<boolean>((resolve) => {
        let timeoutTimer: any = null;

        const onLoginSuccess = () => {
          if (timeoutTimer) clearTimeout(timeoutTimer);
          console.log("[Plivo WebRTC] Successfully logged into Plivo WebRTC Endpoint!");
          this.isConnected = true;
          this.isInitialized = true;
          window.dispatchEvent(new CustomEvent("plivo_webrtc_connected"));
          resolve(true);
        };

        const onLoginError = (reason: any) => {
          if (timeoutTimer) clearTimeout(timeoutTimer);
          console.warn("[Plivo WebRTC] Login failed:", reason);
          this.isConnected = false;
          resolve(false);
        };

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

        this.client.on("onLogin", onLoginSuccess);
        this.client.on("onLoginFailed", onLoginError);

        timeoutTimer = setTimeout(() => {
          console.warn("[Plivo WebRTC] Timeout waiting for Plivo WebRTC onLogin.");
          resolve(this.isConnected);
        }, 5000);

        this.client.login(bareUsername, creds.password);
      });
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
