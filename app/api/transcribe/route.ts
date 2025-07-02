import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const language = (formData.get("language") as string) || "fr"

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 })
    }

    // Envoyer au serveur Python
    const apiFormData = new FormData()
    apiFormData.append("file", file)
    apiFormData.append("language", language)

    const response = await fetch("http://localhost:8000/transcribe", {
      method: "POST",
      body: apiFormData,
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json({ error: error.detail || "Erreur de transcription" }, { status: response.status })
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Erreur transcription:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
