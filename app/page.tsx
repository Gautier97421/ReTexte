"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, FileAudio, Download, Loader2 } from "lucide-react"
import { useDropzone } from "react-dropzone"

interface TranscriptionResult {
  text: string
  segments: Array<{
    start: number
    end: number
    text: string
  }>
  info: {
    language: string
    duration: number
    processing_time: number
    speed_ratio: number
  }
  metadata: {
    filename: string
    model: string
    device: string
  }
}

export default function TranscriptionApp() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<TranscriptionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState("fr")

  const processAudio = async (audioFile: File) => {
    setIsProcessing(true)
    setError(null)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000) // 10 minutes

      const formData = new FormData()
      formData.append("file", audioFile)
      formData.append("language", language)

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || "Erreur de transcription")
      }

      const data = await response.json()
      setResult(data)
    } catch (err: any) {
      if (err.name === "AbortError") {
        setError("Le délai d'attente de la transcription a été dépassé.")
      } else {
        setError(err.message)
      }
    } finally {
      setIsProcessing(false)
    }
  }


  const generatePDF = async () => {
    if (!result) return

    try {
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: result.text,
          filename: result.metadata.filename,
          segments: result.segments,
        }),
      })

      if (!response.ok) throw new Error("Erreur génération PDF")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `transcription-${result.metadata.filename.replace(/\.[^/.]+$/, "")}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError("Erreur lors de la génération du PDF")
    }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const audioFile = acceptedFiles[0]
    if (audioFile) {
      setFile(audioFile)
      setResult(null)
      setError(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "audio/*": [".mp3", ".wav", ".m4a", ".ogg", ".flac"],
      "video/*": [".mp4"],
    },
    maxFiles: 1,
  })

  const resetApp = () => {
    setFile(null)
    setResult(null)
    setError(null)
    setIsProcessing(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">ReTexte</h1>
          <p className="text-lg text-gray-600">Transformez vos fichiers audio en PDF transcrit</p>
        </div>

        {/* Upload Zone */}
        {!file && !result && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Importer un fichier audio
              </CardTitle>
              <CardDescription>Formats supportés: MP3, WAV, M4A, OGG, FLAC, MP4</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-24 text-center cursor-pointer transition-colors ${
                  isDragActive ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <input {...getInputProps()} />
                <FileAudio className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                {isDragActive ? (
                  <p className="text-blue-600 text-lg">Déposez le fichier ici...</p>
                ) : (
                  <div>
                    <p className="text-gray-600 text-lg mb-2">Glissez-déposez votre fichier ici</p>
                    <p className="text-sm text-gray-500">ou cliquez pour sélectionner</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* File Selected */}
        {file && !result && !isProcessing && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Fichier sélectionné</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <FileAudio className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 items-center mb-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Langue:</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="border rounded px-2 py-1"
                  >
                    <option value="fr">Français</option>
                    <option value="en">Anglais</option>
                    <option value="es">Espagnol</option>
                    <option value="auto">Auto-détection</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={resetApp}>
                  Annuler
                </Button>
                <Button onClick={() => processAudio(file)}>Commencer la transcription</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Processing */}
        {isProcessing && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Transcription en cours...
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Transcription terminée
                  <Button onClick={generatePDF} className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Télécharger PDF
                  </Button>
                </CardTitle>
                <CardDescription>
                  <div className="flex gap-4 text-sm">
                    <span>Fichier: {result.metadata.filename}</span>
                    <span>Langue: {result.info.language}</span>
                    <span>Durée: {formatTime(result.info.duration)}</span>
                    <span>Vitesse: {result.info.speed_ratio.toFixed(1)}x</span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">{result.text}</pre>
                </div>
              </CardContent>
            </Card>

            <div className="text-center">
              <Button variant="outline" onClick={resetApp}>
                Transcrire un autre fichier
              </Button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-600 text-center">{error}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
