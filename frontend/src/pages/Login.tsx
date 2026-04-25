import { API_BASE_URL } from "@/lib/config";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Hexagon, Building2, ClipboardList, Heart, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NeedTerrainMap } from "@/components/coordinator/NeedTerrainMap";
import { cn } from "@/lib/utils";
import {
  FACE_MATCH_THRESHOLD,
  detectFaceDescriptor,
  findBestFaceMatch,
  loadFaceModels,
  startCamera,
  stopCamera,
  type FaceCandidate,
} from "@/lib/face-auth";

const roles = [
  { id: "coordinator", label: "NGO Coordinator", icon: Building2, desc: "Manage operations" },
  { id: "fieldworker", label: "Field Worker", icon: ClipboardList, desc: "Collect field data" },
  { id: "volunteer", label: "Volunteer", icon: Heart, desc: "Execute missions" },
] as const;

export default function Login() {
  const [selectedRole, setSelectedRole] = useState<string>("coordinator");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [faceModelsReady, setFaceModelsReady] = useState(false);
  const [faceStatusMessage, setFaceStatusMessage] = useState("Loading face login models...");
  const [faceErrorMessage, setFaceErrorMessage] = useState("");
  const [faceAttempts, setFaceAttempts] = useState(0);
  const [faceLocked, setFaceLocked] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const faceScanBusyRef = useRef(false);
  const navigate = useNavigate();
  const apiBaseUrl = API_BASE_URL;

  const completeSignin = (payload: { accessToken: string; user: unknown; redirectPath?: string }) => {
    localStorage.setItem("nexus_access_token", payload.accessToken);
    localStorage.setItem("nexus_user", JSON.stringify(payload.user));
    navigate(payload.redirectPath || "/dashboard");
  };

  const handleLogin = async () => {
    setErrorMessage("");
    setIsSubmitting(true);
    console.log("[Auth] Signin started", { selectedRole, email });

    try {
      const response = await fetch(`${apiBaseUrl}/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role: selectedRole }),
      });

      const payload = await response.json();
      console.log("[Auth] Signin response", { status: response.status, payload });

      if (!response.ok) {
        throw new Error(payload?.detail || "Sign in failed");
      }

      completeSignin(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected sign-in error";
      console.error("[Auth] Signin failed", error);
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    let active = true;

    const initializeFaceModels = async () => {
      try {
        await loadFaceModels("/models");
        if (!active) {
          return;
        }
        setFaceModelsReady(true);
        setFaceStatusMessage("Camera is starting. Align your face in the guide.");
      } catch (error) {
        if (!active) {
          return;
        }
        console.error("[FaceAuth] Model load failed", error);
        setFaceErrorMessage("Face login unavailable right now. Please use email and password.");
        setFaceStatusMessage("Face login models failed to load.");
      }
    };

    void initializeFaceModels();

    return () => {
      active = false;
      stopCamera(cameraStreamRef.current);
      cameraStreamRef.current = null;
    };
  }, []);

  useEffect(() => {
    setFaceAttempts(0);
    setFaceLocked(false);
    setFaceErrorMessage("");
    if (faceModelsReady) {
      setFaceStatusMessage("Role selected. Scanning for your face...");
    }
  }, [selectedRole, faceModelsReady]);

  useEffect(() => {
    if (!faceModelsReady || faceLocked) {
      setCameraReady(false);
      stopCamera(cameraStreamRef.current);
      cameraStreamRef.current = null;
      return;
    }

    let cancelled = false;
    const openCamera = async () => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      stopCamera(cameraStreamRef.current);
      cameraStreamRef.current = null;
      setCameraReady(false);

      try {
        const stream = await startCamera(video);
        if (cancelled) {
          stopCamera(stream);
          return;
        }
        cameraStreamRef.current = stream;
        setCameraReady(true);
        setFaceStatusMessage("Face camera ready. Verifying...");
      } catch (error) {
        console.error("[FaceAuth] Camera start failed", error);
        if (!cancelled) {
          setFaceErrorMessage("Camera access was denied. You can still sign in with email and password.");
          setFaceStatusMessage("Camera unavailable.");
        }
      }
    };

    void openCamera();

    return () => {
      cancelled = true;
      setCameraReady(false);
      stopCamera(cameraStreamRef.current);
      cameraStreamRef.current = null;
    };
  }, [faceLocked, faceModelsReady, selectedRole]);

  useEffect(() => {
    if (!faceModelsReady || !cameraReady || faceLocked) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      if (faceScanBusyRef.current || faceLocked || isSubmitting) {
        return;
      }

      const video = videoRef.current;
      if (!video) {
        return;
      }

      faceScanBusyRef.current = true;
      try {
        const liveDescriptor = await detectFaceDescriptor(video);
        if (!liveDescriptor) {
          setFaceStatusMessage("Face not detected. Keep your face inside the guide.");
          return;
        }

        setFaceStatusMessage("Face detected. Checking match...");

        const candidatesResponse = await fetch(`${apiBaseUrl}/auth/face/candidates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: selectedRole }),
        });

        const candidatesPayload = await candidatesResponse.json();
        if (!candidatesResponse.ok) {
          throw new Error(candidatesPayload?.detail || "Unable to validate face");
        }

        const candidates = (Array.isArray(candidatesPayload?.candidates) ? candidatesPayload.candidates : []) as FaceCandidate[];
        const bestMatch = findBestFaceMatch(liveDescriptor, candidates, FACE_MATCH_THRESHOLD);

        if (!bestMatch) {
          setFaceAttempts((prev) => {
            const next = prev + 1;
            if (next >= 3) {
              setFaceLocked(true);
              setFaceStatusMessage("No face match after 3 tries. Please use email and password below.");
            } else {
              setFaceStatusMessage(`No match yet. Attempt ${next} of 3.`);
            }
            return next;
          });
          return;
        }

        setIsSubmitting(true);
        setFaceStatusMessage("Match found. Signing you in...");
        const signinResponse = await fetch(`${apiBaseUrl}/auth/face/signin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: bestMatch.id, role: selectedRole }),
        });
        const signinPayload = await signinResponse.json();

        if (!signinResponse.ok) {
          throw new Error(signinPayload?.detail || "Face sign-in failed");
        }

        completeSignin(signinPayload);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Face sign-in failed";
        console.error("[FaceAuth] Face sign-in failed", error);
        setFaceErrorMessage(message);
      } finally {
        setIsSubmitting(false);
        faceScanBusyRef.current = false;
      }
    }, 1800);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [apiBaseUrl, cameraReady, faceLocked, faceModelsReady, isSubmitting, selectedRole]);

  return (
    <div className="flex min-h-screen">
      {/* Left dark panel */}
      <div className="relative hidden lg:flex lg:w-[45%] flex-col justify-between bg-sidebar p-10 text-sidebar-foreground overflow-hidden">
        <div>
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="NEXUS Logo" className="h-7 w-7 rounded-sm" />
            <span className="text-xl font-bold">NEXUS</span>
          </Link>
          <h1 className="mt-16 text-3xl font-bold leading-tight">Welcome back to<br />the community brain.</h1>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: "hsl(233 70% 78%)" }}>Log in to your Nexus workspace and start coordinating.</p>
        </div>

        {/* Decorative floating card */}
        <div className="relative mt-8 flex-1 flex items-center justify-center">
          <div className="w-[280px] rounded-card border border-sidebar-border bg-sidebar-muted/20 p-3 shadow-elevated backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs font-medium mb-2">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              Need Terrain — Live
            </div>
            <NeedTerrainMap className="h-[140px] rounded-lg" showLegend={false} />
          </div>
        </div>

        <p className="text-sm" style={{ color: "hsl(233 70% 78%)" }}>
          Don't have an account?{" "}
          <Link to="/signup" className="font-semibold text-white hover:underline">Start free →</Link>
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-surface px-6 py-10">
        <div className="absolute right-6 top-6 text-sm">
          <span className="text-muted-foreground">New to Nexus? </span>
          <Link to="/signup" className="font-semibold text-primary hover:underline">Sign up</Link>
        </div>

        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <Hexagon className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold text-foreground">NEXUS</span>
          </div>

          <h2 className="text-xl font-bold text-foreground">Sign in to your account</h2>

          {/* Role selector */}
          <p className="mt-6 text-sm font-medium text-foreground">Select your role</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {roles.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedRole(r.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-card border p-3 text-center transition-all",
                  selectedRole === r.id
                    ? "border-primary bg-primary-light shadow-card"
                    : "border-border bg-card hover:border-primary/30"
                )}
              >
                <r.icon className={cn("h-5 w-5", selectedRole === r.id ? "text-primary" : "text-muted-foreground")} />
                <span className="text-xs font-semibold text-foreground">{r.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-card border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">Face Login</p>
            <p className="mt-1 text-xs text-muted-foreground">Primary sign-in option for your selected role.</p>

            <div className="relative mt-3 aspect-video overflow-hidden rounded-xl border border-border bg-[#0b1020]">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
              />

              <div className={cn("pointer-events-none absolute inset-0 flex items-center justify-center", cameraReady ? "opacity-100" : "opacity-40")}>
                <div className="h-[190px] w-[140px] rounded-[999px] border-2 border-cyan-200/80 animate-pulse" />
              </div>
              <div className="pointer-events-none absolute inset-x-10 top-1/2 h-px -translate-y-1/2 bg-cyan-200/70 animate-pulse" />
            </div>

            <p className="mt-3 text-xs text-foreground">{faceStatusMessage}</p>
            {faceAttempts > 0 && !faceLocked ? (
              <p className="mt-1 text-xs text-muted-foreground">Attempt {faceAttempts} of 3.</p>
            ) : null}
            {faceErrorMessage ? <p className="mt-2 text-xs text-destructive">{faceErrorMessage}</p> : null}
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="you@ngo.org"
                className="mt-1 rounded-button"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Password</Label>
                <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">Forgot password?</Link>
              </div>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="rounded-button pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" type="button">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
            <Button variant="gradient" className="w-full" size="lg" onClick={handleLogin} disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in →"}
            </Button>
          </div>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or continue with</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Google SSO */}
          <Button variant="outline" className="w-full gap-2" size="lg">
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </Button>

          <p className="mt-6 text-center text-[11px] text-muted-foreground leading-relaxed">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
