import axios from "axios";

export const getApiError = (error: unknown, fallback: string): string => {
  if (Array.isArray(error)) return error.join(" ");

  if (axios.isAxiosError(error)) {
    if (error.response?.status === 429) {
      return "Çok fazla deneme yaptınız. Lütfen biraz bekleyin.";
    }
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (message) return message;
  }

  return fallback;
};