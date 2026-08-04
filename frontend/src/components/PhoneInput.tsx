import React, { useState, useEffect } from "react";
import { Phone, AlertCircle, CheckCircle2 } from "lucide-react";

interface PhoneInputProps {
  value: string;
  onChange: (fullValue: string, digitsOnly: string, isValid: boolean) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
  className?: string;
}

export function sanitizeIndianPhone(input: string): string {
  if (!input) return "";
  let digits = input.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length > 10 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

export function isValidIndianMobile(digits: string): boolean {
  if (digits.length !== 10) return false;
  return /^[6-9]\d{9}$/.test(digits);
}

export function PhoneInput({
  value,
  onChange,
  label = "Phone Number",
  required = false,
  placeholder = "9876543210",
  error: externalError,
  className = ""
}: PhoneInputProps) {
  const initialDigits = sanitizeIndianPhone(value || "");
  const [digits, setDigits] = useState(initialDigits);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const extracted = sanitizeIndianPhone(value || "");
    setDigits(extracted);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    let cleaned = raw.replace(/\D/g, "").slice(0, 10);

    setDigits(cleaned);

    const fullPhone = cleaned ? `+91 ${cleaned}` : "";
    const isValid = isValidIndianMobile(cleaned);
    onChange(fullPhone, cleaned, isValid);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    const cleaned = sanitizeIndianPhone(pastedText);
    setDigits(cleaned);

    const fullPhone = cleaned ? `+91 ${cleaned}` : "";
    const isValid = isValidIndianMobile(cleaned);
    onChange(fullPhone, cleaned, isValid);
  };

  // Validation logic
  let validationMessage = "";
  let isValid = true;

  if (digits.length > 0) {
    if (!/^[6-9]/.test(digits[0])) {
      validationMessage = "Mobile number must start with 6, 7, 8, or 9";
      isValid = false;
    } else if (digits.length < 10) {
      validationMessage = `Enter 10 digits (${digits.length}/10)`;
      isValid = false;
    }
  } else if (required && touched) {
    validationMessage = "Phone number is required";
    isValid = false;
  }

  const displayError = externalError || (touched ? validationMessage : "");

  return (
    <div className={`space-y-1.5 font-sans ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {/* Fixed +91 Prefix Badge */}
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none select-none z-10">
          <Phone className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-extrabold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-mono">
            +91
          </span>
        </div>

        {/* 10-Digit Phone Input Field */}
        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          value={digits}
          onChange={handleChange}
          onPaste={handlePaste}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          className={`w-full h-11 pl-24 pr-10 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border rounded-xl text-xs font-mono font-bold tracking-wider text-slate-900 focus:outline-none transition shadow-2xs ${
            displayError
              ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              : digits.length === 10 && isValid
              ? "border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              : "border-slate-200 focus:ring-2 focus:ring-[#0F4FA8]/20 focus:border-[#0F4FA8]"
          }`}
        />

        {/* Real-time Status Icon */}
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
          {digits.length === 10 && isValid ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : displayError ? (
            <AlertCircle className="h-4 w-4 text-rose-500" />
          ) : null}
        </div>
      </div>

      {/* Real-time Validation Message */}
      {displayError ? (
        <p className="text-[11px] text-rose-500 font-semibold flex items-center gap-1">
          <span>{displayError}</span>
        </p>
      ) : digits.length === 10 && isValid ? (
        <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
          <span>Valid 10-digit Indian mobile number (+91 {digits})</span>
        </p>
      ) : (
        <p className="text-[11px] text-slate-400 font-normal">
          Fixed prefix +91 · 10-digit numeric mobile number starting with 6-9
        </p>
      )}
    </div>
  );
}

export default PhoneInput;
