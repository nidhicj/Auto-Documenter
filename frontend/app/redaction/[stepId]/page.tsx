'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Save, Eye } from 'lucide-react'
import Image from 'next/image'

interface RedactionData {
  ocr: {
    text: string
    confidence: number
  }
  pii: {
    entities: Array<{
      type: string
      value: string
      confidence: number
    }>
    blurredRegions: Array<{
      x: number
      y: number
      width: number
      height: number
      type: string
    }>
  }
}

export default function RedactionPage() {
  const params = useParams()
  const [redactionData, setRedactionData] = useState<RedactionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [screenshotUri, setScreenshotUri] = useState<string>('')

  useEffect(() => {
    fetchRedactionData()
  }, [params.stepId])

  const fetchRedactionData = async () => {
    try {
      const token = localStorage.getItem('token')
      // First get step to get screenshot URI
      const stepResponse = await fetch(
        `http://localhost:3001/api/guides/steps/${params.stepId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      const step = await stepResponse.json()
      setScreenshotUri(step.screenshotUri)

      // Process redaction
      const response = await fetch('http://localhost:3001/api/redaction/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stepId: params.stepId,
          screenshotUri: step.screenshotUri,
        }),
      })
      const data = await response.json()
      setRedactionData(data)
    } catch (error) {
      console.error('Failed to fetch redaction data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyRedaction = async () => {
    if (!redactionData) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:3001/api/redaction/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          screenshotUri,
          blurredRegions: redactionData.pii.blurredRegions,
        }),
      })
      const data = await response.json()
      alert('Redaction applied! New URI: ' + data.redactedUri)
    } catch (error) {
      console.error('Failed to apply redaction:', error)
    }
  }

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Processing...</div>
  }

  if (!redactionData) {
    return <div className="container mx-auto px-4 py-8">No redaction data</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Redaction Editor</h1>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Screenshot</h2>
          {screenshotUri && (
            <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden mb-4">
              <Image
                src={screenshotUri}
                alt="Screenshot"
                fill
                className="object-contain"
              />
            </div>
          )}

          <button
            onClick={handleApplyRedaction}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
          >
            <Save className="w-5 h-5" />
            Apply Redaction
          </button>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Detected PII</h2>
          <div className="bg-white rounded-lg shadow-md p-6 mb-4">
            <div className="space-y-2">
              {redactionData.pii.entities.map((entity, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-red-50 rounded">
                  <div>
                    <span className="font-semibold">{entity.type}</span>
                    <span className="text-gray-600 ml-2">{entity.value}</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {(entity.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-4">OCR Text</h2>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {redactionData.ocr.text || 'No text detected'}
            </p>
            <div className="mt-2 text-xs text-gray-500">
              Confidence: {(redactionData.ocr.confidence * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



