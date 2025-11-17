'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Download } from 'lucide-react'

export default function DocumentComposerPage() {
  const router = useRouter()
  const [guideId, setGuideId] = useState('')
  const [style, setStyle] = useState('professional')
  const [document, setDocument] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCompose = async () => {
    if (!guideId) {
      alert('Please enter a guide ID')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      
      // Fetch guide
      const guideResponse = await fetch(
        `http://localhost:3001/api/guides/${guideId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      const guide = await guideResponse.json()

      // Compose document
      const response = await fetch('http://localhost:8000/documents/compose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guideId,
          steps: guide.steps,
          style,
        }),
      })
      const data = await response.json()
      setDocument(data.document)
    } catch (error) {
      console.error('Failed to compose document:', error)
      alert('Failed to compose document')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">AI Document Composer</h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Guide ID</label>
            <input
              type="text"
              value={guideId}
              onChange={(e) => setGuideId(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="Enter guide ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Style</label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
            >
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="technical">Technical</option>
              <option value="beginner-friendly">Beginner Friendly</option>
            </select>
          </div>

          <button
            onClick={handleCompose}
            disabled={loading}
            className="flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <Sparkles className="w-5 h-5" />
            {loading ? 'Composing...' : 'Compose Document'}
          </button>
        </div>
      </div>

      {document && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Generated Document</h2>
            <button
              onClick={() => {
                const blob = new Blob([document], { type: 'text/markdown' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'document.md'
                a.click()
              }}
              className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              <Download className="w-5 h-5" />
              Download
            </button>
          </div>
          <div className="prose max-w-none">
            <pre className="whitespace-pre-wrap text-sm">{document}</pre>
          </div>
        </div>
      )}
    </div>
  )
}



