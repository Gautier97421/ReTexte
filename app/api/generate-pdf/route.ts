import { type NextRequest, NextResponse } from "next/server"
import jsPDF from "jspdf"

export async function POST(request: NextRequest) {
  try {
    const { text, filename } = await request.json()

    const doc = new jsPDF()

    // Configuration
    const lineHeight = 7
    const marginLeft = 20
    const marginRight = 20
    const pageHeight = doc.internal.pageSize.height
    let currentY = 50

    doc.setFont("helvetica", "normal")
    doc.setFontSize(12)

    // Titre
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    doc.text("Transcription Audio", marginLeft, 20)

    // Fichier et date
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Fichier source: ${filename}`, marginLeft, 30)
    doc.text(`Date: ${new Date().toLocaleDateString("fr-FR")}`, marginLeft, 35)

    // Ligne de séparation
    doc.line(marginLeft, 40, 190, 40)

    // Contenu de la transcription
    doc.setFontSize(11)
    const splitText = doc.splitTextToSize(text, 170)

    for (const line of splitText) {
      if (currentY > pageHeight - 20) {
        doc.addPage()
        currentY = 20
      }
      doc.text(line, marginLeft, currentY)
      currentY += lineHeight
    }

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
