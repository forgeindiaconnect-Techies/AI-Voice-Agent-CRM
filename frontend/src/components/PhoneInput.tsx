import React, { useState, useEffect, useRef } from "react";
import { Phone, AlertCircle, CheckCircle2 } from "lucide-react";

interface PhoneInputProps {
  value?: string;
  onChange: (fullValue: string, mobileNumber: string, isValid: boolean) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
  className?: string;
  inputClassName?: string;
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
  className = "",
  inputClassName = ""
}: PhoneInputProps) {
  const countryCode = "+91";
  
  // Extract initial 10-digit mobile number from value prop
  const [mobileNumber, setMobileNumber] = useState(() => sanitizeIndianPhone(value));
  const [touched, setTouched] = useState(false);
  const lastValuePropRef = useRef(value);

  // Synchronize from parent value prop ONLY if parent passed an externally changed value
  useEffect(() => {
    const currentFull = mobileNumber ? `${countryCode}${mobileNumber}` : "";
    if (value !== lastValuePropRef.current && value !== currentFull) {
      const extracted = sanitizeIndianPhone(value);
      setMobileNumber(extracted);
      lastValuePropRef.current = value;
    }
  }, [value, mobileNumber]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    // Allow only numeric digits and max 10 chars
    const cleaned = rawVal.replace(/\D/g, "").slice(0, 10);

    setMobileNumber(cleaned);

    const isValid = isValidIndianMobile(cleaned);
    const fullValue = cleaned ? `${countryCode}${cleaned}` : "";
    lastValuePropRef.current = fullValue;
    onChange(fullValue, cleaned, isValid);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    const cleaned = sanitizeIndianPhone(pastedText);

    setMobileNumber(cleaned);

    const isValid = isValidIndianMobile(cleaned);
    const fullValue = cleaned ? `${countryCode}${cleaned}` : "";
    lastValuePropRef.current = fullValue;
    onChange(fullValue, cleaned, isValid);
  };

  // Validation logic
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
  const showError = displayError;

  return (
    <div className={`flex flex-col gap-1 w-full text-left font-sans ${className}`}>
      {label && (
        <label className="text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
          {label} {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {/* Fixed Non-editable Country Code Badge + Icon */}
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none select-none z-10">
          <Phone className="h-3.5 w-3.5 text-[#64748B] dark:text-slate-500" />
          <span className="text-[11px] font-bold text-[#0F172A] dark:text-[#F8FAFC] bg-[#F1F5F9] dark:bg-slate-800 border border-[#D9E2EC] dark:border-slate-700 px-1.5 py-0.5 rounded-[6px] font-mono">
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
          onChange={handleInputChange}
          onPaste={handlePaste}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          className={`w-full pl-[76px] pr-10 bg-white dark:bg-[#09111E] border rounded-[10px] text-[15px] font-medium text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] dark:placeholder-slate-600 focus:outline-none transition-colors duration-150 hover:border-[#2563EB] ${
            inputClassName || "h-[46px]"
          } ${
            showError
              ? "border-rose-500 focus:ring-2 focus:ring-rose-500/15 focus:border-rose-500"
              : isValid
              ? "border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500"
              : "border-[#D9E2EC] dark:border-slate-700/80 focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB]"
          }`}
        />

        {/* Real-time Status Icon */}
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
          {isValid ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : showError ? (
            <AlertCircle className="h-4 w-4 text-rose-500" />
          ) : null}
        </div>
      </div>

      {/* Real-time Validation Message - Displayed only below field */}
      {showError && (
        <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1">
          <AlertCircle className="h-[11px] w-[11px] shrink-0" />
          <span>{showError}</span>
        </p>
      )}
    </div>
  );
}

export default PhoneInput;
