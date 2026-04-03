export const translateBatch = async (
  apiBaseUrl: string,
  token: string,
  texts: string[],
  targetLanguage: string,
  sourceLanguage = "en"
): Promise<string[]> => {
  if (!texts.length || targetLanguage === "en") {
    return texts;
  }

  const CHUNK_SIZE = 200;
  const translated: string[] = [];

  for (let index = 0; index < texts.length; index += CHUNK_SIZE) {
    const chunk = texts.slice(index, index + CHUNK_SIZE);

    const response = await fetch(`${apiBaseUrl}/translations/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        texts: chunk,
        targetLanguage,
        sourceLanguage,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to translate content");
    }

    const data = await response.json();
    const chunkTranslations = Array.isArray(data.translations) ? data.translations : chunk;
    translated.push(...chunkTranslations);
  }

  return translated.length === texts.length ? translated : texts;
};
