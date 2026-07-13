import React, { useState } from "react";
import { useAppContext } from "../store";
import { HardHat, LogIn, Key, ArrowLeft, CheckCircle2 } from "lucide-react";

export function Login() {
  const { state, login, resetPin } = useAppContext();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Setup Admin State
  const [setupStep, setSetupStep] = useState(1);
  const [setupCompanyName, setSetupCompanyName] = useState("");
  const [setupName, setSetupName] = useState("");
  const [setupPhone, setSetupPhone] = useState("");
  const [setupPin, setSetupPin] = useState("");
  const [setupOtp, setSetupOtp] = useState("");
  const [setupError, setSetupError] = useState("");
  const [isSettingUp, setIsSettingUp] = useState(false);

  // Recovery State
  const [recoveryStep, setRecoveryStep] = useState(1); // 1: Phone, 2: OTP, 3: New PIN
  const [recoveryPhone, setRecoveryPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPin, setNewPin] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");

  const [explicitView, setExplicitView] = useState<
    "login" | "signup" | "recovery" | null
  >(null);
  const currentView = explicitView || "login";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    setErrorMsg("");
    setIsLoading(true);
    const result = await login(phone.trim(), pin.trim());
    setIsLoading(false);
    if (result === true) {
      // success
    } else if (typeof result === "object" && result?.error) {
      setErrorMsg(result.error);
    } else {
      setError(true);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError("");

    if (recoveryStep === 1) {
      if (recoveryPhone.length < 10) {
        setRecoveryError("Please enter a valid 10-digit mobile number.");
        return;
      }
      setRecoveryStep(2);
    } else if (recoveryStep === 2) {
      if (otp !== "123456") {
        // Mock OTP validation
        setRecoveryError("Invalid OTP. Please enter 123456.");
        return;
      }
      setRecoveryStep(3);
    } else if (recoveryStep === 3) {
      if (newPin.length < 4) {
        setRecoveryError("Password must be at least 4 characters.");
        return;
      }
      setIsRecovering(true);
      const result = await resetPin(recoveryPhone, newPin);
      setIsRecovering(false);
      if (result === true) {
        setRecoverySuccess(true);
        setTimeout(() => {
          setExplicitView("login");
          setRecoveryStep(1);
          setRecoveryPhone("");
          setOtp("");
          setNewPin("");
          setRecoverySuccess(false);
          setPhone(recoveryPhone);
        }, 2000);
      } else if (typeof result === "object" && result?.error) {
        setRecoveryError(result.error);
      } else {
        setRecoveryError("Failed to reset password.");
      }
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError("");

    if (setupStep === 1) {
      if (!setupCompanyName.trim())
        return setSetupError("Company Name is required");
      if (setupPhone.length < 10)
        return setSetupError("Enter a valid 10-digit mobile number");
      if (setupPin.length < 4)
        return setSetupError("Password must be at least 4 characters");
      if (!setupName.trim()) return setSetupError("Name is required");

      setSetupStep(2);
      return;
    }

    if (setupStep === 2) {
      if (setupOtp !== "123456") {
        return setSetupError("Invalid OTP. Please enter 123456.");
      }

      setIsSettingUp(true);
      try {
        const res = await fetch("/api/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: setupCompanyName,
            ownerName: setupName,
            ownerPhone: setupPhone,
            ownerPin: setupPin,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Setup failed");

        // Reload on success to trigger sync
        window.location.reload();
      } catch (err: any) {
        setSetupError(err.message || "An error occurred");
        setIsSettingUp(false);
      }
    }
  };

  if (currentView === "signup") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 border-t-4 border-amber-500 p-8 text-center">
          <HardHat className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold tracking-tight mb-2 uppercase">
            WELCOME TO NIRMAAN
          </h2>
          <p className="text-slate-500 mb-6 text-sm">
            Register your construction company and set up the master admin
            account.
          </p>

          <form onSubmit={handleSetup} className="space-y-4 text-left">
            {setupStep === 1 ? (
              <>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    required
                    value={setupCompanyName}
                    onChange={(e) => setSetupCompanyName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                    placeholder="DSR Construction Pvt Ltd"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Admin Name
                  </label>
                  <input
                    type="text"
                    required
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                    placeholder="Your Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={setupPhone}
                    onChange={(e) => setSetupPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all font-mono"
                    placeholder="9999999999"
                    maxLength={10}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Create a Password
                  </label>
                  <input
                    type="password"
                    required
                    value={setupPin}
                    onChange={(e) => setSetupPin(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all font-mono tracking-widest"
                    placeholder="••••"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-4 animate-in slide-in-from-right-4">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700 font-medium flex items-start gap-2 mb-4">
                  <span>
                    An OTP has been sent to {setupPhone}. <br />
                    <strong>(Hint: Use 123456)</strong>
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Enter OTP
                  </label>
                  <input
                    type="text"
                    required
                    value={setupOtp}
                    onChange={(e) => setSetupOtp(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all font-mono tracking-widest text-center text-lg"
                    placeholder="6-digit OTP"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSetupStep(1)}
                  className="text-sm text-slate-500 hover:text-slate-800 underline block text-center w-full mt-2"
                >
                  Back to edit details
                </button>
              </div>
            )}

            {setupError && (
              <p className="text-sm text-red-600 font-medium text-center bg-red-50 p-2 rounded-lg">
                {setupError}
              </p>
            )}
            <button
              type="submit"
              disabled={isSettingUp}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 font-bold py-3.5 rounded-xl shadow-md transition-colors mt-2 flex justify-center items-center gap-2"
            >
              {isSettingUp ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                  Initializing...
                </>
              ) : setupStep === 1 ? (
                "Verify Mobile"
              ) : (
                "Complete Setup"
              )}
            </button>
            <button
              type="button"
              onClick={() => setExplicitView("login")}
              className="text-sm text-slate-500 hover:text-slate-800 underline block text-center w-full mt-4 font-semibold"
            >
              Already have an account? Login here
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (currentView === "recovery") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-slate-900 p-6 text-white flex items-center gap-4">
            <button
              onClick={() => setExplicitView("login")}
              className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                Account Recovery
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                Reset your secure password
              </p>
            </div>
          </div>

          <div className="p-8">
            {recoverySuccess ? (
              <div className="text-center py-8 animate-in fade-in">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-800">
                  Password Reset Successful
                </h3>
                <p className="text-slate-500 mt-2">
                  You can now login with your new password.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRecoverySubmit} className="space-y-6">
                {/* Step Progress */}
                <div className="flex gap-2 mb-6">
                  <div
                    className={`h-1.5 flex-1 rounded-full ${recoveryStep >= 1 ? "bg-amber-500" : "bg-slate-200"}`}
                  ></div>
                  <div
                    className={`h-1.5 flex-1 rounded-full ${recoveryStep >= 2 ? "bg-amber-500" : "bg-slate-200"}`}
                  ></div>
                  <div
                    className={`h-1.5 flex-1 rounded-full ${recoveryStep >= 3 ? "bg-amber-500" : "bg-slate-200"}`}
                  ></div>
                </div>

                {recoveryStep === 1 && (
                  <div className="space-y-4 animate-in slide-in-from-right-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                        Registered Mobile
                      </label>
                      <input
                        type="tel"
                        required
                        value={recoveryPhone}
                        onChange={(e) => setRecoveryPhone(e.target.value)}
                        placeholder="Enter your mobile number"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                )}

                {recoveryStep === 2 && (
                  <div className="space-y-4 animate-in slide-in-from-right-4">
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700 font-medium flex items-start gap-2 mb-4">
                      <span>
                        An OTP has been sent to {recoveryPhone}. <br />
                        <strong>(Hint: Use 123456)</strong>
                      </span>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                        Enter OTP
                      </label>
                      <input
                        type="text"
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="6-digit OTP"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 tracking-widest text-center text-lg"
                      />
                    </div>
                  </div>
                )}

                {recoveryStep === 3 && (
                  <div className="space-y-4 animate-in slide-in-from-right-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                        Set New Password
                      </label>
                      <input
                        type="password"
                        required
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 tracking-widest text-center text-lg"
                      />
                    </div>
                  </div>
                )}

                {recoveryError && (
                  <p className="text-sm text-red-600 font-medium text-center bg-red-50 p-2 rounded-lg">
                    {recoveryError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isRecovering}
                  className={`w-full ${isRecovering ? 'bg-amber-400 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600'} text-slate-900 font-bold py-3.5 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2`}
                >
                  {isRecovering ? (
                    <>
                      <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      {recoveryStep === 3 ? "Confirm Reset" : "Continue"}{" "}
                      <LogIn className="w-5 h-5 flex-shrink-0" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-500">
        <div className="bg-slate-900 p-8 text-center text-white">
          <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg border-2 border-slate-800">
            <HardHat className="w-8 h-8 text-slate-900" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">NIRMAAN</h1>
          <p className="text-slate-400 text-sm mt-2">
            Project Management System
          </p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                Mobile Number
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter registered mobile number"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-shadow"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setExplicitView("recovery");
                    setRecoveryStep(1);
                    setRecoveryError("");
                  }}
                  className="text-sm font-semibold text-amber-600 hover:text-amber-700 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-shadow tracking-widest text-lg"
              />
            </div>

            {errorMsg && (
              <p className="text-sm text-red-600 font-medium text-center bg-red-50 p-2 rounded-lg">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full ${isLoading ? 'bg-amber-400 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600'} text-slate-900 font-bold py-3.5 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 mt-4`}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                  Logging in...
                </div>
              ) : (
                <>Secure Login <LogIn className="w-5 h-5" /></>
              )}
            </button>

            <div className="mt-6 flex flex-col items-center gap-3 pt-6 border-t border-slate-100">
              <p className="text-sm text-slate-500">
                First time using Nirmaan?
              </p>
              <button
                type="button"
                onClick={() => {
                  setExplicitView("signup");
                  setSetupStep(1);
                  setSetupError("");
                }}
                className="text-amber-600 hover:text-amber-700 font-bold text-sm underline transition-colors"
              >
                Register your Construction Company
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
