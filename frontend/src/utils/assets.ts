import loginNobg from "../assets/login-nobg.png";
import loginImg from "../assets/login.png";
import logoHorizontal from "../assets/logo-horizontal.png";
import logoSquare from "../assets/logo-square.png";
import heroImg from "../assets/hero.png";
import bikeImg from "../assets/bike.png";

export const assets = {
  loginNobg,
  loginImg,
  logoHorizontal,
  logoSquare,
  heroImg,
  bikeImg,
};

/**
 * Production-safe asset URL resolver for Electron file:// protocol and Vite web environments.
 * Maps image paths to bundled Vite ESM assets so they resolve 100% reliably in dev and .exe builds.
 */
export function getAssetUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("data:") || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const cleanPath = path.replace(/^\/+/, "");

  if (cleanPath === "login-nobg.png") return loginNobg;
  if (cleanPath === "login.png") return loginImg;
  if (cleanPath === "logo-horizontal.png") return logoHorizontal;
  if (cleanPath === "logo-square.png") return logoSquare;
  if (cleanPath === "hero.png") return heroImg;
  if (cleanPath === "bike.png") return bikeImg;

  return `./${cleanPath}`;
}
