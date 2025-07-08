import { type NextRequest, NextResponse } from "next/server"

// Timeout étendu pour gros fichiers
export const maxDuration = 3600 // 1 heure
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const language = (formData.get("language") as string) || "fr"

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 })
    }

    // Vérifier la taille du fichier
    const fileSizeMB = file.size / (1024 * 1024)
    console.log(`📁 Fichier: ${file.name} (${fileSizeMB.toFixed(1)}MB)`)

    // Pour les gros fichiers (>100MB ou >30min estimé), utiliser le mode asynchrone
    const isLargeFile = fileSizeMB > 100

    // Préparer les données pour l'API Python
    const apiFormData = new FormData()
    apiFormData.append("file", file)
    apiFormData.append("language", language)
    apiFormData.append("async", isLargeFile.toString())

    // Endpoint selon la taille
    const endpoint = isLargeFile ? "/transcribe/async" : "/transcribe"

    console.log(`🎵 ${isLargeFile ? "Mode asynchrone" : "Mode synchrone"} pour ${file.name}`)

    // Timeout personnalisé selon la taille du fichier
    const timeoutMs = isLargeFile ? 3600000 : 600000 // 1h pour gros, 10min pour petits

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`http://localhost:8000${endpoint}`, {
        method: "POST",
        body: apiFormData,
        signal: controller.signal,
        // Headers pour éviter les timeouts
        headers: {
          Connection: "keep-alive",
          "Keep-Alive": "timeout=3600",
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const error = await response.json()
        return NextResponse.json(
          {
            error: error.detail || "Erreur de transcription",
          },
          { status: response.status },
        )
      }

      const result = await response.json()
      return NextResponse.json(result)
    } catch (fetchError: any) {
      clearTimeout(timeoutId)

      if (fetchError.name === "AbortError") {
        return NextResponse.json(
          {
            error: `Timeout dépassé. Fichier trop volumineux (${fileSizeMB.toFixed(1)}MB). Essayez de découper le fichier.`,
          },
          { status: 408 },
        )
      }

      throw fetchError
    }
  } catch (error: any) {
    console.error("Erreur transcription:", error)

    // Messages d'erreur spécifiques
    if (error.code === "UND_ERR_HEADERS_TIMEOUT") {
      return NextResponse.json(
        {
          error: "Timeout: Le fichier est trop long. Utilisez le mode asynchrone ou découpez le fichier.",
        },
        { status: 408 },
      )
    }

    return NextResponse.json(
      {
        error: `Erreur serveur: ${error.message}`,
      },
      { status: 500 },
    )
  }
}
