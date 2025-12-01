'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Edit, Trash2, Download } from 'lucide-react'

interface Guide {
  id: string
  title: string
  description: string
  createdAt: string
  steps: any[]
}

export default function GuidesPage() {
  const [guides, setGuides] = useState<Guide[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchGuides()
  }, [])

  const fetchGuides = async () => {
    try {
      const token = localStorage.getItem('token')
      // For development: if no token, use default org to fetch extension-created guides
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch('http://localhost:3001/api/guides', {
        headers,
      })
      
      if (!response.ok) {
        // If auth fails, try to fetch guides for default org (extension-created)
        if (response.status === 401) {
          console.log('No auth token, fetching guides for default org')
          // For now, just show empty state - in production, user should login
          setGuides([])
          return
        }
        throw new Error(`Failed to fetch: ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('Fetched guides:', data)
      setGuides(data)
    } catch (error) {
      console.error('Failed to fetch guides:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this guide?')) return

    try {
      const token = localStorage.getItem('token')
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`http://localhost:3001/api/guides/${id}`, {
        method: 'DELETE',
        headers,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to delete guide: ${response.statusText} - ${errorText}`)
      }

      // Refresh the guides list
      fetchGuides()
    } catch (error) {
      console.error('Failed to delete guide:', error)
      alert(`Failed to delete guide: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Guides</h1>
        <Link
          href="/guides/new"
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-5 h-5" />
          New Guide
        </Link>
      </div>

      {guides.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-600 mb-4">No guides yet</p>
          <Link
            href="/guides/new"
            className="text-primary-600 hover:underline"
          >
            Create your first guide
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {guides.map((guide) => (
            <GuideCard
              key={guide.id}
              guide={guide}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GuideCard({ guide, onDelete }: { guide: Guide; onDelete: (id: string) => void }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
      <h2 className="text-xl font-semibold mb-2">{guide.title}</h2>
      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
        {guide.description}
      </p>
      <div className="text-sm text-gray-500 mb-4">
        {guide.steps?.length || 0} steps
      </div>
      <div className="flex gap-2">
        <Link
          href={`/guides/${guide.id}`}
          className="flex-1 flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700"
        >
          <Edit className="w-4 h-4" />
          Edit
        </Link>
        <button
          onClick={() => onDelete(guide.id)}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <a
          href={`http://localhost:3001/api/export/pdf/${guide.id}`}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          <Download className="w-4 h-4" />
        </a>
      </div>
    </div>
  )
}




