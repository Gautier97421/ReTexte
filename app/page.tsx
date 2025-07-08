"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Upload, FileAudio, Download, Loader2, Clock, Timer, Zap } from "lucide-react"
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
    processing_speed_mb_per_min?: number
  }
  metadata: {
    filename: string
    model: string
    device: string
    processing_mode: string
    file_size_mb?: number
  }
}

interface AsyncJob {
  job_id: string
  status: string
  progress?: number
  estimated_time_minutes?: number
  estimated_time_seconds?: number
  mode?: string
}

export default function TranscriptionApp() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<TranscriptionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState("fr")
  const [asyncJob, setAsyncJob] = useState<AsyncJob | null>(null)
  const [progress, setProgress] = useState(0)

  // États pour l'animation et le temps
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [estimatedTotalTime, setEstimatedTotalTime] = useState(0)
  const [remainingTime, setRemainingTime] = useState(0)
  const hasEstimatedRemainingTime = useRef(false)

  // Timer pour mettre à jour le temps écoulé
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isProcessing && startTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        setElapsedTime(elapsed)
        let remaining = remainingTime

        // Calculer le temps restant basé sur le progrès
        if (progress > 10) {
          const estimatedTotal = (elapsed / progress) * 100
          const remaining = Math.max(0, estimatedTotal - elapsed)
          setRemainingTime(Math.floor(remaining))
        } else if (estimatedTotalTime > 0) {
          // Utiliser l'estimation initiale si pas encore de progrès
          setRemainingTime(Math.max(0, estimatedTotalTime - elapsed))
        }
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isProcessing, startTime, progress, estimatedTotalTime])

  // Polling pour les jobs asynchrones
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isProcessing && startTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        setElapsedTime(elapsed)

        // Ne calculer remainingTime qu'une seule fois
        if (!hasEstimatedRemainingTime.current) {
          if (progress > 10) {
            const estimatedTotal = (elapsed / progress) * 100
            const remaining = Math.max(0, estimatedTotal - elapsed)
            setRemainingTime(Math.floor(remaining))
            hasEstimatedRemainingTime.current = true
          } else if (estimatedTotalTime > 0) {
            setRemainingTime(Math.max(0, estimatedTotalTime - elapsed))
            hasEstimatedRemainingTime.current = true
          }
        }
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isProcessing, startTime, progress, estimatedTotalTime])


  const calculateEstimatedTime = (fileSizeMB: number, isLarge: boolean) => {
    // Estimations plus réalistes pour modèle MEDIUM sur CPU
    if (isLarge) {
      // Gros fichiers: ~8MB par minute de traitement
      return Math.ceil(fileSizeMB / 8) * 60
    } else {
      // Petits fichiers: ~12MB par minute de traitement
      return Math.ceil(fileSizeMB / 12) * 60
    }
  }

  const processAudio = async (audioFile: File) => {
    setIsProcessing(true)
    setError(null)
    setResult(null)
    setProgress(0)
    setStartTime(Date.now())
    setElapsedTime(0)

    const fileSizeMB = audioFile.size / (1024 * 1024)
    const isLargeFile = fileSizeMB > 50 // Seuil réduit à 50MB

    // Calculer le temps estimé
    const estimated = calculateEstimatedTime(fileSizeMB, isLargeFile)
    setEstimatedTotalTime(estimated)
    setRemainingTime(estimated)

    try {
      const formData = new FormData()
      formData.append("file", audioFile)
      formData.append("language", language)

      console.log(`${isLargeFile ? "🐘 Gros fichier" : "🐁 Petit fichier"}: ${fileSizeMB.toFixed(1)}MB`)

      const response = await fetch("http://localhost:8000/transcribe", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || data.error || "Erreur de transcription")
      }

      if (data.job_id) {
        // Mode asynchrone
        setAsyncJob(data)
        if (data.estimated_time_seconds) {
          setEstimatedTotalTime(data.estimated_time_seconds)
          setRemainingTime(data.estimated_time_seconds)
        }
        console.log(`⏱️ Temps estimé: ${data.estimated_time_minutes} minutes`)
      } else {
        // Mode synchrone
        setResult(data)
        setIsProcessing(false)
        setProgress(100)
      }
    } catch (err: any) {
      setError(err.message)
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
      setAsyncJob(null)
      setProgress(0)
      setStartTime(null)
      setElapsedTime(0)
      setRemainingTime(0)
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
    setAsyncJob(null)
    setIsProcessing(false)
    setProgress(0)
    setStartTime(null)
    setElapsedTime(0)
    setRemainingTime(0)
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}h${mins.toString().padStart(2, "0")}m${secs.toString().padStart(2, "0")}s`
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const formatTimeSimple = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getFileSizeInfo = (file: File) => {
    const sizeMB = file.size / (1024 * 1024)
    const isLarge = sizeMB > 50 // Seuil réduit
    const estimatedMinutes = Math.ceil(sizeMB / (isLarge ? 8 : 12)) // Estimations plus réalistes

    return {
      sizeMB,
      isLarge,
      estimatedMinutes,
      mode: isLarge ? "Asynchrone (>50MB)" : "Synchrone (<50MB)",
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">ReTexte</h1>
          <p className="text-lg text-gray-600">Modèle de retranscription de fichier audio</p>
          <div className="flex items-center justify-center gap-2 mt-2">

          </div>
        </div>

        {/* Upload Zone avec animation */}
        {!file && !result && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Importer un fichier audio/vidéo
              </CardTitle>
              <CardDescription>
                Formats supportés: MP3, WAV, M4A, OGG, FLAC, MP4
                <br />
                <strong> Estimations réalistes</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all duration-300 ${
                  isDragActive
                    ? "border-blue-400 bg-blue-50 scale-105"
                    : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                }`}
              >
                <input {...getInputProps()} />
                <FileAudio className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                {isDragActive ? (
                  <p className="text-blue-600 text-lg font-medium">Déposez le fichier ici...</p>
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
                    <div className="text-sm text-gray-500">
                      <p>{getFileSizeInfo(file).sizeMB.toFixed(1)} MB</p>
                      <p
                        className={`font-medium ${getFileSizeInfo(file).isLarge ? "text-orange-600" : "text-green-600"}`}
                      >
                        {getFileSizeInfo(file).mode}
                      </p>
                      <p>⏱️ Estimation réaliste: ~{getFileSizeInfo(file).estimatedMinutes} minutes</p>
                    </div>
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
                    {/* <option value="en">Anglais</option>
                    <option value="es">Espagnol</option>
                    <option value="auto">Auto-détection</option> */}
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

        {/* Processing avec animation */}
        {file && isProcessing && (
          <Card className="mb-6 relative overflow-hidden">
            {/* Animation de bordure bleue */}
            <div className="absolute inset-0 rounded-lg">
              <div className="absolute inset-0 rounded-lg border-4 border-transparent bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-spin-slow opacity-20"></div>
              <div className="absolute inset-1 rounded-lg bg-white"></div>
            </div>

            <div className="relative z-10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  {asyncJob ? `Transcription ${asyncJob.status}...` : "Transcription en cours..."}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Informations de temps */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <Timer className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm text-gray-600">Temps écoulé</p>
                      <p className="font-mono text-lg font-bold text-green-600">{formatTimeSimple(elapsedTime)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">Temps de retranscription approximatif</p>
                      <p className="font-mono text-lg font-bold text-blue-600">
                        {getFileSizeInfo(file).estimatedMinutes}:00
                      </p>
                    </div>
                  </div>
                </div>

                {asyncJob ? (
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Job ID: {asyncJob.job_id.slice(0, 8)}...</span>
                      <span className="font-mono font-bold">{progress}%</span>
                    </div>
                    <div className="relative">
                      <Progress value={progress} className="w-full h-4" />
                      <div
                        className="absolute top-0 left-0 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-1000 ease-out opacity-30"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    {asyncJob.estimated_time_minutes && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>Estimation: ~{asyncJob.estimated_time_minutes} minutes (modèle Medium)</span>
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-sm text-gray-500">💡 Progression mise à jour en temps réel</p>
                      {progress > 20 && progress < 95 && (
                        <p className="text-xs text-blue-600 mt-1">🔄 Transcription en cours...</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <Progress value={progress} className="w-full h-4" />
                      <div
                        className="absolute top-0 left-0 h-4 bg-gradient-to-r from-green-500 to-blue-500 rounded-full transition-all duration-500 ease-out opacity-40"
                        style={{ width: `${Math.min(progress, 90)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-center py-4">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        <span className="text-gray-600">Traitement optimisé en cours...</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </div>
          </Card>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-green-800">
                  ✅ Transcription terminée
                  <Button onClick={generatePDF} className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Télécharger PDF
                  </Button>
                </CardTitle>
                <CardDescription>
                  <div className="flex gap-4 text-sm text-green-700 flex-wrap">
                    <span>📁 {result.metadata.filename}</span>
                    <span>🌍 {result.info.language}</span>
                    <span>⏱️ {formatTime(result.info.duration)}</span>
                    {result.info.processing_speed_mb_per_min && (
                      <span>🚀 {result.info.processing_speed_mb_per_min.toFixed(1)}MB/min</span>
                    )}
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-white rounded-lg p-4 max-h-96 overflow-y-auto border">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">{result.text}</pre>
                </div>
              </CardContent>
            </Card>

            <div className="text-center">
              <Button variant="outline" onClick={resetApp} className="px-8 bg-transparent">
                Transcrire un autre fichier
              </Button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-600 text-center font-medium">{error}</p>
              {error.includes("Timeout") && (
                <div className="mt-4 text-sm text-gray-600">
                  <p>
                    <strong>Solutions:</strong>
                  </p>
                  <ul className="list-disc list-inside mt-2">
                    <li>Le modèle Medium est plus rapide que Large-v3</li>
                    <li>Découpez votre fichier en segments plus courts</li>
                    <li>Utilisez un format compressé (MP3 au lieu de WAV)</li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Styles CSS pour l'animation */}
      <style jsx>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  )
}
