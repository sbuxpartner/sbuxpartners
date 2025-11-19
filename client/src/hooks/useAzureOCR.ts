import { useState } from 'react';

interface AzureOCRConfig {
    endpoint: string;
    apiKey: string;
}

export interface OCRResult {
    text: string;
    confidence: number;
}

export function useAzureOCR() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const analyzeImage = async (file: File, config: AzureOCRConfig): Promise<OCRResult> => {
        setIsLoading(true);
        setError(null);

        try {
            // 1. Read file
            const arrayBuffer = await file.arrayBuffer();

            // 2. Submit to Azure
            // Ensure endpoint doesn't have trailing slash
            const endpoint = config.endpoint.replace(/\/$/, '');
            const analyzeUrl = `${endpoint}/vision/v3.2/read/analyze`;

            const submitResponse = await fetch(analyzeUrl, {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': config.apiKey,
                    'Content-Type': 'application/octet-stream',
                },
                body: arrayBuffer,
            });

            if (!submitResponse.ok) {
                const errorText = await submitResponse.text();
                throw new Error(`Azure API error: ${submitResponse.status} ${submitResponse.statusText} - ${errorText}`);
            }

            const operationLocation = submitResponse.headers.get('Operation-Location');
            if (!operationLocation) {
                throw new Error('No Operation-Location header in response');
            }

            // 3. Poll for results
            let attempts = 0;
            const maxAttempts = 30;
            let result = null;

            while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const resultResponse = await fetch(operationLocation, {
                    headers: {
                        'Ocp-Apim-Subscription-Key': config.apiKey,
                    },
                });

                if (!resultResponse.ok) {
                    throw new Error(`Azure result error: ${resultResponse.status}`);
                }

                const data = await resultResponse.json();
                if (data.status === 'succeeded') {
                    result = data;
                    break;
                } else if (data.status === 'failed') {
                    throw new Error('Azure processing failed');
                }

                attempts++;
            }

            if (!result) {
                throw new Error('Timeout waiting for Azure results');
            }

            // 4. Extract text
            const readResults = result.analyzeResult?.readResults || [];
            let extractedText = '';
            let totalConfidence = 0;
            let lineCount = 0;

            for (const page of readResults) {
                for (const line of page.lines) {
                    extractedText += line.text + '\n';
                    // Calculate rough confidence if available, otherwise default to high
                    // Azure Read API v3.2 structure:
                    // line.appearance (style)
                    // line.words (list of words with confidence)
                    if (line.words) {
                        const lineConf = line.words.reduce((sum: number, word: any) => sum + (word.confidence || 1), 0) / line.words.length;
                        totalConfidence += lineConf;
                        lineCount++;
                    }
                }
            }

            const confidence = lineCount > 0 ? (totalConfidence / lineCount) * 100 : 100;

            return {
                text: extractedText,
                confidence
            };

        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(msg);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    return { analyzeImage, isLoading, error };
}
