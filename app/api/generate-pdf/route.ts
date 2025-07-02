import { type NextRequest, NextResponse } from "next/server"
import jsPDF from "jspdf"

export async function POST(request: NextRequest) {
  try {
    const { text, filename } = await request.json()

    // Créer un nouveau document PDF
    const doc = new jsPDF()

    // Configuration de la police et du style
    doc.setFont("helvetica", "normal")
    doc.setFontSize(12)

    // Titre du document
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    doc.text("Transcription Audio", 20, 20)

    // Nom du fichier source
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Fichier source: ${filename}`, 20, 30)
    doc.text(`Date: ${new Date().toLocaleDateString("fr-FR")}`, 20, 35)

    // Ligne de séparation
    doc.line(20, 40, 190, 40)

    // Contenu de la transcription
    doc.setFontSize(11)
    const splitText = doc.splitTextToSize(text, 170)
    doc.text(splitText, 20, 50)

    // Générer le PDF en tant que buffer
    const pdfBuffer = doc.output("arraybuffer")

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="transcription-${filename.replace(/\.[^/.]+$/, "")}.pdf"`,
      },
    })
  } catch (error) {
    console.error("Erreur lors de la génération du PDF:", error)
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 })
  }
}
