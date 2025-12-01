'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'

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
}

export default function EmbedViewerPage() {
  const params = useParams()
  const [guide, setGuide] = useState<Guide | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchGuide()
  }, [params.id])

  const fetchGuide = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/embed/${params.id}`)
      const data = await response.json()
      setGuide(data.guide)
    } catch (error) {
      console.error('Failed to fetch guide:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>
  }

  if (!guide) {
    return <div className="container mx-auto px-4 py-8">Guide not found</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-4xl font-bold mb-4">{guide.title}</h1>
        {guide.description && (
          <p className="text-gray-600 mb-8">{guide.description}</p>
        )}

        <div className="space-y-8">
          {guide.steps
            .sort((a, b) => a.stepIndex - b.stepIndex)
            .map((step) => (
              <div key={step.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center font-bold text-primary-600">
                    {step.stepIndex + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-700 mb-4">{step.description}</p>
                    {step.screenshotUri && (() => {
                      // Normalize screenshot URI to always use media endpoint
                      const getScreenshotUrl = (uri: string): string => {
                        if (!uri) return '';
                        
                        // If it's already using our media endpoint, use it as-is
                        if (uri.includes('/api/media/')) {
                          return uri;
                        }
                        
                        // If it's a full URL (S3 signed URL or public URL), extract the key
                        if (uri.startsWith('http')) {
                          try {
                            const url = new URL(uri);
                            // Extract key from S3 URL pattern: /bucket/key or /key
                            let key = url.pathname;
                            // Remove bucket name if present (e.g., /autodoc-bucket/screenshots/...)
                            const bucketName = process.env.NEXT_PUBLIC_S3_BUCKET || 'autodoc-bucket';
                            if (key.includes(`/${bucketName}/`)) {
                              key = key.replace(`/${bucketName}`, '');
                            }
                            // Remove leading slash
                            key = key.startsWith('/') ? key.substring(1) : key;
                            // Remove query params (signed URL params)
                            key = key.split('?')[0];
                            
                            if (key) {
                              return `http://localhost:3001/api/media/${encodeURIComponent(key)}`;
                            }
                          } catch (e) {
                            console.warn('Failed to parse screenshot URL:', uri, e);
                          }
                        }
                        
                        // If it's just a key (not a full URL), use it directly
                        return `http://localhost:3001/api/media/${encodeURIComponent(uri)}`;
                      };
                      
                      const screenshotUrl = getScreenshotUrl(step.screenshotUri);
                      
                      return (
                        <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                          <Image
                            src={screenshotUrl}
                            alt={`Step ${step.stepIndex + 1} screenshot`}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}




