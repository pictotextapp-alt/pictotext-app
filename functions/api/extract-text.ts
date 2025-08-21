export const onRequest = async (context: any) => {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Parse form data (file upload)
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const useFiltering = formData.get('useFiltering') === 'true';
    
    if (!file) {
      return new Response(JSON.stringify({ error: "No image file provided" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if OCR API key is available
    if (!env.OCRSPACE_API_KEY) {
      return new Response(JSON.stringify({ 
        error: "OCR service is not available. Please check OCR_SPACE_API_KEY configuration." 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // TODO: Add usage tracking logic here
    // For now, we'll just process the OCR request

    // Convert file to buffer
    const buffer = await file.arrayBuffer();
    
    // Call OCR.space API
    const ocrFormData = new FormData();
    ocrFormData.append('file', new Blob([buffer]), file.name);
    ocrFormData.append('apikey', env.OCRSPACE_API_KEY);
    ocrFormData.append('language', 'eng');
    ocrFormData.append('isOverlayRequired', 'true');
    
    if (useFiltering) {
      ocrFormData.append('isCreateSearchablePdf', 'false');
      ocrFormData.append('isSearchablePdfHideTextLayer', 'false');
    }

    const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: ocrFormData
    });

    if (!ocrResponse.ok) {
      throw new Error(`OCR API error: ${ocrResponse.status}`);
    }

    const ocrResult = await ocrResponse.json();
    
    if (ocrResult.IsErroredOnProcessing) {
      throw new Error(ocrResult.ErrorMessage || 'OCR processing failed');
    }

    // Extract text from OCR result
    const extractedText = ocrResult.ParsedResults?.[0]?.ParsedText || '';
    const confidence = ocrResult.ParsedResults?.[0]?.TextOverlay?.HasOverlay ? 
      (ocrResult.ParsedResults[0].TextOverlay.Lines?.[0]?.MaxHeight || 0) : 0;

    // Return result in multiple formats for compatibility
    const result = {
      text: extractedText,
      extractedText: extractedText,
      result: extractedText,
      content: extractedText,
      words: ocrResult.ParsedResults?.[0]?.TextOverlay?.Lines || [],
      confidence: confidence || 0,
      success: true
    };

    return new Response(JSON.stringify(result), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error: any) {
    console.error("OCR processing error:", error);
    
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to process image",
      success: false
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
