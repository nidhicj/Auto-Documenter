'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, Eye, Download } from 'lucide-react'
import StepEditor from '@/components/StepEditor'

interface Guide {
  id: string
  title: string
  description: string
  steps: Step[]
}

interface Step {
  id: string
  stepIndex: number
  description: string
  screenshotUri?: string
  domEvent: any
}

export default function GuideEditorPage() {
  const params = useParams()
  const router = useRouter()
  const [guide, setGuide] = useState<Guide | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchGuide()
  }, [params.id])

  const fetchGuide = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:3001/api/guides/${params.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await response.json()
      setGuide(data)
    } catch (error) {
      console.error('Failed to fetch guide:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!guide) return

    try {
      const token = localStorage.getItem('token')
      await fetch(`http://localhost:3001/api/guides/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(guide),
      })
      alert('Guide saved!')
    } catch (error) {
      console.error('Failed to save guide:', error)
    }
  }

  const handleStepUpdate = (stepId: string, updates: Partial<Step>) => {
    if (!guide) return

    setGuide({
      ...guide,
      steps: guide.steps.map((step) =>
        step.id === stepId ? { ...step, ...updates } : step
      ),
    })
  }

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>
  }

  if (!guide) {
    return <div className="container mx-auto px-4 py-8">Guide not found</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
          >
            <Save className="w-5 h-5" />
            Save
          </button>
          <a
            href={`http://localhost:3001/api/export/pdf/${guide.id}`}
            className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            <Download className="w-5 h-5" />
            Export PDF
          </a>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          value={guide.title}
          onChange={(e) => setGuide({ ...guide, title: e.target.value })}
          className="text-3xl font-bold w-full border-none outline-none bg-transparent"
          placeholder="Guide Title"
        />
        <textarea
          value={guide.description || ''}
          onChange={(e) => setGuide({ ...guide, description: e.target.value })}
          className="w-full mt-2 text-gray-600 border-none outline-none bg-transparent resize-none"
          placeholder="Guide description"
          rows={2}
        />
      </div>

      <div className="space-y-6">
        {guide.steps
          .sort((a, b) => a.stepIndex - b.stepIndex)
          .map((step) => (
            <StepEditor
              key={step.id}
              step={step}
              onUpdate={(updates) => handleStepUpdate(step.id, updates)}
            />
          ))}
      </div>
    </div>
  )
}



