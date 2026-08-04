import React, { useState, useEffect } from "react";
import { Phone, AlertCircle, CheckCircle2 } from "lucide-react";

interface PhoneInputProps {
  value?: string;
  onChange: (fullValue: string, mobileNumber: string, isValid: boolean) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
  className?: string;
}

export function sanitizeIndianPhone(input: string): string {
  if (!input) return "";
  let digits = input.replace(/\D/g, "");
  // Handle duplicate or embedded country code / leading zeros
  while (digits.length > 10) {
    if (digits.startsWith("91")) {
      digits = digits.slice(2);
    } else if (digits.startsWith("0")) {
      digits = digits.slice(1);
    } else {
      break;
    }
  }
  return digits.slice(0, 10);
}

export function isValidIndianMobile(mobileNumber: string): boolean {
  return /^[6-9]\d{9}$/.test(mobileNumber);
}

export function PhoneInput({
  value = "",
  onChange,
  label = "Phone Number",
  required = false,
  placeholder = "9876543210",
  error: externalError,
  className = ""
}: PhoneInputProps) {
  const countryCode = "+91";
  const [mobileNumber, setMobileNumber] = useState(() => sanitizeIndianPhone(value));
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const extracted = sanitizeIndianPhone(value);
    setMobileNumber(extracted);
  }, [value]);

  const updatePhone = (newRawNumber: string) => {
    const cleaned = sanitizeIndianPhone(newRawNumber);
    setMobileNumber(cleaned);

    const isValid = isValidIndianMobile(cleaned);
    const fullValue = cleaned ? `${countryCode}${cleaned}` : "";
    onChange(fullValue, cleaned, isValid);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updatePhone(e.target.value);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    updatePhone(pastedText);
  };

  // Validation state calculation
  const isValid = isValidIndianMobile(mobileNumber);
  let validationMessage = "";

  if (mobileNumber.length > 0) {
    if (!/^[6-9]/.test(mobileNumber[0])) {
      validationMessage = "Mobile number must start with 6, 7, 8, or 9";
    } else if (mobileNumber.length < 10) {
      validationMessage = `Enter 10 digits (${mobileNumber.length}/10)`;
    }
  } else if (required && touched) {
    validationMessage = "Phone number is required";
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
        {/* Fixed Non-editable Country Code Badge + Icon */}
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none select-none z-10">
          <Phone className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-extrabold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-mono">
            {countryCode}
          </span>
        </div>

        {/* 10-Digit Mobile Number Input Field */}
        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          value={mobileNumber}
          onChange={handleChange}
          onPaste={handlePaste}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          className={`w-full h-11 pl-24 pr-10 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border rounded-xl text-xs font-mono font-bold tracking-wider text-slate-900 focus:outline-none transition shadow-2xs ${
            displayError
              ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              : isValid
              ? "border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              : "border-slate-200 focus:ring-2 focus:ring-[#0F4FA8]/20 focus:border-[#0F4FA8]"
          }`}
        />

        {/* Real-time Status Icon */}
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
          {isValid ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : displayError ? (
            <AlertCircle className="h-4 w-4 text-rose-500" />
          ) : null}
        </div>
      </div>

      {/* Real-time Validation / Success Message */}
      {displayError ? (
        <p className="text-[11px] text-rose-500 font-semibold flex items-center gap-1">
          <span>{displayError}</span>
        </p>
      ) : isValid ? (
        <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
          <span>Valid 10-digit Indian mobile number ({countryCode} {mobileNumber})</span>
        </p>
      ) : null}
    </div>
  );
}

export default PhoneInput;
