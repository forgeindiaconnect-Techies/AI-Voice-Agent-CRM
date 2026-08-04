import { motion, HTMLMotionProps } from "framer-motion";

interface CustomPauseIconProps extends Omit<HTMLMotionProps<"div">, "children"> {
  size?: number;
  className?: string;
}

export function CustomPauseIcon({ size = 36, className = "", ...props }: CustomPauseIconProps) {
  const gradientId = "forgePauseGradient";
  const shadowFilterId = "forgePauseShadow";

  return (
    <motion.div
      whileHover={{ scale: 1.08, filter: "drop-shadow(0 4px 12px rgba(37, 99, 235, 0.4))" }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`inline-flex items-center justify-center cursor-pointer select-none shrink-0 ${className}`}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          {/* Soft Blue Gradient (#2563EB → #60A5FA) */}
          <linearGradient id={gradientId} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#60A5FA" />
          </linearGradient>

          {/* Subtle Glow & Drop Shadow Filter */}
          <filter id={shadowFilterId} x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#2563EB" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Rounded Square Container with Soft Blue Gradient & Rounded Corners */}
        <rect
          x="2"
          y="2"
          width="36"
          height="36"
          rx="10"
          fill={`url(#${gradientId})`}
          filter={`url(#${shadowFilterId})`}
        />

        {/* Subtle Inner Duotone Glass Highlight */}
        <rect
          x="3"
          y="3"
          width="34"
          height="34"
          rx="9"
          stroke="white"
          strokeOpacity="0.25"
          strokeWidth="1"
          fill="none"
        />

        {/* Crisp Dual Vertical Pause Bars */}
        <rect x="14" y="12" width="4" height="16" rx="2" fill="white" />
        <rect x="22" y="12" width="4" height="16" rx="2" fill="white" />
      </svg>
    </motion.div>
  );
}

export default CustomPauseIcon;
