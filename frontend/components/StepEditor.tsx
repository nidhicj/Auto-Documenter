'use client'

import { useState } from 'react'
import { Edit2, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'

interface Step {
  id: string
  stepIndex: number
  description: string
  screenshotUri?: string
  domEvent: any
}

interface StepEditorProps {
  step: Step
  onUpdate: (updates: Partial<Step>) => void
}

export default function StepEditor({ step, onUpdate }: StepEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [description, setDescription] = useState(step.description)

  const handleSave = () => {
    onUpdate({ description })
    setIsEditing(false)
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center font-bold text-primary-600">
          {step.stepIndex + 1}
        </div>

        <div className="flex-1">
          {isEditing ? (
            <div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2 border rounded-lg mb-2"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setDescription(step.description)
                    setIsEditing(false)
                  }}
                  className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-gray-700 mb-4">{description}</p>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 text-primary-600 hover:text-primary-700"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            </div>
          )}

          {step.screenshotUri && (
            <div className="mt-4">
              <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                <Image
                  src={step.screenshotUri}
                  alt={`Step ${step.stepIndex + 1} screenshot`}
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          )}

          <div className="mt-4 text-sm text-gray-500">
            Event: {step.domEvent?.type} on {step.domEvent?.target?.tagName}
          </div>
        </div>
      </div>
    </div>
  )
}



