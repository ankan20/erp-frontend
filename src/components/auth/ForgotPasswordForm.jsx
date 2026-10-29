"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";

export default function ForgotPasswordForm() {
  const router = useRouter();

  // step 1 = enter login ID, step 2 = enter OTP + new password
  const [step, setStep] = useState(1);
  const [loginUserName, setLoginUserName] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendOtp(e) {
    e.preventDefault();
    if (!loginUserName.trim()) {
      toast.error("Please enter your Login ID");
      return;
    }
    try {
      setLoading(true);
      await apiRequest({
        url: API_ENDPOINTS.FORGOT_PASSWORD,
        method: "POST",
        data: { loginUserName: loginUserName.trim() },
        requireAuth: false,
      });
      toast.success("OTP sent to your WhatsApp number");
      setStep(2);
    } catch (err) {
      toast.error(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyAndReset(e) {
    e.preventDefault();
    if (!otp.trim()) {
      toast.error("Please enter the OTP");
      return;
    }
    if (!newPassword) {
      toast.error("Please enter a new password");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      setLoading(true);

      // step 2a: verify OTP → get reset token
      const verifyRes = await apiRequest({
        url: API_ENDPOINTS.VERIFY_OTP,
        method: "POST",
        data: { loginUserName: loginUserName.trim(), otp: otp.trim() },
        requireAuth: false,
      });
      const token = verifyRes?.data?.[0]?.reset_token;
      if (!token) throw new Error("OTP verification failed");

      // step 2b: reset password
      await apiRequest({
        url: API_ENDPOINTS.RESET_PASSWORD,
        method: "POST",
        data: { reset_token: token, new_password: newPassword },
        requireAuth: false,
      });

      toast.success("Password reset successfully. Please log in.");
      router.replace("/login");
    } catch (err) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#ececec] flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 space-y-6">
        <div>
          <h1 className="text-[28px] font-bold text-[#002b6f]">
            {step === 1 ? "Forgot Password" : "Reset Password"}
          </h1>
          <p className="text-[15px] text-gray-500 mt-1">
            {step === 1
              ? "Enter your Login ID and we'll send an OTP to your registered WhatsApp."
              : "Enter the OTP received on WhatsApp and set your new password."}
          </p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-[16px]">Login ID</Label>
              <Input
                value={loginUserName}
                onChange={(e) => setLoginUserName(e.target.value)}
                disabled={loading}
                placeholder="e.g. johndoe_E001"
                className="h-10 bg-white border-gray-400 text-[16px]"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 text-[18px] bg-[#6d98c9] hover:bg-[#5b88bc] rounded-md cursor-pointer"
            >
              {loading ? "Sending..." : "Send OTP"}
            </Button>

            <p className="text-center text-[14px] text-gray-500">
              Remember your password?{" "}
              <Link href="/login" className="text-[#6d98c9] hover:underline">
                Log in
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerifyAndReset} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-[16px]">OTP</Label>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={loading}
                placeholder="6-digit OTP from WhatsApp"
                maxLength={6}
                className="h-10 bg-white border-gray-400 text-[16px] tracking-widest"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[16px]">New Password</Label>
              <div className="relative">
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  className="h-10 bg-white border-gray-400 text-[16px] pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[16px]">Confirm Password</Label>
              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="h-10 bg-white border-gray-400 text-[16px] pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 text-[18px] bg-[#6d98c9] hover:bg-[#5b88bc] rounded-md cursor-pointer"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </Button>

            <p className="text-center text-[14px] text-gray-500">
              Didn&apos;t receive OTP?{" "}
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-[#6d98c9] hover:underline cursor-pointer"
              >
                Go back
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
