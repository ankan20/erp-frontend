"use client";

import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LoginForm = () => {
  const [formData, setFormData] = useState({
    loginId: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));

    if (errorMessage) setErrorMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.loginId || !formData.password) {
      setErrorMessage("Login ID and Password are required.");
      toast.error("Please fill all fields");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      // TODO: backend login API call here
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success("Login successful");
    } catch (error) {
      // TODO: backend error handling here
      setErrorMessage("Invalid login credentials");
      toast.error("Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#ececec] flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-[1400px] grid lg:grid-cols-[1fr_1.35fr] gap-8 items-center">
        {/* LEFT SIDE */}
        <div className="space-y-10">
          <div className="space-y-2">
            <p className="text-[#0c3472] text-[28px] font-medium">Welcome to</p>

            <div className="leading-none">
              <h1 className="text-[72px] font-black tracking-tight text-[#002b6f]">
                PRAX
              </h1>

              <div className="flex items-end gap-3 flex-wrap">
                <p className="text-[30px] font-black tracking-tight text-black">
                  CONSTRUCTION
                </p>
                <p className="text-[30px] font-black text-red-600">ERP</p>
              </div>
            </div>

            <p className="text-[22px] text-black pt-2">
              Company Name:{" "}
              <span className="font-semibold">
                Dishaan Hi-tech (India) Pvt. Ltd.
              </span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="max-w-[520px]">
            <div className="space-y-6">
              <div className="grid grid-cols-[170px_1fr] items-center gap-4">
                <Label className="text-[22px] font-normal">Log in ID</Label>
                <Input
                  name="loginId"
                  value={formData.loginId}
                  onChange={handleChange}
                  className="h-12 bg-white border-gray-400 text-[20px] font-medium"
                />
              </div>

              <div className="grid grid-cols-[170px_1fr] items-center gap-4">
                <Label className="text-[22px] font-normal">Password</Label>
                <Input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="h-12 bg-white border-gray-400 text-[20px] font-medium"
                />
              </div>
            </div>

            {errorMessage && (
              <p className="text-red-500 text-sm mt-3">{errorMessage}</p>
            )}

            <div className="flex justify-end pt-8">
              <Button
                type="submit"
                disabled={loading}
                className="w-40 h-12 text-[26px] bg-[#6d98c9] hover:bg-[#5b88bc] rounded-md cursor-pointer"
              >
                {loading ? "..." : "Log in"}
              </Button>
            </div>
          </form>
        </div>

        {/* RIGHT SIDE */}
        <div className="relative">
          <div className="relative rounded-[50px] overflow-hidden">
            <Image
              src="/assets/login.png"
              alt="Construction ERP"
              width={1000}
              height={700}
              priority
              className="w-full h-auto object-cover"
            />

            {/* SMALL LOGO */}
            <div className="absolute top-6 right-6 z-20  px-3 py-2 rounded-md ">
              <Image
                src="/assets/company_logo.png"
                alt="Company Logo"
                width={220}
                height={80}
                priority
                className="w-auto h-auto"
              />
            </div>
          </div>

          <p className="text-center mt-6 text-[18px] font-medium">
            Developed by : Inmedia Technology Pvt. Ltd.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
