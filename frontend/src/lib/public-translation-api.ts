const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export const translatePublicBatch = async (
  texts: string[],
  targetLanguage: string,
  sourceLanguage = "en"
): Promise<string[]> => {
  if (!texts.length || targetLanguage === "en") {
    return texts;
  }

  const response = await fetch(`${apiBaseUrl}/public/translations/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      texts,
      targetLanguage,
      sourceLanguage,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to translate content");
  }

  const data = await response.json();
  return Array.isArray(data.translations) ? data.translations : texts;
};
